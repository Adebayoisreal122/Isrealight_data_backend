const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');
const wallet = require('./wallet');
const { AppError } = require('../utils/helpers');

const http = axios.create({ baseURL: 'https://api.paystack.co', timeout: 20000 });
const auth = () => {
  if (!env.paystack.secretKey) throw new Error('Paystack is not configured');
  return { Authorization: `Bearer ${env.paystack.secretKey}` };
};

async function initialize({ email, amountKobo, reference, userId }) {
  const { data } = await http.post(
    '/transaction/initialize',
    { email, amount: amountKobo, reference, callback_url: env.paystack.callbackUrl, metadata: { userId: String(userId) } },
    { headers: auth() }
  );
  return data.data; // { authorization_url, access_code, reference }
}

async function verify(reference) {
  const { data } = await http.get(`/transaction/verify/${encodeURIComponent(reference)}`, { headers: auth() });
  return data.data;
}

function validSignature(rawBody, signature) {
  if (!signature || !env.paystack.secretKey) return false;
  const expected = crypto.createHmac('sha512', env.paystack.secretKey).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Never trust the browser redirect or the webhook body: ask Paystack, then credit once.
async function settleFunding(reference) {
  const data = await verify(reference);
  if (data.status !== 'success' || data.currency !== 'NGN') return { credited: false, status: data.status };
  const userId = data.metadata?.userId;
  if (!userId) throw new AppError('Funding has no user attached', 400);

  const result = await wallet.credit({
    userId,
    amount: data.amount, // kobo
    purpose: 'funding',
    key: `funding:${reference}`,
    reference,
  });
  return { credited: !result.duplicate, status: 'success', amount: data.amount };
}

module.exports = { initialize, verify, validSignature, settleFunding };
