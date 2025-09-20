// Use the global database pool from server.js with connection validation
const getPool = () => {
  if (global.dbPool) {
    return global.dbPool;
  }
  throw new Error('Database pool not initialized. Make sure server.js is loaded first.');
};

// Connection health check for high-load scenarios
const ensureConnection = async () => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection issue:', error.message);
    return false;
  }
};

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
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async findByMobile(mobileNumber) {
    const query = 'SELECT * FROM users WHERE mobile_number = $1 LIMIT 1';
    
    try {
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();
      const result = await pool.query(query, [token, tokenExpiry, userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = { User };