const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'agent', 'admin'], default: 'user' },
    balance: { type: Number, default: 0 }, // kobo. Only change via services/wallet.js
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
