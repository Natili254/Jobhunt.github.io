const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../authMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "secretkey254";

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

function normalizeRole(role) {
    if (role === "user") return "jobseeker";
    return role;
}

router.post("/register", async (req, res) => {
    const { name, email, password, role } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!name || !email || !password || !normalizedRole) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    if (!["jobseeker", "employer"].includes(normalizedRole)) {
        return res.status(400).json({ message: "Role must be jobseeker or employer" });
    }

    try {
        const existingUsers = await runQuery("SELECT id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const hashed = await bcrypt.hash(password, 10);
        const result = await runQuery(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            [name, email, hashed, normalizedRole]
        );

        const userId = result.insertId;
        const token = jwt.sign(
            { id: userId, email, role: normalizedRole },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: {
                id: userId,
                name,
                email,
                role: normalizedRole
            }
        });
    } catch (error) {
        console.error("Registration error:", error.message);
        res.status(500).json({ message: "Failed to create user account" });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const result = await runQuery("SELECT * FROM users WHERE email = ?", [email]);
        if (result.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = result[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({ message: "Server error occurred during login" });
    }
});

router.get("/profile", auth, async (req, res) => {
    try {
        const result = await runQuery(
            "SELECT id, name, email, role FROM users WHERE id = ?",
            [req.user.id]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ success: true, user: result[0] });
    } catch (error) {
        console.error("Profile error:", error.message);
        res.status(500).json({ message: "Failed to fetch user profile" });
    }
});

router.post("/logout", auth, (req, res) => {
    res.status(200).json({ success: true, message: "Logged out successfully" });
});

router.get("/verify", auth, async (req, res) => {
    try {
        const result = await runQuery(
            "SELECT id, name, email, role FROM users WHERE id = ?",
            [req.user.id]
        );

        if (result.length === 0) {
            return res.status(401).json({ valid: false, error: "Invalid token" });
        }

        res.status(200).json({ valid: true, user: result[0] });
    } catch (error) {
        res.status(401).json({ valid: false, error: "Invalid token" });
    }
});

module.exports = router;
