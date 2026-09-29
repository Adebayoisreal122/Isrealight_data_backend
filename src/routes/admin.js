const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const env = require('../config/env');
const Plan = require('../models/Plan');
const Transaction = require('../models/Transaction');
const wallet = require('../services/wallet');
const vtpass = require('../services/vtpass');
const { requireAuth, requireRole } = require('../middleware/auth');
const { AppError, asyncHandler, toKobo } = require('../utils/helpers');

router.use(requireAuth, requireRole('admin'));

const markup = (kobo, pct) => Math.ceil(kobo * (1 + pct / 100));

// Pull plans from VTpass and upsert them with our markup, e.g. { "serviceID": "mtn-data" }.
router.post('/plans/sync', asyncHandler(async (req, res) => {
  const { serviceID, userMarkupPercent, agentMarkupPercent } = z.object({
    serviceID: z.string().min(2),
    userMarkupPercent: z.number().min(0).max(100).default(env.markup.user),
    agentMarkupPercent: z.number().min(0).max(100).default(env.markup.agent),
  }).parse(req.body);

  const type = ['dstv', 'gotv', 'startimes'].includes(serviceID) ? 'cable' : 'data';
  const variations = await vtpass.getVariations(serviceID);
  let created = 0, updated = 0, repriced = 0;

  for (const v of variations) {
    const providerPrice = toKobo(v.variation_amount);
    if (!providerPrice) continue;
    const plan = await Plan.findOne({ serviceID, variationCode: v.variation_code });
    if (!plan) {
      await Plan.create({
        type, serviceID, variationCode: v.variation_code, name: v.name, providerPrice,
        userPrice: markup(providerPrice, userMarkupPercent), agentPrice: markup(providerPrice, agentMarkupPercent),
      });
      created++;
      continue;
    }
    plan.providerPrice = providerPrice;
    plan.name = v.name;
    // If VTpass raised its price above ours, reprice so we never sell at a loss.
    if (plan.userPrice < providerPrice) { plan.userPrice = markup(providerPrice, userMarkupPercent); repriced++; }
    if (plan.agentPrice < providerPrice) { plan.agentPrice = markup(providerPrice, agentMarkupPercent); repriced++; }
    await plan.save();
    updated++;
  }
  res.json({ success: true, created, updated, repriced });
}));

// Prices in naira.
router.patch('/plans/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    userPrice: z.number().positive().optional(),
    agentPrice: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  }).parse(req.body);
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw new AppError('Plan not found', 404);
  if (body.userPrice !== undefined) plan.userPrice = toKobo(body.userPrice);
  if (body.agentPrice !== undefined) plan.agentPrice = toKobo(body.agentPrice);
  if (body.isActive !== undefined) plan.isActive = body.isActive;
  if (plan.userPrice < plan.providerPrice || plan.agentPrice < plan.providerPrice) {
    throw new AppError('Price is below provider cost', 400);
  }
  await plan.save();
  res.json({ success: true, plan });
}));

// Manual wallet credit/debit (goodwill, corrections). Amount in naira.
router.post('/wallet/adjust', asyncHandler(async (req, res) => {
  const { userId, type, amount, note } = z.object({
    userId: z.string().length(24),
    type: z.enum(['credit', 'debit']),
    amount: z.number().positive(),
    note: z.string().min(3).max(200),
  }).parse(req.body);
  const fn = type === 'credit' ? wallet.credit : wallet.debit;
  const result = await fn({
    userId, amount: toKobo(amount), purpose: 'admin', key: `admin:${crypto.randomUUID()}`, note: `${note} (by ${req.user.email})`,
  });
  res.json({ success: true, balance: result.balance });
}));

router.get('/transactions', asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['pending', 'success', 'failed']).optional() }).parse(req.query);
  const items = await Transaction.find(status ? { status } : {}).select('+providerResponse')
    .sort({ createdAt: -1 }).limit(100).populate('user', 'name email phone');
  res.json({ success: true, items });
}));

// How much do we have left with VTpass?
router.get('/provider-balance', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await vtpass.getBalance() });
}));

module.exports = router;
