const router = require('express').Router();
const express = require('express');
const Transaction = require('../models/Transaction');
const paystack = require('../services/paystack');
const purchaseService = require('../services/purchase');

// Paystack: raw body is required to verify the signature.
router.post('/paystack', express.raw({ type: '*/*' }), async (req, res) => {
  if (!paystack.validSignature(req.body, req.get('x-paystack-signature'))) return res.sendStatus(401);
  try {
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'charge.success') await paystack.settleFunding(event.data.reference);
  } catch (err) {
    console.error('Paystack webhook error:', err.message);
    return res.sendStatus(500); // non-200 makes Paystack retry
  }
  res.sendStatus(200);
});

// VTpass transaction-update webhook. We don't trust the payload: we requery VTpass for the truth.
// Confirm the payload shape + expected reply in the VTpass "Callback/Webhook" docs.
router.post('/vtpass', express.json(), async (req, res) => {
  try {
    const requestId = req.body?.data?.requestId || req.body?.requestId;
    if (requestId) {
      const tx = await Transaction.findOne({ reference: requestId });
      if (tx && tx.status === 'pending') await purchaseService.resolvePending(tx);
    }
  } catch (err) {
    console.error('VTpass webhook error:', err.message); // the worker will catch up anyway
  }
  res.json({ response: 'success' });
});

module.exports = router;
