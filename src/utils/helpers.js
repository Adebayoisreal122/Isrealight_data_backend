const crypto = require('crypto');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All money is stored as integer kobo to avoid floating point errors.
const toKobo = (naira) => Math.round(Number(naira) * 100);
const toNaira = (kobo) => kobo / 100;

// VTpass expects request_id to start with YYYYMMDDHHmm (Africa/Lagos time), then any unique suffix.
// Confirm this against the current VTpass docs before going live.
function newRequestId() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${crypto.randomBytes(6).toString('hex')}`;
}

module.exports = { AppError, asyncHandler, toKobo, toNaira, newRequestId };
