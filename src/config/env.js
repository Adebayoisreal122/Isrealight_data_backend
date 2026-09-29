require('dotenv').config();

for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  vtpass: {
    baseUrl: process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api',
    apiKey: process.env.VTPASS_API_KEY,
    publicKey: process.env.VTPASS_PUBLIC_KEY,
    secretKey: process.env.VTPASS_SECRET_KEY,
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
  },
  markup: {
    user: Number(process.env.DEFAULT_MARKUP_PERCENT ?? 3),
    agent: Number(process.env.DEFAULT_AGENT_MARKUP_PERCENT ?? 1.5),
  },
};
