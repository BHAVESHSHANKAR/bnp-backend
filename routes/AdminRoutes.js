const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const router = express.Router();

// Initialize Admin model with database pool
const adminModel = new Admin(global.dbPool);

// Middleware to verify admin token
const verifyAdminToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get admin details
        const adminResult = await adminModel.getById(decoded.adminId);
        if (!adminResult.success) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        req.admin = adminResult.admin;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

// Admin Signup
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password, fullName, bankName, role } = req.body;

        // Validation
        if (!username || !email || !password || !fullName || !bankName) {
            return res.status(400).json({
                success: false,
                message: 'Username, email, password, full name, and bank name are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Password validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Username validation
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username must be at least 3 characters long'
            });
        }

        const result = await adminModel.create({
            username,
            email,
            password,
            fullName,
            bankName,
            role
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: {
                admin: result.admin
            }
        });

    } catch (error) {
        console.error('Admin signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const result = await adminModel.login({ username, password });

        if (!result.success) {
            return res.status(401).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                admin: result.admin,
                token: result.token
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get Admin Profile (Protected)
router.get('/profile', verifyAdminToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                admin: req.admin
            }
        });
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update Admin Profile (Protected)
router.put('/profile', verifyAdminToken, async (req, res) => {
    try {
        const { fullName, email, bankName } = req.body;

        if (!fullName || !email || !bankName) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, and bank name are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        const result = await adminModel.updateProfile(req.admin.id, {
            fullName,
            email,
            bankName
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                admin: result.admin
            }
        });

    } catch (error) {
        console.error('Update admin profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Change Password (Protected)
router.put('/change-password', verifyAdminToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const result = await adminModel.changePassword(req.admin.id, {
            currentPassword,
            newPassword
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;