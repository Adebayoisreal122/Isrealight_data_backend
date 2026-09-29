const Transaction = require('../models/Transaction');
const purchaseService = require('../services/purchase');

let running = false;

// Safety net: resolves pending transactions and finishes any refund that didn't complete.
// Every step is idempotent, so it's safe to run alongside webhooks or on several instances.
async function sweep() {
  if (running) return;
  running = true;
  try {
    const stale = new Date(Date.now() - 20 * 1000);
    const pending = await Transaction.find({ status: 'pending', updatedAt: { $lt: stale } })
      .sort({ updatedAt: 1 }).limit(50);
  for (const tx of pending) {
  try {
    await purchaseService.resolvePending(tx);
  } catch (err) {
    const status = err.response?.status;

    if (status === 401) {
      console.error(
        `VTpass authentication failed while requering ${tx.reference}. Check VTPASS_API_KEY and VTPASS_SECRET_KEY.`
      );
    } else if (err.code === 'ENOTFOUND') {
      console.error(
        `VTpass DNS/network error while requering ${tx.reference}.`
      );
    } else if (err.code === 'ECONNABORTED') {
      console.error(
        `VTpass request timed out while requering ${tx.reference}.`
      );
    } else {
      console.error(
        `Requery failed for ${tx.reference}:`,
        err.message
      );
    }
  }

  if (Date.now() - tx.createdAt.getTime() > 6 * 3600 * 1000) {
    console.warn(
      `Transaction ${tx.reference} has been pending for 6h+. Review manually.`
    );
  }
}

    const unrefunded = await Transaction.find({ status: 'failed', refunded: false }).limit(50);
    for (const tx of unrefunded) {
      try {
        await purchaseService.refund(tx);
      } catch (err) {
        console.error(`Refund failed for ${tx.reference}:`, err.message);
      }
    }
  } finally {
    running = false;
  }
}

function startPendingWorker(intervalMs =5 * 60 * 1000) {
  const timer = setInterval(() => sweep().catch((e) => console.error('Sweep error:', e)), intervalMs);
  timer.unref();
  return timer;
}

module.exports = { startPendingWorker, sweep };
