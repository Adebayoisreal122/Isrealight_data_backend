const { Schema, model } = require('mongoose');

// Data bundles and cable packages. Prices are OURS, never taken from the client.
const planSchema = new Schema(
  {
    type: { type: String, enum: ['data', 'cable'], required: true },
    serviceID: { type: String, required: true },
    variationCode: { type: String, required: true },
    name: { type: String, required: true },
    providerPrice: { type: Number, required: true }, // kobo, what VTpass lists
    userPrice: { type: Number, required: true }, // kobo
    agentPrice: { type: Number, required: true }, // kobo
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

planSchema.index({ serviceID: 1, variationCode: 1 }, { unique: true });

module.exports = model('Plan', planSchema);
