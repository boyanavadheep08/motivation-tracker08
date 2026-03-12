const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// REGISTER
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: 'Username or email already exists.' });

    const hashed = await bcrypt.hash(password, 12);
    const colors = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, avatar_color) VALUES (?, ?, ?, ?)',
      [username, email, hashed, avatarColor]
    );

    const token = jwt.sign(
      { userId: result.insertId, username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: result.insertId, username, email, avatarColor, streak: 0 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required.' });

  try {
    const [users] = await db.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    if (users.length === 0)
      return res.status(401).json({ error: 'Invalid credentials.' });

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({ error: 'Invalid credentials.' });

    // Streak logic
    const today = new Date().toISOString().split('T')[0];
    const lastActive = user.last_active_date
      ? new Date(user.last_active_date).toISOString().split('T')[0]
      : null;

    let newStreak = user.streak;
    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      newStreak = lastActive === yesterdayStr ? user.streak + 1 : 1;
      const newLongest = Math.max(newStreak, user.longest_streak);
      await db.execute(
        'UPDATE users SET streak=?, longest_streak=?, last_active_date=? WHERE id=?',
        [newStreak, newLongest, today, user.id]
      );
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarColor: user.avatar_color,
        streak: newStreak,
        longestStreak: user.longest_streak
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET PROFILE
router.get('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, username, email, avatar_color, streak, longest_streak, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (users.length === 0)
      return res.status(404).json({ error: 'User not found.' });
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;