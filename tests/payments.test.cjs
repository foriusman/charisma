const { test } = require('node:test');
const assert = require('node:assert/strict');
const { charge, confirm, gateway, unpack } = require('../server/payments.cjs');
const env = { ZAINPAY_PUBLIC_KEY: 'test', ZAINPAY_ZAINBOX_CODE: 'box', PAYMENT_SIGNING_SECRET: 'x'.repeat(32), SITE_URL: 'https://wedding.example', ZAINPAY_ENV: 'sandbox' };
const input = { name: 'Guest', email: 'guest@example.com', phone: '08012345678', amount: 5000, currency: 'NGN' };
async function started() { return charge(input, env, async () => ({ code: '00', data: 'https://dev.zainpay.ng/checkout' })); }
test('checkout sends naira and a server-generated reference', async () => {
  const result = await charge(input, env, async (service, { data }) => {
    assert.equal(service, 'INITIALIZE_PAYMENT'); assert.equal(data.amount, '5000');
    assert.deepEqual(data.paymentChannels, ['card', 'bank_transfer']); assert.equal(data.currencyCode, 'NGN');
    assert.match(data.txnRef, /^CH26-/); assert.equal(data.callBackUrl, 'https://wedding.example/?payment=return');
    return { code: '00', data: 'https://dev.zainpay.ng/checkout' };
  });
  assert.equal(unpack(result.token, env.PAYMENT_SIGNING_SECRET).amount, 5000);
});
test('invalid amounts and currency never reach gateway', async () => {
  for (const change of [{ amount: -1 }, { amount: Infinity }, { amount: 99 }, { currency: 'USD' }]) {
    await assert.rejects(charge({ ...input, ...change }, env, () => assert.fail('gateway called')));
  }
});
test('missing keys, rejected checkout and foreign redirects fail closed', async () => {
  await assert.rejects(charge(input, {}, () => assert.fail('gateway called')));
  for (const result of [{ code: '04' }, { code: '00', data: 'https://zainpay.ng.attacker.example' }, { code: '00', data: 'http://zainpay.ng' }]) {
    await assert.rejects(charge(input, env, async () => result));
  }
});
test('gateway diagnostics include safe provider details but never credentials', async () => {
  const originalFetch = global.fetch;
  let gatewayResponse = {
    ok: false,
    status: 400,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => ({ error: { code: '02', message: 'Invalid Zainbox configuration' } })
  };
  global.fetch = async (url, options) => {
    assert.match(url, /api\.zainpay\.ng/);
    assert.equal(options.headers.Authorization, 'Bearer ' + env.ZAINPAY_PUBLIC_KEY);
    return gatewayResponse;
  };
  try {
    await assert.rejects(
      gateway('INITIALIZE_PAYMENT', { data: {} }, { ...env, ZAINPAY_ENV: 'live' }),
      (error) => {
        assert.match(error.publicMessage, /HTTP 400 \(code 02\): Invalid Zainbox configuration/);
        assert.equal(error.publicMessage.includes(env.ZAINPAY_PUBLIC_KEY), false);
        return true;
      }
    );

    gatewayResponse = {
      ok: false,
      status: 400,
      headers: { get: () => 'text/html; charset=utf-8' },
      json: async () => { throw new Error('not JSON'); }
    };
    await assert.rejects(
      gateway('INITIALIZE_PAYMENT', { data: {} }, { ...env, ZAINPAY_ENV: 'live' }),
      (error) => {
        assert.match(error.publicMessage, /response type text\/html; no provider error details returned/);
        assert.equal(error.publicMessage.includes(env.ZAINPAY_PUBLIC_KEY), false);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});
test('tampered tokens never reach verification', async () => {
  const { token } = await started();
  await assert.rejects(confirm({ token: 'x' + token }, env, () => assert.fail('gateway called')));
});
test('only matching verified deposits produce receipts; retries are stable', async () => {
  const { token } = await started(); const order = unpack(token, env.PAYMENT_SIGNING_SECRET);
  const data = { depositedAmount: 5000, txnRef: order.reference, zainboxCode: 'box', txnType: 'deposit', paymentRef: 'gateway-ref', txnDate: '2026-10-16T10:00:00Z' };
  const saved = [];
  const verified = () => confirm({ token }, env, async (service, { params }) => {
    assert.equal(service, 'GET_CARD_PAYMENT_STATUS'); assert.equal(params, order.reference);
    return { code: '00', data };
  }, async (receipt) => { saved.push(receipt); });
  assert.equal((await verified()).receipt.status, 'confirmed');
  assert.deepEqual(await verified(), await verified());
  assert.equal(saved.length, 3);
  assert.equal(saved[0].gateway_reference, 'gateway-ref');
  assert.equal(saved[0].paid_at, data.txnDate);
  for (const change of [{ depositedAmount: 1 }, { txnRef: 'other' }, { zainboxCode: 'other' }, { txnType: 'transfer' }, { paymentRef: '' }]) {
    await assert.rejects(confirm({ token }, env, async () => ({ code: '00', data: { ...data, ...change } })));
  }
  await assert.rejects(confirm({ token }, env, async () => ({ code: '04' })));
});
