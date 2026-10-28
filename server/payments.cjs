'use strict';
const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');

function paymentError(code, status, message) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.publicMessage = message;
  return error;
}

function settings(env) {
  if (!env.ZAINPAY_PUBLIC_KEY || !env.ZAINPAY_ZAINBOX_CODE || !env.PAYMENT_SIGNING_SECRET || env.PAYMENT_SIGNING_SECRET.length < 32) {
    throw paymentError('PAYMENT_CONFIG', 503, 'Payment service configuration is incomplete. Check the required Vercel Production variables.');
  }
  if (!['sandbox', 'live'].includes(env.ZAINPAY_ENV)) throw paymentError('PAYMENT_CONFIG', 503, 'ZAINPAY_ENV must be sandbox or live.');
  let site;
  try { site = new URL(env.SITE_URL); }
  catch (_) { throw paymentError('PAYMENT_CONFIG', 503, 'SITE_URL must be a valid HTTPS URL.'); }
  if (site.protocol !== 'https:') throw paymentError('PAYMENT_CONFIG', 503, 'SITE_URL must use HTTPS.');
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
    : '/virtual-account/wallet/deposit/verify/v2/' + encodeURIComponent(options.params);
  let response;
  try {
    response = await fetch(base + path, {
      method: options.data ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + env.ZAINPAY_PUBLIC_KEY, 'Content-Type': 'application/json' },
      body: options.data ? JSON.stringify(options.data) : undefined,
      signal: AbortSignal.timeout(20000)
    });
  } catch (_) {
    throw paymentError('ZAINPAY_UNAVAILABLE', 502, 'Could not reach Zainpay. Check the Vercel function logs and Zainpay service status.');
  }
  if (!response.ok) {
    let details = {};
    try { details = await response.json(); } catch (_) { details = {}; }
    const gatewayCode = String(details.code || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
    const gatewayDescription = String(details.description || details.message || '')
      .replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    const reason = gatewayDescription ? ': ' + gatewayDescription : '';
    throw paymentError('ZAINPAY_HTTP_ERROR', 502, 'Zainpay returned HTTP ' + response.status + ' (code ' + gatewayCode + ')' + reason + '. Check the live API key, Zainbox code, and request configuration.');
  }
  return response.json();
}
async function persistReceipt(receipt, env) {
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !secret) throw new Error('Payment storage is not configured');
  const base = new URL(env.SUPABASE_URL);
  if (base.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS');
  const table = encodeURIComponent(env.SUPABASE_PAYMENTS_TABLE || 'wedding_payments');
  const response = await fetch(base.origin + '/rest/v1/' + table + '?on_conflict=reference', {
    method: 'POST',
    headers: {
      apikey: secret,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(receipt),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Payment storage failed');
}
async function charge(input, env = process.env, call = gateway) {
  const config = settings(env);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 100 || amount > 10000000 || Math.round(amount * 100) !== amount * 100 || input.currency !== 'NGN') throw paymentError('INVALID_PAYMENT', 400, 'Enter an amount from ₦100 to ₦10,000,000 in NGN.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || String(input.email).length > 254 || typeof input.phone !== 'string' || !/^\+?[0-9 ()-]{10,20}$/.test(input.phone)) throw paymentError('INVALID_PAYER', 400, 'Check your name, email, and phone number, then try again.');
  const reference = 'CH26-' + randomUUID();
  const order = { reference, amount, currency: 'NGN', payer_name: input.name.trim(), payer_email: input.email, purpose: String(input.purpose || 'Wedding Gift').slice(0, 100), note: String(input.note || '').slice(0, 300), created_at: new Date().toISOString(), expires: Date.now() + 7 * 86400000, box: config.box, sandbox: config.sandbox };
  const result = await call('INITIALIZE_PAYMENT', { data: { amount: amount.toFixed(2), txnRef: reference, mobileNumber: input.phone.replace(/[ ()-]/g, ''), zainboxCode: config.box, emailAddress: input.email, currencyCode: 'NGN', paymentChannels: ['card', 'bank_transfer'], callBackUrl: config.site + '/?payment=return' } }, env);
  if (result?.code !== '00' || typeof result.data !== 'string') throw paymentError('ZAINPAY_REJECTED', 502, 'Zainpay did not create checkout (code ' + String(result?.code || 'unknown').slice(0, 12) + '). Verify the live API key and Zainbox configuration.');
  const url = new URL(result.data);
  if (url.protocol !== 'https:' || !/(^|\.)zainpay\.ng$/.test(url.hostname)) throw paymentError('ZAINPAY_REJECTED', 502, 'Zainpay returned an invalid checkout URL. Contact support before retrying.');
  return { checkoutUrl: url.href, token: pack(order, config.secret) };
}
async function confirm(input, env = process.env, call = gateway, save = persistReceipt) {
  const config = settings(env);
  const order = unpack(input.token, config.secret);
  if (order.box !== config.box || order.sandbox !== config.sandbox) throw new Error('Session environment mismatch');
  const result = await call('GET_CARD_PAYMENT_STATUS', { params: order.reference }, env);
  const data = result?.data;
  const amountKobo = Number(data?.depositedAmount ?? data?.amount?.amount ?? data?.amount);
  const paymentDate = data?.paymentDate || data?.txnDate;
  if (result?.code !== '00' || !data || data.txnRef !== order.reference || data.zainboxCode !== config.box || data.txnType !== 'deposit' || !data.paymentRef || !paymentDate || amountKobo !== order.amount * 100) throw new Error('Payment not verified');
  const { expires, box, sandbox, ...receipt } = order;
  const verifiedReceipt = { ...receipt, status: 'confirmed', gateway: sandbox ? 'Zainpay Sandbox' : 'Zainpay', gateway_reference: data.paymentRef, paid_at: paymentDate };
  await save(verifiedReceipt, env);
  return { receipt: verifiedReceipt };
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
    } catch (error) {
      const status = Number(error && error.status) || 500;
      const code = error && error.code || 'PAYMENT_ERROR';
      const message = error && error.publicMessage || 'Unable to complete the payment request. Please retry or contact support.';
      return res.status(status).json({ error: code, message: message });
    }
  };
}
module.exports = { charge, confirm, gateway, handler, pack, unpack };
