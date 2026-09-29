const axios = require('axios');
const env = require('../config/env');
const { toKobo } = require('../utils/helpers');

const http = axios.create({ baseURL: env.vtpass.baseUrl, timeout: 30000 });

function creds(kind) {
  const { apiKey, publicKey, secretKey } = env.vtpass;
  if (!apiKey || !publicKey || !secretKey) throw new Error('VTpass credentials are not configured');
  // GET requests use api-key + public-key; POST requests use api-key + secret-key
  return kind === 'get'
    ? { 'api-key': apiKey, 'public-key': publicKey }
    : { 'api-key': apiKey, 'secret-key': secretKey };
}

async function getVariations(serviceID) {
  const { data } = await http.get('/service-variations', { params: { serviceID }, headers: creds('get') });
  // VTpass has been seen returning both "variations" and the misspelt "varations"
  return data?.content?.variations || data?.content?.varations || [];
}

async function verifyMerchant({ billersCode, serviceID, type }) {
  const { data } = await http.post('/merchant-verify', { billersCode, serviceID, type }, { headers: creds('post') });
  return data;
}

async function pay(payload) {
  const { data } = await http.post('/pay', payload, { headers: creds('post') });
  return data;
}

async function requery(request_id) {
  const { data } = await http.post('/requery', { request_id }, { headers: creds('post') });
  return data;
}

async function getBalance() {
  const { data } = await http.get('/balance', { headers: creds('get') });
  return data;
}

/**
 * Turn a VTpass response into 'success' | 'failed' | 'pending'.
 * Golden rule: only return 'failed' when we are SURE, because failed => refund.
 * Anything unclear stays 'pending' and is resolved by requery/webhook.
 * Check the VTpass "Response Codes" page and adjust this mapping.
 */
function interpret(res, { requery: isRequery = false } = {}) {
  const code = String(res?.code ?? '');
  const status = String(res?.content?.transactions?.status ?? '').toLowerCase();

  if (code === '000') {
    if (status === 'delivered') return 'success';
    if (['failed', 'reversed', 'rejected'].includes(status)) return 'failed';
    return 'pending'; // initiated / pending / anything else
  }
  if (code === '099' || code === '014') return 'pending'; // processing / duplicate request_id
  if (code === '016') return 'failed'; // transaction failed
  return isRequery ? 'pending' : 'failed'; // pay(): explicit rejection. requery(): unknown, keep waiting
}

function extract(res) {
  const t = res?.content?.transactions || {};
  const out = {
    providerTransactionId: t.transactionId,
    costAmount: t.total_amount != null ? toKobo(t.total_amount) : undefined,
    token: res?.purchased_code || t.extras || undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ''));
}

module.exports = { getVariations, verifyMerchant, pay, requery, getBalance, interpret, extract };
