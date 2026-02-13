require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "secretkey254";

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        req.userId = decoded.id;
        next();
    });
};

// Submit application
router.post("/", verifyToken, (req, res) => {
    const { job_id, resume_link } = req.body;

    if (!job_id || !resume_link) {
        return res.status(400).json({ message: 'Job ID and resume link are required' });
    }

    db.query(
        'INSERT INTO applications (user_id, job_id, resume_link, status) VALUES (?, ?, ?, ?)',
        [req.userId, job_id, resume_link, 'pending'],
        (err, result) => {
            if (err) return res.status(500).json({ message: 'Failed to submit application' });
            
            res.status(201).json({ 
                message: 'Application submitted successfully',
                applicationId: result.insertId 
            });
        }
    );
});

// Get user applications
router.get("/user", verifyToken, (req, res) => {
    const query = `
        SELECT a.*, j.title, j.company, j.location 
        FROM applications a 
        JOIN jobs j ON a.job_id = j.id 
        WHERE a.user_id = ? 
        ORDER BY a.created_at DESC
    `;

    db.query(query, [req.userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(results);
    });
});

module.exports = router;
