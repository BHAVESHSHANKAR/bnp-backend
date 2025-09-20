const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Optimized Database Configuration for Multiple Users
const pool = new Pool({
    connectionString: process.env.NEON_URI,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 60000,
    max: 20, // Increased pool size for multiple users
    min: 2, // Keep minimum connections alive
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
    allowExitOnIdle: false, // Keep connections alive for better performance
    keepAlive: true,
    keepAliveInitialDelayMillis: 0
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

// Initialize database tables silently
const initializeDatabase = async () => {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      mobile_number VARCHAR(20) NOT NULL,
      country VARCHAR(100) NOT NULL,
      date_of_birth DATE NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      verification_token VARCHAR(255),
      verification_token_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

    const createIndexesQueries = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
        'CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_number);',
        'CREATE INDEX IF NOT EXISTS idx_users_name ON users(first_name, last_name);',
        'CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);',
        'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_users_dob ON users(date_of_birth);',
        'CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);',
        'CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);'
    ];

    try {
        await pool.query(createTableQuery);
        for (const indexQuery of createIndexesQueries) {
            await pool.query(indexQuery);
        }
        return true;
    } catch (error) {
        return false;
    }
};

// Make pool available globally
global.dbPool = pool;

const userRoutes = require('./routes/UserRoutes');

// Optimized Middleware for Multiple Users
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security and performance middleware
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Simple rate limiting for multiple users
const rateLimitMap = new Map();
app.use((req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // requests per minute per IP

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

// Request timeout middleware
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        res.status(408).json({ success: false, message: 'Request timeout' });
    });
    next();
});

// Routes
app.use('/api/users', userRoutes);

// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'Backend server is running!',
        timestamp: new Date().toISOString(),
        status: 'healthy'
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