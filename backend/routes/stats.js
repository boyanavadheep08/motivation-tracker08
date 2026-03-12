const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

router.get('/overview', auth, async (req, res) => {
  try {
    const [user] = await db.execute(
      'SELECT streak, longest_streak FROM users WHERE id = ?',
      [req.user.userId]
    );

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const [weekTasks] = await db.execute(
      `SELECT COUNT(*) as total,
       SUM(status = 'done') as completed
       FROM tasks WHERE user_id = ? AND scheduled_date >= ?`,
      [req.user.userId, weekStartStr]
    );

    const [goalsAvg] = await db.execute(
      'SELECT AVG(progress) as avg_progress, COUNT(*) as total FROM goals WHERE user_id = ?',
      [req.user.userId]
    );

    const [dailyStats] = await db.execute(
      `SELECT * FROM daily_stats
       WHERE user_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY stat_date ASC`,
      [req.user.userId]
    );

    res.json({
      streak: user[0]?.streak || 0,
      longestStreak: user[0]?.longest_streak || 0,
      weeklyTasks: weekTasks[0],
      goalsOverview: goalsAvg[0],
      dailyStats
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

router.get('/productivity', auth, async (req, res) => {
  const days = parseInt(req.query.days) || 14;
  try {
    const [data] = await db.execute(
      `SELECT stat_date, productivity_score, tasks_total, tasks_completed, mood_score
       FROM daily_stats
       WHERE user_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY stat_date ASC`,
      [req.user.userId, days]
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch productivity data.' });
  }
});

module.exports = router;