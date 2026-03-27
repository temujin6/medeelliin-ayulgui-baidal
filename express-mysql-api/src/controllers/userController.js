const pool = require('../config/db');

// GET /users
async function getAllUsers(req, res) {
  try {
    const [rows] = await pool.execute('SELECT id, name, email, created_at FROM users');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllUsers:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// GET /users/:id
async function getUserById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getUserById:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// POST /users
async function createUser(req, res) {
  const { name, email, password } = req.body;
  try {
    // Check for duplicate email
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), email, password]
    );

    res.status(201).json({
      success: true,
      message: 'User created',
      data: { id: result.insertId, name: name.trim(), email },
    });
  } catch (err) {
    console.error('createUser:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// PUT /users/:id
async function updateUser(req, res) {
  const { id } = req.params;
  const { name, email, password } = req.body;

  // Build SET clause dynamically from provided fields only
  const fields = [];
  const values = [];

  if (name !== undefined)     { fields.push('name = ?');     values.push(name.trim()); }
  if (email !== undefined)    { fields.push('email = ?');    values.push(email); }
  if (password !== undefined) { fields.push('password = ?'); values.push(password); }

  values.push(id);

  try {
    const [result] = await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    // Duplicate email on update
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    console.error('updateUser:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// DELETE /users/:id
async function deleteUser(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('deleteUser:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser };
