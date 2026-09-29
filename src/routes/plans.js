const router = require('express').Router();

const { z } = require('zod');
const { optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const vtpass = require('../services/vtpass');

router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { serviceID } = z.object({
    serviceID: z.string().min(2)
  }).parse(req.query);

  const variations = await vtpass.getVariations(serviceID);

  res.json({
    success: true,
    serviceID,
    plans: variations.map((plan) => ({
      variationCode: plan.variation_code,
      name: plan.name,
      price: Number(plan.variation_amount || 0),
      fixedPrice: plan.fixedPrice,
    })),
  });
}));

module.exports = router;