const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/laws?search=...
// Fetches laws from the database, matching search terms if provided
router.get('/', async (req, res) => {
  try {
    const { search, limit = 50, page = 1 } = req.query;
    
    let q = 'SELECT * FROM laws';
    const params = [];
    
    if (search) {
      params.push(`%${search}%`);
      q += ` WHERE law_name ILIKE $${params.length} 
                OR law_name_en ILIKE $${params.length} 
                OR article_number ILIKE $${params.length} 
                OR article_number_en ILIKE $${params.length} 
                OR content ILIKE $${params.length} 
                OR content_en ILIKE $${params.length}`;
    }
    
    // Order by id (which effectively sorts by the insert order)
    q += ' ORDER BY id ASC';
    
    params.push(parseInt(limit, 10));
    q += ` LIMIT $${params.length}`;
    
    params.push((parseInt(page, 10) - 1) * parseInt(limit, 10));
    q += ` OFFSET $${params.length}`;

    const { rows } = await pool.query(q, params);
    res.json({ laws: rows });
  } catch (err) {
    console.error('[Laws GET Error]', err);
    res.status(500).json({ error: 'Server error fetching laws' });
  }
});

module.exports = router;
