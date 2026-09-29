const { Schema, model } = require('mongoose');

const transactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reference: { type: String, required: true, unique: true }, // also sent to VTpass as request_id
    idempotencyKey: String, // optional, supplied by the client to stop double-submits
    type: { type: String, enum: ['airtime', 'data', 'cable', 'electricity'], required: true },
    serviceID: { type: String, required: true },
    variationCode: String,
    recipient: { type: String, required: true }, // phone, smartcard or meter number
    amount: { type: Number, required: true }, // kobo charged to the customer
    costAmount: Number, // kobo we actually paid the provider (after commission)
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    refunded: { type: Boolean, default: false },
    token: String, // electricity token / pin
    providerTransactionId: String,
    providerResponse: { type: Schema.Types.Mixed, select: false },
    note: String,
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1, updatedAt: 1 });
transactionSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = model('Transaction', transactionSchema);
