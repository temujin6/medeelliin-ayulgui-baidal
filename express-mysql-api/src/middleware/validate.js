/**
 * Validate fields required for creating a user.
 */
function validateCreateUser(req, res, next) {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('a valid email is required');
  }
  if (!password || password.length < 6) {
    errors.push('password must be at least 6 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
}

/**
 * Validate fields allowed for updating a user (all optional, at least one required).
 */
function validateUpdateUser(req, res, next) {
  const { name, email, password } = req.body;
  const errors = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('name must be a non-empty string');
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email must be a valid email address');
  }
  if (password !== undefined && password.length < 6) {
    errors.push('password must be at least 6 characters');
  }
  if (!name && !email && !password) {
    errors.push('provide at least one field to update: name, email, or password');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
}

module.exports = { validateCreateUser, validateUpdateUser };
