const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../authMiddleware");

// ✅ Use environment variable for security, fallback for development only
const JWT_SECRET = process.env.JWT_SECRET || "secretkey254";

// ========================================
// 📝 REGISTER ROUTE - Create new user and auto-login
// ========================================
router.post("/register", async (req, res) => {
    console.log("📥 Register request received:", req.body);
    // Extract user data from request body
    const { name, email, password, role } = req.body;

    // ✅ STEP 1: Validate input fields
    if (!name || !email || !password || !role) {
        return res.status(400).json({ 
            message: "All fields are required" 
        });
    }

    // ✅ STEP 2: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            message: "Invalid email format" 
        });
    }

    // ✅ STEP 3: Validate password length
    if (password.length < 6) {
        return res.status(400).json({ 
            message: "Password must be at least 6 characters long" 
        });
    }

    try {
        // ✅ STEP 4: Check if user already exists
        db.query(
            "SELECT * FROM users WHERE email = ?",
            [email],
            async (err, existingUsers) => {
                // Handle database query error
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ 
                        message: "Database error occurred" 
                    });
                }

                // If user already exists, return error
                if (existingUsers.length > 0) {
                    return res.status(409).json({ 
                        message: "Email already registered" 
                    });
                }

                // ✅ STEP 5: Hash the password (10 salt rounds for security)
                const hashed = await bcrypt.hash(password, 10);

                // ✅ STEP 6: Insert new user into database
                db.query(
                    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
                    [name, email, hashed, role],
                    (err, result) => {
                        // Handle insertion error
                        if (err) {
                            console.error("Insert error:", err);
                            return res.status(500).json({ 
                                message: "Failed to create user account" 
                            });
                        }

                        // ✅ STEP 7: Get the newly created user's ID
                        const userId = result.insertId;

                        // ✅ STEP 8: Create JWT token with user data
                        // Token expires in 7 days
                        const token = jwt.sign(
                            { 
                                id: userId, 
                                email: email,
                                role: role 
                            },
                            JWT_SECRET,
                            { expiresIn: "7d" }
                        );

                        // ✅ STEP 9: Return success response with token and user data
                        // This keeps the user logged in immediately after registration
                        res.status(201).json({
                            success: true,
                            message: "User registered successfully",
                            token: token,                    // 🔑 Token for authentication
                            user: {                          // 👤 User details to store
                                id: userId,
                                name: name,
                                email: email,
                                role: role
                            }
                        });
                    }
                );
            }
        );
    } catch (error) {
        // Catch any unexpected errors
        console.error("Registration error:", error);
        res.status(500).json({ 
            message: "Server error occurred during registration" 
        });
    }
});

// ========================================
// 🔐 LOGIN ROUTE - Authenticate existing user
// ========================================
router.post("/login", async (req, res) => {
    // Extract credentials from request
    const { email, password } = req.body;

    // ✅ STEP 1: Validate input
    if (!email || !password) {
        return res.status(400).json({ 
            message: "Email and password are required" 
        });
    }

    try {
        // ✅ STEP 2: Find user by email
        db.query(
            "SELECT * FROM users WHERE email = ?", 
            [email], 
            async (err, result) => {
                // Handle database error
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ 
                        message: "Database error occurred" 
                    });
                }

                // ✅ STEP 3: Check if user exists
                if (result.length === 0) {
                    return res.status(401).json({ 
                        message: "Invalid email or password" 
                    });
                }

                // Get user data
                const user = result[0];

                // ✅ STEP 4: Compare provided password with hashed password
                const valid = await bcrypt.compare(password, user.password);

                // If password doesn't match
                if (!valid) {
                    return res.status(401).json({ 
                        message: "Invalid email or password" 
                    });
                }

                // ✅ STEP 5: Create JWT token for authenticated user
                const token = jwt.sign(
                    { 
                        id: user.id, 
                        email: user.email,
                        role: user.role 
                    },
                    JWT_SECRET,
                    { expiresIn: "7d" }
                );

                // ✅ STEP 6: Return token and user data
                res.status(200).json({
                    success: true,
                    message: "Login successful",
                    token: token,                    // 🔑 Token for authentication
                    user: {                          // 👤 User details
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            }
        );
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ 
            message: "Server error occurred during login" 
        });
    }
});

// ========================================
// 👤 GET USER PROFILE - Fetch logged-in user's data
// ========================================
router.get("/profile", auth, (req, res) => {
    // The 'auth' middleware verifies JWT and adds user info to req.user

    // ✅ STEP 1: Query database for user details
    db.query(
        "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
        [req.user.id],  // req.user.id comes from the auth middleware
        (err, result) => {
            // Handle database error
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ 
                    message: "Failed to fetch user profile" 
                });
            }

            // ✅ STEP 2: Check if user exists
            if (result.length === 0) {
                return res.status(404).json({ 
                    message: "User not found" 
                });
            }

            // ✅ STEP 3: Return user profile data
            res.status(200).json({
                success: true,
                user: result[0]
            });
        }
    );
});

// ========================================
// 🚪 LOGOUT ROUTE - Optional server-side logout
// ========================================
router.post("/logout", auth, (req, res) => {
    // Note: With JWT, logout is primarily handled on the client-side
    // by removing the token from localStorage
    // This endpoint can be used for logging purposes or token blacklisting

    res.status(200).json({
        success: true,
        message: "Logged out successfully"
    });
});

// ========================================
// ✅ VERIFY TOKEN ROUTE - Check if token is still valid
// ========================================
router.get("/verify", auth, (req, res) => {
    // If the auth middleware passes, token is valid
    
    // Fetch fresh user data
    db.query(
        "SELECT id, name, email, role FROM users WHERE id = ?",
        [req.user.id],
        (err, result) => {
            if (err || result.length === 0) {
                return res.status(401).json({ 
                    valid: false,
                    error: "Invalid token" 
                });
            }

            res.status(200).json({
                valid: true,
                user: result[0]
            });
        }
    );
});

module.exports = router;