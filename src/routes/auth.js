const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const User = require('../models/User');
const { phone } = require('../config/services');
const { signToken, requireAuth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../utils/helpers');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone,
  password: z.string().min(8).max(100),
});

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, balance: u.balance });

router.post('/register', limiter, asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const user = await User.create({ ...body, password: await bcrypt.hash(body.password, 12) });
  res.status(201).json({ success: true, token: signToken(user), user: publicUser(user) });
}));

router.post('/login', limiter, asyncHandler(async (req, res) => {
  const { email, password } = z.object({ email: z.string().toLowerCase(), password: z.string() }).parse(req.body);
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid email or password', 401);
  }
  res.json({ success: true, token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ success: true, user: publicUser(req.user) }));

module.exports = router;
