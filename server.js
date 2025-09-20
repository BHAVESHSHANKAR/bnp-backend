const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 6969;

// Optimized Database Configuration with Better Error Handling
const pool = new Pool({
    connectionString: process.env.NEON_URI,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 30000, // Increased timeout
    idleTimeoutMillis: 300000, // 5 minutes idle timeout
    max: 10, // Reduced pool size for stability
    min: 1, // Minimum connections
    acquireTimeoutMillis: 60000, // Increased acquire timeout
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 500,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 1000
});

// Add error handling for pool
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
    console.log('Database pool connected');
});

pool.on('remove', () => {
    console.log('Database client removed from pool');
});

// Simplified database connection test
const testDatabaseConnection = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
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

        // Initialize File model and create table
        const File = require('./models/File');
        const fileModel = new File(pool);
        await fileModel.createTable();
        
        return true;
    } catch (error) {
        console.error('Database initialization failed:', error);
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
        'http://localhost:8080',
        'http://127.0.0.1:3000',
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

// Rate limiting for admin system
const rateLimitMap = new Map();

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap.entries()) {
        if (now > data.resetTime) {
            rateLimitMap.delete(ip);
        }
    }
}, 5 * 60 * 1000);

app.use((req, res, next) => {
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 50; // Reduced for admin system - requests per minute per IP

    if (!rateLimitMap.has(clientIP)) {
        rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    } else {
        const clientData = rateLimitMap.get(clientIP);
        if (now > clientData.resetTime) {
            clientData.count = 1;
            clientData.resetTime = now + windowMs;
        } else {
            clientData.count++;
            if (clientData.count > maxRequests) {
                return res.status(429).json({
                    success: false,
                    message: 'Too many requests, please try again later'
                });
            }
        }
    }

    next();
});

// Request timeout middleware with better handling
app.use((req, res, next) => {
    // Set different timeouts for different routes
    let timeoutMs = 30000; // Default 30 seconds
    
    if (req.path.includes('/upload')) {
        timeoutMs = 300000; // 5 minutes for file uploads
    } else if (req.path.includes('/download')) {
        timeoutMs = 120000; // 2 minutes for downloads
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

// Start server with optimized initialization
const startServer = async () => {
    // Test database connection and initialize tables
    const dbConnected = await testDatabaseConnection();

    if (dbConnected) {
        await initializeDatabase();
        console.log('✅ Database connected successfully');
    }

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
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