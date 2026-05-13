const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 🚀 DevOps Agent: Uptime & Database Health Monitor
router.get('/', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    db_connected: false,
    memory_usage: process.memoryUsage().heapUsed / 1024 / 1024, // in MB
  };

  try {
    // Attempt a lightweight query to verify DB is alive
    const { rows } = await pool.query('SELECT 1 AS alive');
    if (rows && rows[0] && rows[0].alive === 1) {
      healthCheck.db_connected = true;
    }
  } catch (err) {
    healthCheck.message = 'DB_ERROR';
    healthCheck.error = err.message;
    return res.status(503).json(healthCheck); // 503 Service Unavailable
  }

  res.status(200).json(healthCheck);
});

module.exports = router;
