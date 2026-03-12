const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// GET tasks for a date
router.get('/', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const [tasks] = await db.execute(
      'SELECT * FROM tasks WHERE user_id = ? AND scheduled_date = ? ORDER BY priority DESC, created_at ASC',
      [req.user.userId, date]
    );
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// CREATE task
router.post('/', auth, async (req, res) => {
  const { title, type, priority, scheduled_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  const date = scheduled_date || new Date().toISOString().split('T')[0];

  try {
    const [result] = await db.execute(
      'INSERT INTO tasks (user_id, title, type, priority, scheduled_date) VALUES (?, ?, ?, ?, ?)',
      [req.user.userId, title, type || 'daily', priority || 'medium', date]
    );
    const [task] = await db.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json(task[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// UPDATE status
router.patch('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  try {
    const completedAt = status === 'done' ? new Date() : null;
    await db.execute(
      'UPDATE tasks SET status = ?, completed_at = ? WHERE id = ? AND user_id = ?',
      [status, completedAt, req.params.id, req.user.userId]
    );
    await updateDailyStats(req.user.userId);
    const [task] = await db.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(task[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// DELETE task
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]);
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

async function updateDailyStats(userId) {
  const today = new Date().toISOString().split('T')[0];
  const [tasks] = await db.execute(
    'SELECT * FROM tasks WHERE user_id = ? AND scheduled_date = ?', [userId, today]);
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'done').length;
  const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;
  await db.execute(
    `INSERT INTO daily_stats (user_id, stat_date, tasks_total, tasks_completed, productivity_score)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tasks_total=?, tasks_completed=?, productivity_score=?`,
    [userId, today, total, completed, productivity, total, completed, productivity]
  );
}

module.exports = router;