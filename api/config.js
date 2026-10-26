module.exports = function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.status(200).send('window.CHARISMA_CONFIG = ' + JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    paymentMode: process.env.ZAINPAY_PUBLIC_KEY && process.env.ZAINPAY_ZAINBOX_CODE &&
      process.env.PAYMENT_SIGNING_SECRET && process.env.PAYMENT_SIGNING_SECRET.length >= 32 &&
      process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
      ['sandbox', 'live'].includes(process.env.ZAINPAY_ENV)
      ? process.env.ZAINPAY_ENV
      : 'demo'
  }) + ';');
};