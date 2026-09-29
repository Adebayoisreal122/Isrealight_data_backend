const mongoose = require('mongoose');
const User = require('../models/User');
const LedgerEntry = require('../models/LedgerEntry');
const { AppError } = require('../utils/helpers');

/**
 * The ONLY place a balance changes. Each change runs in a MongoDB transaction:
 * balance update + ledger entry (+ optional `within` work) commit together or not at all.
 * `key` makes it idempotent: replaying the same key is a no-op.
 */
async function applyEntry({ userId, type, amount, purpose, key, reference, note, within }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new AppError('Invalid amount', 400);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existing = await LedgerEntry.findOne({ key }).session(session);
      if (existing) {
        result = { duplicate: true, entry: existing };
        return;
      }

      const filter = { _id: userId };
      if (type === 'debit') filter.balance = { $gte: amount }; // atomic "enough funds" check
      const user = await User.findOneAndUpdate(
        filter,
        { $inc: { balance: type === 'debit' ? -amount : amount } },
        { new: true, session }
      );
      if (!user) {
        throw type === 'debit'
          ? new AppError('Insufficient wallet balance', 402)
          : new AppError('User not found', 404);
      }

      if (within) await within(session);

      const [entry] = await LedgerEntry.create(
        [{ user: userId, type, purpose, amount, balanceAfter: user.balance, key, reference, note }],
        { session }
      );
      result = { duplicate: false, entry, balance: user.balance };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

const debit = (opts) => applyEntry({ ...opts, type: 'debit' });
const credit = (opts) => applyEntry({ ...opts, type: 'credit' });

module.exports = { debit, credit };
