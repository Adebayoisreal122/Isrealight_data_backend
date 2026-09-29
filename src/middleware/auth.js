const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/helpers');

const signToken = (user) => jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

async function userFromHeader(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { sub } = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(sub);
  return user && user.isActive ? user : null;
}

const requireAuth = asyncHandler(async (req, res, next) => {
  let user = null;
  try { user = await userFromHeader(req); } catch { /* invalid/expired token */ }
  if (!user) throw new AppError('Please log in', 401);
  req.user = user;
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  try { req.user = await userFromHeader(req); } catch { req.user = null; }
  next();
});

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new AppError('Forbidden', 403));

module.exports = { signToken, requireAuth, optionalAuth, requireRole };
