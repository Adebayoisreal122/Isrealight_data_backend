const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientUrl }));

// Webhooks first: they need their own body parsers (Paystack needs the raw body).
app.use('/api/webhooks', require('./routes/webhooks'));

app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/purchase', require('./routes/purchase'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/admin', require('./routes/admin'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
