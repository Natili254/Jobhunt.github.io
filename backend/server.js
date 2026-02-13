require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

const authRoutes = require("./routes/auth");

const app = express();

app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

const path = require('path');
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.get('/health', (req, res) => {
    const status = { server: 'ok' };
    db.getConnection((err, connection) => {
        if (err) {
            status.db = 'down';
            status.error = err.message;
            return res.status(200).json(status);
        }
        connection.query('SELECT 1', (qErr) => {
            if (qErr) {
                status.db = 'down';
                status.error = qErr.message;
            } else {
                status.db = 'connected';
            }
            connection.release();
            res.status(200).json(status);
        });
    });
});

app.use("/api/auth", authRoutes);

app.get("/api/jobs", (req, res) => {
    console.log("📋 Jobs request received");
    
    db.query("SELECT * FROM jobs ORDER BY posted_at DESC", (err, results) => {
        if (err) {
            console.error("Jobs query error:", err);
            return res.status(500).json({ 
                success: false,
                message: "Failed to fetch jobs", 
                error: err.message 
            });
        }
        
        console.log(`✅ Returning ${results.length} jobs`);
        res.json(results);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((req, res) => {
    console.log("❌ 404 - Route not found:", req.method, req.url);
    res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
    console.error("❌ Error:", err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🔍 API Base URL: http://localhost:${PORT}`);
    console.log(`🔗 Test Jobs: http://localhost:${PORT}/api/jobs`);
    console.log(`🔗 Test Health: http://localhost:${PORT}/health`);
});
