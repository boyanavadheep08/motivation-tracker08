const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// GET all entries
router.get('/', auth, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  try {
    const [entries] = await db.execute(
      'SELECT * FROM diary_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT ? OFFSET ?',
      [req.user.userId, limit, offset]
    );
    const [count] = await db.execute(
      'SELECT COUNT(*) as total FROM diary_entries WHERE user_id = ?',
      [req.user.userId]
    );
    res.json({ entries, total: count[0].total, page });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
});

// GET by date
router.get('/date/:date', auth, async (req, res) => {
  try {
    const [entries] = await db.execute(
      'SELECT * FROM diary_entries WHERE user_id = ? AND entry_date = ?',
      [req.user.userId, req.params.date]
    );
    if (entries.length === 0)
      return res.status(404).json({ error: 'No entry for this date.' });
    res.json(entries[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entry.' });
  }
});

// CREATE or UPDATE (upsert)
router.post('/', auth, async (req, res) => {
  const { content, new_things_learned, mood_score,
          energy_level, tags, title, entry_date } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required.' });
  const date = entry_date || new Date().toISOString().split('T')[0];

  try {
    await db.execute(
      `INSERT INTO diary_entries
        (user_id, entry_date, title, content, new_things_learned, mood_score, energy_level, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        title=VALUES(title), content=VALUES(content),
        new_things_learned=VALUES(new_things_learned),
        mood_score=VALUES(mood_score), energy_level=VALUES(energy_level),
        tags=VALUES(tags), updated_at=CURRENT_TIMESTAMP`,
      [req.user.userId, date, title || '', content,
       new_things_learned || '', mood_score || 5, energy_level || 5, tags || '']
    );

    await db.execute(
      `INSERT INTO daily_stats (user_id, stat_date, mood_score)
       VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mood_score=?`,
      [req.user.userId, date, mood_score || 5, mood_score || 5]
    );

    const [entry] = await db.execute(
      'SELECT * FROM diary_entries WHERE user_id = ? AND entry_date = ?',
      [req.user.userId, date]
    );
    res.status(201).json(entry[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save entry.' });
  }
});

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.execute('DELETE FROM diary_entries WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]);
    res.json({ message: 'Entry deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

module.exports = router;