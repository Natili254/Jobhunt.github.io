const express = require("express");
const db = require("../../db");

const router = express.Router();

// Get all jobs
router.get("/", (req, res) => {
    db.query('SELECT * FROM jobs ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(results);
    });
});

// Get single job
router.get("/:id", (req, res) => {
    db.query('SELECT * FROM jobs WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        
        if (results.length === 0) {
            return res.status(404).json({ message: 'Job not found' });
        }
        
        res.json(results[0]);
    });
});

module.exports = router;