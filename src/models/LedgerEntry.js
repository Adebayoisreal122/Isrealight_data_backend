const { Schema, model } = require('mongoose');

// Append-only record of every balance change. `key` makes each change idempotent.
const ledgerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    purpose: { type: String, enum: ['funding', 'purchase', 'refund', 'admin'], required: true },
    amount: { type: Number, required: true, min: 1 }, // kobo, always positive
    balanceAfter: { type: Number, required: true },
    key: { type: String, required: true, unique: true }, // e.g. purchase:<ref>, refund:<ref>, funding:<paystackRef>
    reference: String,
    note: String,
  },
  { timestamps: true }
);

ledgerSchema.index({ user: 1, createdAt: -1 });

module.exports = model('LedgerEntry', ledgerSchema);
