const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// GET all goals
router.get('/', auth, async (req, res) => {
  try {
    const [goals] = await db.execute(
      'SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    for (let goal of goals) {
      const [topics] = await db.execute(
        'SELECT * FROM goal_topics WHERE goal_id = ? ORDER BY created_at ASC',
        [goal.id]
      );
      goal.topics = topics;
    }
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch goals.' });
  }
});

// CREATE goal
router.post('/', auth, async (req, res) => {
  const { title, description, progress, target_date, color, icon, topics } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  try {
    const [result] = await db.execute(
      'INSERT INTO goals (user_id, title, description, progress, target_date, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, title, description || '', progress || 0,
       target_date || null, color || '#6366f1', icon || '🎯']
    );

    if (topics && topics.length > 0) {
      for (const topic of topics) {
        await db.execute(
          'INSERT INTO goal_topics (goal_id, user_id, title) VALUES (?, ?, ?)',
          [result.insertId, req.user.userId, topic]
        );
      }
    }

    const [newGoal] = await db.execute('SELECT * FROM goals WHERE id = ?', [result.insertId]);
    const [goalTopics] = await db.execute('SELECT * FROM goal_topics WHERE goal_id = ?', [result.insertId]);
    newGoal[0].topics = goalTopics;
    res.status(201).json(newGoal[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create goal.' });
  }
});

// UPDATE goal
router.put('/:id', auth, async (req, res) => {
  const { title, description, progress, target_date, color, icon, is_completed } = req.body;
  try {
    await db.execute(
      `UPDATE goals SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        progress = COALESCE(?, progress),
        target_date = COALESCE(?, target_date),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        is_completed = COALESCE(?, is_completed)
       WHERE id = ? AND user_id = ?`,
      [title, description, progress, target_date, color, icon,
       is_completed, req.params.id, req.user.userId]
    );
    const [updated] = await db.execute('SELECT * FROM goals WHERE id = ?', [req.params.id]);
    const [topics] = await db.execute('SELECT * FROM goal_topics WHERE goal_id = ?', [req.params.id]);
    updated[0].topics = topics;
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// DELETE goal
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.execute('DELETE FROM goals WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]);
    res.json({ message: 'Goal deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
});

// TOGGLE topic
router.patch('/topics/:topicId', auth, async (req, res) => {
  try {
    const [topics] = await db.execute(
      'SELECT * FROM goal_topics WHERE id = ? AND user_id = ?',
      [req.params.topicId, req.user.userId]
    );
    if (topics.length === 0)
      return res.status(404).json({ error: 'Topic not found.' });

    const newStatus = !topics[0].is_done;
    await db.execute('UPDATE goal_topics SET is_done = ? WHERE id = ?',
      [newStatus, req.params.topicId]);

    const goalId = topics[0].goal_id;
    const [allTopics] = await db.execute(
      'SELECT * FROM goal_topics WHERE goal_id = ?', [goalId]);
    if (allTopics.length > 0) {
      const doneCount = allTopics.filter(t =>
        t.id === parseInt(req.params.topicId) ? newStatus : t.is_done
      ).length;
      const progress = Math.round((doneCount / allTopics.length) * 100);
      await db.execute('UPDATE goals SET progress = ? WHERE id = ?', [progress, goalId]);
    }
    res.json({ is_done: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle topic.' });
  }
});

module.exports = router;