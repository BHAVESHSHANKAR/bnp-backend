const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class Admin {
    constructor(pool) {
        this.pool = pool;
    }

    // Create admin table and handle migrations
    async createTable() {
        try {
            // First, create the table without bank_name if it doesn't exist
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS admins (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    full_name VARCHAR(200) NOT NULL,
                    role VARCHAR(50) DEFAULT 'admin',
                    is_active BOOLEAN DEFAULT TRUE,
                    last_login TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;

            await this.pool.query(createTableQuery);

            // Check if bank_name column exists
            const checkColumnQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'admins' AND column_name = 'bank_name';
            `;

            const columnResult = await this.pool.query(checkColumnQuery);

            // Add bank_name column if it doesn't exist
            if (columnResult.rows.length === 0) {
                const addColumnQuery = `
                    ALTER TABLE admins 
                    ADD COLUMN bank_name VARCHAR(200) DEFAULT 'Default Bank' NOT NULL;
                `;
                await this.pool.query(addColumnQuery);
                console.log('✅ Added bank_name column to admins table');
            }

            // Create indexes
            const createIndexesQueries = [
                'CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);',
                'CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);',
                'CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);',
                'CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(is_active);',
                'CREATE INDEX IF NOT EXISTS idx_admins_bank_name ON admins(bank_name);'
            ];

            for (const indexQuery of createIndexesQueries) {
                await this.pool.query(indexQuery);
            }

            return true;
        } catch (error) {
            console.error('Error creating/updating admin table:', error);
            return false;
        }
    }

    // Create new admin
    async create(adminData) {
        const { username, email, password, fullName, bankName, role = 'admin' } = adminData;
        
        try {
            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const query = `
                INSERT INTO admins (username, email, password, full_name, bank_name, role)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, username, email, full_name, bank_name, role, is_active, created_at
            `;

            const values = [username, email, hashedPassword, fullName, bankName, role];
            const result = await this.pool.query(query, values);

            return {
                success: true,
                admin: result.rows[0]
            };
        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
                if (error.constraint === 'admins_username_key') {
                    return { success: false, message: 'Username already exists' };
                }
                if (error.constraint === 'admins_email_key') {
                    return { success: false, message: 'Email already exists' };
                }
            }
            console.error('Error creating admin:', error);
            return { success: false, message: 'Failed to create admin' };
        }
    }

    // Login admin
    async login(loginData) {
        const { username, password } = loginData;

        try {
            const query = `
                SELECT id, username, email, password, full_name, bank_name, role, is_active, last_login
                FROM admins 
                WHERE (username = $1 OR email = $1) AND is_active = true
            `;

            const result = await this.pool.query(query, [username]);

            if (result.rows.length === 0) {
                return { success: false, message: 'Invalid credentials' };
            }

            const admin = result.rows[0];

            // Verify password
            const isValidPassword = await bcrypt.compare(password, admin.password);
            if (!isValidPassword) {
                return { success: false, message: 'Invalid credentials' };
            }

            // Update last login
            await this.pool.query(
                'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [admin.id]
            );

            // Generate JWT token
            const token = jwt.sign(
                { 
                    adminId: admin.id, 
                    username: admin.username, 
                    role: admin.role 
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Remove password from response
            delete admin.password;

            return {
                success: true,
                admin,
                token
            };
        } catch (error) {
            console.error('Error during admin login:', error);
            return { success: false, message: 'Login failed' };
        }
    }

    // Get admin by ID
    async getById(adminId) {
        try {
            const query = `
                SELECT id, username, email, full_name, bank_name, role, is_active, last_login, created_at
                FROM admins 
                WHERE id = $1 AND is_active = true
            `;

            const result = await this.pool.query(query, [adminId]);

            if (result.rows.length === 0) {
                return { success: false, message: 'Admin not found' };
            }

            return {
                success: true,
                admin: result.rows[0]
            };
        } catch (error) {
            console.error('Error fetching admin:', error);
            return { success: false, message: 'Failed to fetch admin' };
        }
    }

    // Update admin profile
    async updateProfile(adminId, updateData) {
        const { fullName, email, bankName } = updateData;

        try {
            const query = `
                UPDATE admins 
                SET full_name = $1, email = $2, bank_name = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4 AND is_active = true
                RETURNING id, username, email, full_name, bank_name, role, is_active, updated_at
            `;

            const result = await this.pool.query(query, [fullName, email, bankName, adminId]);

            if (result.rows.length === 0) {
                return { success: false, message: 'Admin not found' };
            }

            return {
                success: true,
                admin: result.rows[0]
            };
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'admins_email_key') {
                return { success: false, message: 'Email already exists' };
            }
            console.error('Error updating admin profile:', error);
            return { success: false, message: 'Failed to update profile' };
        }
    }

    // Change password
    async changePassword(adminId, passwordData) {
        const { currentPassword, newPassword } = passwordData;

        try {
            // Get current password
            const adminQuery = 'SELECT password FROM admins WHERE id = $1 AND is_active = true';
            const adminResult = await this.pool.query(adminQuery, [adminId]);

            if (adminResult.rows.length === 0) {
                return { success: false, message: 'Admin not found' };
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, adminResult.rows[0].password);
            if (!isValidPassword) {
                return { success: false, message: 'Current password is incorrect' };
            }

            // Hash new password
            const saltRounds = 12;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            const updateQuery = `
                UPDATE admins 
                SET password = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `;

            await this.pool.query(updateQuery, [hashedNewPassword, adminId]);

            return { success: true, message: 'Password changed successfully' };
        } catch (error) {
            console.error('Error changing password:', error);
            return { success: false, message: 'Failed to change password' };
        }
    }
}

module.exports = Admin;