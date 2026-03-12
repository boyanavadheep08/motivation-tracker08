const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/diary', require('./routes/diary'));
app.use('/api/stats', require('./routes/stats'));

// Health check (important for hosting)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle SPA routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});