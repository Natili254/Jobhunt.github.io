cat > routes/auth.js << 'EOF'
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db"); // Changed from "../../db" to "../config/db"

// ✅ Use environment variable for security
const JWT_SECRET = process.env.JWT_SECRET || "secretkey254";

// ========================================
// 📝 REGISTER ROUTE - Create new user and auto-login
// ========================================
router.post("/register", async (req, res) => {
    try {
        // Extract user data from request body
        const { name, email, password, role } = req.body;

        // ✅ STEP 1: Validate input fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({ 
                success: false,
                message: "All fields are required" 
            });
        }

        // ✅ STEP 2: Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid email format" 
            });
        }

        // ✅ STEP 3: Validate password length
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: "Password must be at least 6 characters long" 
            });
        }

        // ✅ STEP 4: Check if user already exists (using promises)
        const [existingUsers] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        // If user already exists, return error
        if (existingUsers.length > 0) {
            return res.status(409).json({ 
                success: false,
                message: "Email already registered" 
            });
        }

        // ✅ STEP 5: Hash the password (10 salt rounds for security)
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ STEP 6: Insert new user into database
        const [result] = await db.query(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, role]
        );

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
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token: token,
            user: {
                id: userId,
                name: name,
                email: email,
                role: role
            }
        });

    } catch (error) {
        // Catch any unexpected errors
        console.error("Registration error:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error occurred during registration",
            error: error.message
        });
    }
});

// ========================================
// 🔐 LOGIN ROUTE - Authenticate existing user
// ========================================
router.post("/login", async (req, res) => {
    try {
        // Extract credentials from request
        const { email, password } = req.body;

        // ✅ STEP 1: Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: "Email and password are required" 
            });
        }

        // ✅ STEP 2: Find user by email (using promises)
        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?", 
            [email]
        );

        // ✅ STEP 3: Check if user exists
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid email or password" 
            });
        }

        // Get user data
        const user = users[0];

        // ✅ STEP 4: Compare provided password with hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // If password doesn't match
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false,
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
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error occurred during login",
            error: error.message
        });
    }
});

// ========================================
// 👤 GET USER PROFILE - Fetch logged-in user's data
// ========================================
router.get("/profile", async (req, res) => {
    try {
        // ✅ STEP 1: Get token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: "No token provided" 
            });
        }

        const token = authHeader.split(' ')[1];

        // ✅ STEP 2: Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);

        // ✅ STEP 3: Query database for user details
        const [users] = await db.query(
            "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
            [decoded.id]
        );

        // ✅ STEP 4: Check if user exists
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        // ✅ STEP 5: Return user profile data
        res.status(200).json({
            success: true,
            user: users[0]
        });

    } catch (error) {
        console.error("Profile fetch error:", error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token" 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: "Token expired" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Failed to fetch user profile",
            error: error.message
        });
    }
});

// ========================================
// 🚪 LOGOUT ROUTE - Optional server-side logout
// ========================================
router.post("/logout", async (req, res) => {
    // Note: With JWT, logout is primarily handled on the client-side
    // by removing the token from localStorage
    // This endpoint can be used for logging purposes
    
    res.status(200).json({
        success: true,
        message: "Logged out successfully"
    });
});

// ========================================
// ✅ VERIFY TOKEN ROUTE - Check if token is still valid
// ========================================
router.get("/verify", async (req, res) => {
    try {
        // ✅ STEP 1: Get token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                valid: false,
                message: "No token provided" 
            });
        }

        const token = authHeader.split(' ')[1];

        // ✅ STEP 2: Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);

        // ✅ STEP 3: Fetch fresh user data
        const [users] = await db.query(
            "SELECT id, name, email, role FROM users WHERE id = ?",
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                valid: false,
                message: "User not found" 
            });
        }

        res.status(200).json({
            valid: true,
            user: users[0]
        });

    } catch (error) {
        console.error("Token verification error:", error);
        
        res.status(401).json({
            valid: false,
            message: "Invalid or expired token"
        });
    }
});

module.exports = router;
EOF