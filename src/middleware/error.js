const { ZodError } = require('zod');

const notFound = (req, res) => res.status(404).json({ success: false, message: 'Route not found' });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.code === 11000) return res.status(409).json({ success: false, message: 'Already exists' });
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });

  console.error(err);
  res.status(500).json({ success: false, message: 'Something went wrong' });
}

module.exports = { notFound, errorHandler };
