const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.NEON_URI,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('📅 Database time:', result.rows[0].now);
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Check database connection on startup
testConnection();

// Create users table and indexes if they don't exist
const createUsersTable = async () => {
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

  // Create indexes for better query performance
  const createIndexesQueries = [
    // Index on email for fast login lookups (most important)
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
    
    // Index on mobile number for potential lookups
    'CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_number);',
    
    // Composite index for name searches
    'CREATE INDEX IF NOT EXISTS idx_users_name ON users(first_name, last_name);',
    
    // Index on country for filtering/analytics
    'CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);',
    
    // Index on created_at for sorting by registration date
    'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);',
    
    // Index on date_of_birth for age-based queries
    'CREATE INDEX IF NOT EXISTS idx_users_dob ON users(date_of_birth);',
    
    // Index on verification token for email verification
    'CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);',
    
    // Index on verification status
    'CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);'
  ];
  
  try {
    // Create table first
    await pool.query(createTableQuery);
    console.log('Users table created or already exists');
    
    // Create indexes
    for (const indexQuery of createIndexesQueries) {
      await pool.query(indexQuery);
    }
    console.log('Database indexes created successfully');
    
  } catch (error) {
    console.error('Error creating users table or indexes:', error);
  }
};

// Initialize table
createUsersTable();

class User {
  static async create(userData) {
    const { firstName, lastName, email, password, mobileNumber, country, dateOfBirth, verificationToken } = userData;
    
    const query = `
      INSERT INTO users (first_name, last_name, email, password, mobile_number, country, date_of_birth, verification_token, verification_token_expires)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, first_name, last_name, email, mobile_number, country, date_of_birth, is_verified, created_at
    `;
    
    // Set token expiry to 24 hours from now
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const values = [firstName, lastName, email, password, mobileNumber, country, dateOfBirth, verificationToken, tokenExpiry];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findByEmail(email) {
    // Using LOWER() for case-insensitive email lookup with index
    const query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1';
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    const query = `
      SELECT id, first_name, last_name, email, mobile_number, country, 
             date_of_birth, created_at 
      FROM users 
      WHERE id = $1 
      LIMIT 1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findByMobile(mobileNumber) {
    const query = 'SELECT * FROM users WHERE mobile_number = $1 LIMIT 1';
    
    try {
      const result = await pool.query(query, [mobileNumber]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async checkEmailExists(email) {
    // Optimized query to just check existence
    const query = 'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1';
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  static async getUsersByCountry(country, limit = 50, offset = 0) {
    const query = `
      SELECT id, first_name, last_name, email, mobile_number, country, 
             date_of_birth, created_at 
      FROM users 
      WHERE country = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [country, limit, offset]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async findByVerificationToken(token) {
    const query = `
      SELECT * FROM users 
      WHERE verification_token = $1 
      AND verification_token_expires > NOW() 
      LIMIT 1
    `;
    
    try {
      const result = await pool.query(query, [token]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async verifyUser(userId) {
    const query = `
      UPDATE users 
      SET is_verified = TRUE, 
          verification_token = NULL, 
          verification_token_expires = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, first_name, last_name, email, mobile_number, country, date_of_birth, is_verified, created_at
    `;
    
    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async updateVerificationToken(userId, token) {
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const query = `
      UPDATE users 
      SET verification_token = $1, 
          verification_token_expires = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, email, first_name
    `;
    
    try {
      const result = await pool.query(query, [token, tokenExpiry, userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = { User, pool };