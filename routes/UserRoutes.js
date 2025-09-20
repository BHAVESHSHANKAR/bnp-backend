const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models/Users');
const countriesService = require('../services/CountriesService');
const emailService = require('../services/EmailService');

const router = express.Router();

// Signup route
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password, mobileNumber, country, dateOfBirth } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !password || !mobileNumber || !country || !dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists (optimized check)
        const emailExists = await User.checkEmailExists(email);
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create user
        const userData = {
            firstName,
            lastName,
            email,
            password: hashedPassword,
            mobileNumber,
            country,
            dateOfBirth,
            verificationToken
        };

        const newUser = await User.create(userData);

        // Send verification email
        const emailResult = await emailService.sendVerificationEmail(email, firstName, verificationToken);
        
        if (!emailResult.success) {
            console.error('Failed to send verification email:', emailResult.error);
        }

        res.status(201).json({
            success: true,
            message: 'User created successfully. Please check your email to verify your account.',
            data: {
                user: newUser,
                emailSent: emailResult.success
            }
        });

    } catch (error) {
        console.error('Signup error:', error);

        if (error.code === '23505') { // PostgreSQL unique violation
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if email is verified
        if (!user.is_verified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email address before logging in',
                requiresVerification: true
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Remove password from response
        const { password: _, verification_token, verification_token_expires, ...userWithoutPassword } = user;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: userWithoutPassword,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get user profile (protected route)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { user }
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Verify email
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Find user by verification token
        const user = await User.findByVerificationToken(token);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        // Verify the user
        const verifiedUser = await User.verifyUser(user.id);

        // Send welcome email
        await emailService.sendWelcomeEmail(user.email, user.first_name);

        res.status(200).json({
            success: true,
            message: 'Email verified successfully! Welcome to our platform.',
            data: {
                user: verifiedUser
            }
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already verified
        if (user.is_verified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        await User.updateVerificationToken(user.id, verificationToken);

        // Send verification email
        const emailResult = await emailService.sendVerificationEmail(email, user.first_name, verificationToken);

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Verification email sent successfully'
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get all countries
router.get('/countries', async (req, res) => {
    try {
        const countries = await countriesService.getAllCountries();

        if (!countries.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch countries',
                error: countries.error
            });
        }

        res.status(200).json({
            success: true,
            message: 'Countries fetched successfully',
            data: countries.data
        });

    } catch (error) {
        console.error('Countries endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get countries with phone codes
router.get('/countries/phone-codes', async (req, res) => {
    try {
        const countries = await countriesService.getCountriesWithPhoneCodes();

        if (!countries.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch countries with phone codes',
                error: countries.error
            });
        }

        res.status(200).json({
            success: true,
            message: 'Countries with phone codes fetched successfully',
            data: countries.data
        });

    } catch (error) {
        console.error('Countries phone codes endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get country by code
router.get('/countries/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const country = await countriesService.getCountryByCode(code);

        if (!country.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch country',
                error: country.error
            });
        }

        if (!country.data) {
            return res.status(404).json({
                success: false,
                message: 'Country not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Country fetched successfully',
            data: country.data
        });

    } catch (error) {
        console.error('Country by code endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

module.exports = router;