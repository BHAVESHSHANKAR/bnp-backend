const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 6969;

// Optimized Database Configuration for Fast Responses
const pool = new Pool({
    connectionString: process.env.NEON_URI,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000, // Reduced timeout
    idleTimeoutMillis: 60000, // 1 minute idle timeout
    max: 5, // Smaller pool for faster responses
    min: 2, // Keep connections ready
    acquireTimeoutMillis: 3000, // Faster acquire timeout
    createTimeoutMillis: 5000,
    destroyTimeoutMillis: 2000,
    reapIntervalMillis: 2000,
    createRetryIntervalMillis: 200,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 500
});

// Add error handling for pool
pool.on('error', (err) => {
    // Silent error handling
});

// Simplified database connection test
const testDatabaseConnection = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        return false;
    }
};

// Initialize database tables for admin system
const initializeDatabase = async () => {
    try {
        // Initialize Admin model and create table
        const Admin = require('./models/Admin');
        const adminModel = new Admin(pool);
        await adminModel.createTable();

        // Initialize File model and create table (includes migrations)
        const File = require('./models/File');
        const fileModel = new File(pool);
        await fileModel.createTable();
        
        return true;
    } catch (error) {
        return false;
    }
};

// Make pool available globally
global.dbPool = pool;

const adminRoutes = require('./routes/AdminRoutes');
const fileRoutes = require('./routes/FileRoutes');

// Middleware for Admin System
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'https://riskanalyzer-red.vercel.app',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:8080',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition']
}));
app.use(express.json({ limit: '50gb' })); // Increased limit for large files
app.use(express.urlencoded({ extended: true, limit: '50gb' })); // Increased limit for large files

// Security and performance middleware
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Simple rate limiting - 100 requests per minute (very generous)
const requestCounts = new Map();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60000; // 1 minute

app.use((req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old entries
    for (const [ip, data] of requestCounts.entries()) {
        if (now - data.firstRequest > RATE_WINDOW) {
            requestCounts.delete(ip);
        }
    }
    
    // Check current IP
    const clientData = requestCounts.get(clientIP);
    if (clientData) {
        if (now - clientData.firstRequest < RATE_WINDOW) {
            clientData.count++;
            if (clientData.count > RATE_LIMIT) {
                return res.status(429).json({
                    success: false,
                    message: 'Please wait 45 seconds before trying again.',
                    retryAfter: 45
                });
            }
        } else {
            // Reset window
            clientData.firstRequest = now;
            clientData.count = 1;
        }
    } else {
        requestCounts.set(clientIP, { firstRequest: now, count: 1 });
    }
    
    next();
});

// Request timeout middleware with better handling
app.use((req, res, next) => {
    let timeoutMs = 10000; // Default 10 seconds for fast responses
    
    if (req.path.includes('/upload')) {
        timeoutMs = 300000; // 5 minutes for file uploads
    } else if (req.path.includes('/download')) {
        timeoutMs = 120000; // 2 minutes for downloads
    } else if (req.path.includes('/decision')) {
        timeoutMs = 5000; // 5 seconds for decisions - fast feedback
    }
    
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({
                success: false,
                message: 'Request timeout',
                timeout: timeoutMs / 1000 + ' seconds'
            });
        }
    }, timeoutMs);
    
    // Clear timeout when response is finished
    res.on('finish', () => {
        clearTimeout(timeout);
    });
    
    next();
});

// Keep-alive endpoint for server responsiveness
app.get('/ping', async (req, res) => {
    try {
        // Quick database ping
        await global.dbPool.query('SELECT 1');
        
        res.json({
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'Admin Backend Server is running!',
        timestamp: new Date().toISOString(),
        status: 'healthy',
        system: 'admin-only'
    });
});

// Database health check
app.get('/health/db', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as server_time, version() as db_version');
        client.release();

        res.status(200).json({
            success: true,
            message: 'Database connection is healthy',
            data: {
                server_time: result.rows[0].server_time,
                db_version: result.rows[0].db_version,
                connection_status: 'connected'
            }
        });
    } catch (error) {
        console.error('Database health check failed:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// Start server with non-blocking initialization
const startServer = async () => {
    // Start the server first - don't block on database
    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    // Initialize database in background with timeout protection
    setTimeout(async () => {
        try {
            // Test database connection with timeout
            const dbConnected = await Promise.race([
                testDatabaseConnection(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Database connection timeout')), 15000)
                )
            ]);

            if (dbConnected) {
                console.log('Database connected');
                
                // Initialize database with timeout protection
                await Promise.race([
                    initializeDatabase(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Database initialization timeout')), 30000)
                    )
                ]);
            }
        } catch (error) {
            // Silent error handling - no logs
        }
    }, 1000);

    return server;
};

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await pool.end();
    process.exit(0);
});

startServer();