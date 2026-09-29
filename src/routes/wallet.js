const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const LedgerEntry = require('../models/LedgerEntry');
const paystack = require('../services/paystack');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, toKobo } = require('../utils/helpers');

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const history = await LedgerEntry.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, balance: req.user.balance, history });
}));

// Start a funding: returns a Paystack checkout URL.
router.post('/fund', asyncHandler(async (req, res) => {
  const { amount } = z.object({ amount: z.number().int().min(100).max(1000000) }).parse(req.body);
  const reference = `fund_${crypto.randomBytes(10).toString('hex')}`;
  const init = await paystack.initialize({
    email: req.user.email, amountKobo: toKobo(amount), reference, userId: req.user._id,
  });
  res.json({ success: true, authorizationUrl: init.authorization_url, reference });
}));

// Your frontend callback page calls this after Paystack redirects back. Safe to call repeatedly.
router.get('/fund/verify', asyncHandler(async (req, res) => {
  const { reference } = z.object({ reference: z.string().min(5) }).parse(req.query);
  res.json({ success: true, ...(await paystack.settleFunding(reference)) });
}));

module.exports = router;
