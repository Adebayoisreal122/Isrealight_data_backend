const router = require('express').Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const Transaction = require('../models/Transaction');
const purchaseService = require('../services/purchase');
const { requireAuth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../utils/helpers');

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Transaction.countDocuments(filter),
  ]);
  res.json({ success: true, page, total, items });
}));

router.get('/:reference', asyncHandler(async (req, res) => {
  const tx = await Transaction.findOne({ reference: req.params.reference, user: req.user._id });
  if (!tx) throw new AppError('Transaction not found', 404);
  res.json({ success: true, transaction: tx });
}));

// Let a customer nudge a stuck transaction.
const requeryLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5 });
router.post('/:reference/requery', requeryLimiter, asyncHandler(async (req, res) => {
  const tx = await Transaction.findOne({ reference: req.params.reference, user: req.user._id });
  if (!tx) throw new AppError('Transaction not found', 404);
  if (tx.status === 'pending') await purchaseService.resolvePending(tx);
  res.json({ success: true, transaction: await Transaction.findById(tx._id) });
}));

module.exports = router;
