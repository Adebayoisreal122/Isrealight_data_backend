const router = require('express').Router();
const { z } = require('zod');
const { purchaseSchema, CABLE, POWER } = require('../config/services');
const purchaseService = require('../services/purchase');
const vtpass = require('../services/vtpass');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');

router.use(requireAuth);

// Look up the customer name for a smartcard or meter before charging.
router.post('/verify', asyncHandler(async (req, res) => {
  const body = z.object({
    serviceID: z.enum([...CABLE, ...POWER]),
    billersCode: z.string().regex(/^\d{6,20}$/),
    type: z.enum(['prepaid', 'postpaid']).optional(), // electricity only
  }).parse(req.body);
  const data = await vtpass.verifyMerchant(body);
  res.json({ success: true, customer: data?.content ?? null });
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = purchaseSchema.parse(req.body);
  const key = req.get('Idempotency-Key') || undefined;
  const tx = await purchaseService.purchase(req.user, input, key);

  const messages = {
    success: 'Transaction successful',
    pending: 'Transaction is processing. We will update you shortly.',
    failed: 'Transaction failed. Your wallet has been refunded.',
  };
  res.status(tx.status === 'pending' ? 202 : 200).json({
    success: tx.status !== 'failed',
    status: tx.status,
    message: messages[tx.status],
    transaction: tx,
  });
}));

module.exports = router;
