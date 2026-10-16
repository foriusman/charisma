'use strict';
const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');

function settings(env) {
  if (!env.ZAINPAY_PUBLIC_KEY || !env.ZAINPAY_ZAINBOX_CODE || !env.PAYMENT_SIGNING_SECRET || env.PAYMENT_SIGNING_SECRET.length < 32) {
    throw new Error('Payment service is not configured');
  }
  if (!['sandbox', 'live'].includes(env.ZAINPAY_ENV)) throw new Error('Invalid payment environment');
  const site = new URL(env.SITE_URL);
  if (site.protocol !== 'https:') throw new Error('SITE_URL must use HTTPS');
  return { site: site.origin, box: env.ZAINPAY_ZAINBOX_CODE, secret: env.PAYMENT_SIGNING_SECRET, sandbox: env.ZAINPAY_ENV === 'sandbox' };
}
function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}
function pack(order, secret) {
  const data = Buffer.from(JSON.stringify(order)).toString('base64url');
  return data + '.' + sign(data, secret);
}
function unpack(token, secret) {
  if (typeof token !== 'string' || token.length > 8000) throw new Error('Invalid session');
  const parts = token.split('.');
  const expected = Buffer.from(sign(parts[0], secret));
  const actual = Buffer.from(parts[1] || '');
  if (parts.length !== 2 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid session');
  const order = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  if (!order.expires || order.expires < Date.now()) throw new Error('Expired session');
  return order;
}
async function gateway(service, options, env) {
  const base = env.ZAINPAY_ENV === 'sandbox' ? 'https://sandbox.zainpay.ng' : 'https://api.zainpay.ng';
  const path = service === 'INITIALIZE_PAYMENT'
    ? '/zainbox/card/initialize/payment'
    : '/virtual-account/wallet/deposit/verify/' + encodeURIComponent(options.params);
  const response = await fetch(base + path, {
    method: options.data ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + env.ZAINPAY_PUBLIC_KEY, 'Content-Type': 'application/json' },
    body: options.data ? JSON.stringify(options.data) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('Gateway request failed');
  return response.json();
}
async function charge(input, env = process.env, call = gateway) {
  const config = settings(env);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 100 || amount > 10000000 || Math.round(amount * 100) !== amount * 100 || input.currency !== 'NGN') throw new Error('Invalid amount');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || String(input.email).length > 254 || !/^\+?[0-9 ()-]{10,20}$/.test(input.phone)) throw new Error('Invalid payer details');
  const reference = 'CH26-' + randomUUID();
  const order = { reference, amount, currency: 'NGN', payer_name: input.name.trim(), payer_email: input.email, purpose: String(input.purpose || 'Wedding Gift').slice(0, 100), note: String(input.note || '').slice(0, 300), created_at: new Date().toISOString(), expires: Date.now() + 7 * 86400000, box: config.box, sandbox: config.sandbox };
  const result = await call('INITIALIZE_PAYMENT', { data: { amount: amount.toFixed(2), txnRef: reference, mobileNumber: input.phone.replace(/[ ()-]/g, ''), zainboxCode: config.box, emailAddress: input.email, callBackUrl: config.site + '/?payment=return' } }, env);
  if (result?.code !== '00' || typeof result.data !== 'string') throw new Error('Checkout unavailable');
  const url = new URL(result.data);
  if (url.protocol !== 'https:' || !/(^|\.)zainpay\.ng$/.test(url.hostname)) throw new Error('Invalid checkout URL');
  return { checkoutUrl: url.href, token: pack(order, config.secret) };
}
async function confirm(input, env = process.env, call = gateway) {
  const config = settings(env);
  const order = unpack(input.token, config.secret);
  if (order.box !== config.box || order.sandbox !== config.sandbox) throw new Error('Session environment mismatch');
  const result = await call('GET_CARD_PAYMENT_STATUS', { params: order.reference }, env);
  const data = result?.data;
  const amount = Number(data?.amount?.amount ?? data?.amount);
  if (result?.code !== '00' || !data || data.txnRef !== order.reference || data.zainboxCode !== config.box || data.txnType !== 'deposit' || !data.paymentRef || !data.paymentDate || amount !== order.amount) throw new Error('Payment not verified');
  const { expires, box, sandbox, ...receipt } = order;
  return { receipt: { ...receipt, status: 'confirmed', gateway: sandbox ? 'Zainpay Sandbox' : 'Zainpay', gateway_reference: data.paymentRef, paid_at: data.paymentDate } };
}
function handler(action) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    try {
      const config = settings(process.env);
      if (req.headers.origin && req.headers.origin !== config.site) return res.status(403).json({ error: 'Origin not allowed' });
      if (!String(req.headers['content-type']).startsWith('application/json')) return res.status(415).json({ error: 'JSON required' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || JSON.stringify(body).length > 10000) return res.status(400).json({ error: 'Invalid request' });
      return res.status(200).json(await action(body));
    } catch (_) { return res.status(400).json({ error: 'Unable to complete payment request. Please retry or contact us with your reference.' }); }
  };
}
module.exports = { charge, confirm, handler, pack, unpack };
