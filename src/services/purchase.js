const Plan = require('../models/Plan');
const Transaction = require('../models/Transaction');
const wallet = require('./wallet');
const vtpass = require('./vtpass');
const { AppError, newRequestId, toKobo, toNaira } = require('../utils/helpers');

// Work out what to charge the customer and what to send to VTpass. Prices come from OUR db.
async function quote(user, input) {
  const { type, serviceID, recipient } = input;

  if (type === 'airtime') {
    return { charge: toKobo(input.amount), payload: { serviceID, amount: input.amount, phone: recipient } };
  }
  if (type === 'electricity') {
    return {
      charge: toKobo(input.amount),
      payload: { serviceID, billersCode: recipient, variation_code: input.variationCode, amount: input.amount, phone: user.phone },
    };
  }

  const plan = await Plan.findOne({ serviceID, variationCode: input.variationCode, isActive: true });
  if (!plan) throw new AppError('Plan not found or unavailable', 404);
  const charge = user.role === 'agent' ? plan.agentPrice : plan.userPrice;
  if (charge < plan.providerPrice) throw new AppError('This plan is temporarily unavailable', 503); // never sell below cost

  const payload = {
    serviceID,
    billersCode: recipient,
    variation_code: input.variationCode,
    amount: toNaira(plan.providerPrice),
    phone: type === 'data' ? recipient : user.phone,
  };
  if (type === 'cable') payload.subscription_type = input.subscriptionType;
  return { charge, payload };
}

async function purchase(user, input, idempotencyKey) {
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ user: user._id, idempotencyKey });
    if (existing) return existing;
  }

  const { charge, payload } = await quote(user, input);
  const reference = newRequestId();

  // 1) Debit wallet AND create the transaction in one DB transaction: no orphans either way.
  let tx;
  try {
    await wallet.debit({
      userId: user._id,
      amount: charge,
      purpose: 'purchase',
      key: `purchase:${reference}`,
      reference,
      within: async (session) => {
        [tx] = await Transaction.create(
          [{
            user: user._id, reference, idempotencyKey, type: input.type, serviceID: input.serviceID,
            variationCode: input.variationCode, recipient: input.recipient, amount: charge, status: 'pending',
          }],
          { session }
        );
      },
    });
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) return Transaction.findOne({ user: user._id, idempotencyKey });
    throw err;
  }

  // 2) Call the provider. A timeout/network error means "unknown", NOT "failed": never refund on it.
  let outcome = 'pending';
  let response;
  try {
    response = await vtpass.pay({ request_id: reference, ...payload });
    outcome = vtpass.interpret(response);
  } catch (err) {
    response = { error: err.message, status: err.response?.status };
  }

  await settle(tx._id, outcome, response);
  return Transaction.findById(tx._id);
}

// Move a pending transaction to its final state exactly once, refunding if it failed.
async function settle(txId, outcome, response) {
  const fields = vtpass.extract(response);
  if (outcome === 'pending') {
    await Transaction.updateOne({ _id: txId, status: 'pending' }, { $set: { providerResponse: response, ...fields } });
    return;
  }
  const tx = await Transaction.findOneAndUpdate(
    { _id: txId, status: 'pending' }, // conditional: only one caller wins
    { $set: { status: outcome, providerResponse: response, ...fields } },
    { new: true }
  );
  if (!tx) return; // already settled by the webhook or the worker
  if (outcome === 'failed') await refund(tx);
}

// Idempotent: the ledger key means a second call does nothing.
async function refund(tx) {
  await wallet.credit({
    userId: tx.user,
    amount: tx.amount,
    purpose: 'refund',
    key: `refund:${tx.reference}`,
    reference: tx.reference,
    within: (session) => Transaction.updateOne({ _id: tx._id }, { refunded: true }, { session }),
  });
}

// Ask VTpass what really happened to a pending transaction.
async function resolvePending(tx) {
  const response = await vtpass.requery(tx.reference);
  await settle(tx._id, vtpass.interpret(response, { requery: true }), response);
}

module.exports = { purchase, settle, refund, resolvePending };
