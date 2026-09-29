const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { startPendingWorker } = require('./jobs/pendingWorker');

(async () => {
  await connectDB();
  startPendingWorker();
  app.listen(env.port, () => console.log(`API running on port ${env.port}`));
})().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
