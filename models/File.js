class File {
    constructor(pool) {
        this.pool = pool;
    }

    // Create files table and handle migrations
    async createTable() {
        try {
            // First, create the table without new columns if it doesn't exist
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS customer_files (
                    id SERIAL PRIMARY KEY,
                    customer_id VARCHAR(100) NOT NULL,
                    admin_id INTEGER NOT NULL,
                    original_filename VARCHAR(500) NOT NULL,
                    cloudinary_id VARCHAR(500) NOT NULL,
                    secure_url TEXT NOT NULL,
                    file_size BIGINT NOT NULL,
                    file_hash VARCHAR(64) NOT NULL,
                    iv VARCHAR(32) NOT NULL,
                    file_type VARCHAR(100),
                    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES admins(id)
                );
            `;

            await this.pool.query(createTableQuery);

            // Check if person_name column exists
            const checkPersonNameQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'customer_files' AND column_name = 'person_name';
            `;

            const personNameResult = await this.pool.query(checkPersonNameQuery);

            // Add person_name column if it doesn't exist
            if (personNameResult.rows.length === 0) {
                const addPersonNameQuery = `
                    ALTER TABLE customer_files 
                    ADD COLUMN person_name VARCHAR(200) DEFAULT 'Unknown Person' NOT NULL;
                `;
                await this.pool.query(addPersonNameQuery);
                console.log('✅ Added person_name column to customer_files table');
            }

            // Check if mobile_number column exists
            const checkMobileQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'customer_files' AND column_name = 'mobile_number';
            `;

            const mobileResult = await this.pool.query(checkMobileQuery);

            // Add mobile_number column if it doesn't exist
            if (mobileResult.rows.length === 0) {
                const addMobileQuery = `
                    ALTER TABLE customer_files 
                    ADD COLUMN mobile_number VARCHAR(20) DEFAULT '0000000000' NOT NULL;
                `;
                await this.pool.query(addMobileQuery);
                console.log('✅ Added mobile_number column to customer_files table');
            }

            // Create indexes
            const createIndexesQueries = [
                'CREATE INDEX IF NOT EXISTS idx_customer_files_customer_id ON customer_files(customer_id);',
                'CREATE INDEX IF NOT EXISTS idx_customer_files_admin_id ON customer_files(admin_id);',
                'CREATE INDEX IF NOT EXISTS idx_customer_files_cloudinary_id ON customer_files(cloudinary_id);',
                'CREATE INDEX IF NOT EXISTS idx_customer_files_active ON customer_files(is_active);',
                'CREATE INDEX IF NOT EXISTS idx_customer_files_upload_timestamp ON customer_files(upload_timestamp DESC);',
                'CREATE INDEX IF NOT EXISTS idx_customer_files_person_name ON customer_files(person_name);',
                'CREATE INDEX IF NOT EXISTS idx_customer_files_mobile_number ON customer_files(mobile_number);'
            ];

            for (const indexQuery of createIndexesQueries) {
                await this.pool.query(indexQuery);
            }

            // Create ML results table
            const createMLResultsTableQuery = `
                CREATE TABLE IF NOT EXISTS ml_results (
                    id SERIAL PRIMARY KEY,
                    customer_id VARCHAR(100) NOT NULL,
                    admin_id INTEGER NOT NULL,
                    person_name VARCHAR(200) NOT NULL,
                    mobile_number VARCHAR(20) NOT NULL,
                    individual_results JSONB NOT NULL,
                    overall_risk_assessment JSONB NOT NULL,
                    processing_summary JSONB NOT NULL,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES admins(id)
                );
            `;

            await this.pool.query(createMLResultsTableQuery);

            // Create admin decisions table
            const createDecisionsTableQuery = `
                CREATE TABLE IF NOT EXISTS admin_decisions (
                    id SERIAL PRIMARY KEY,
                    customer_id VARCHAR(100) NOT NULL,
                    ml_result_id INTEGER NOT NULL,
                    admin_id INTEGER NOT NULL,
                    decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'PENDING', 'REVIEW_REQUIRED')),
                    feedback TEXT,
                    risk_override BOOLEAN DEFAULT FALSE,
                    override_reason TEXT,
                    decision_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES admins(id),
                    FOREIGN KEY (ml_result_id) REFERENCES ml_results(id)
                );
            `;

            await this.pool.query(createDecisionsTableQuery);

            // Create indexes for new tables
            const mlIndexesQueries = [
                'CREATE INDEX IF NOT EXISTS idx_ml_results_customer_id ON ml_results(customer_id);',
                'CREATE INDEX IF NOT EXISTS idx_ml_results_admin_id ON ml_results(admin_id);',
                'CREATE INDEX IF NOT EXISTS idx_ml_results_processed_at ON ml_results(processed_at DESC);',
                'CREATE INDEX IF NOT EXISTS idx_admin_decisions_customer_id ON admin_decisions(customer_id);',
                'CREATE INDEX IF NOT EXISTS idx_admin_decisions_ml_result_id ON admin_decisions(ml_result_id);',
                'CREATE INDEX IF NOT EXISTS idx_admin_decisions_admin_id ON admin_decisions(admin_id);',
                'CREATE INDEX IF NOT EXISTS idx_admin_decisions_decision ON admin_decisions(decision);',
                'CREATE INDEX IF NOT EXISTS idx_admin_decisions_timestamp ON admin_decisions(decision_timestamp DESC);'
            ];

            for (const indexQuery of mlIndexesQueries) {
                await this.pool.query(indexQuery);
            }

            console.log('✅ ML results and admin decisions tables created successfully');

            return true;
        } catch (error) {
            console.error('Error creating/updating customer_files table:', error);
            return false;
        }
    }

    // Save file metadata
    async saveFileMetadata(fileData) {
        try {
            const query = `
                INSERT INTO customer_files (
                    customer_id, admin_id, person_name, mobile_number, original_filename, 
                    cloudinary_id, secure_url, file_size, file_hash, iv, file_type
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                fileData.customer_id,
                fileData.uploaded_by,
                fileData.person_name,
                fileData.mobile_number,
                fileData.original_filename,
                fileData.cloudinary_id,
                fileData.secure_url,
                fileData.file_size,
                fileData.file_hash,
                fileData.iv,
                fileData.file_type
            ];

            const result = await this.pool.query(query, values);
            return {
                success: true,
                file: result.rows[0]
            };
        } catch (error) {
            console.error('Error saving file metadata:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get files by customer ID
    async getFilesByCustomerId(customerId, adminId) {
        try {
            const query = `
                SELECT cf.*, a.username as uploaded_by_username, a.full_name as uploaded_by_name
                FROM customer_files cf
                JOIN admins a ON cf.admin_id = a.id
                WHERE cf.customer_id = $1 AND cf.is_active = true
                ORDER BY cf.upload_timestamp DESC
            `;

            const result = await this.pool.query(query, [customerId]);
            return {
                success: true,
                files: result.rows
            };
        } catch (error) {
            console.error('Error fetching files by customer ID:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get file by ID
    async getFileById(fileId, adminId) {
        try {
            const query = `
                SELECT cf.*, a.username as uploaded_by_username, a.full_name as uploaded_by_name
                FROM customer_files cf
                JOIN admins a ON cf.admin_id = a.id
                WHERE cf.id = $1 AND cf.is_active = true
            `;

            const result = await this.pool.query(query, [fileId]);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'File not found'
                };
            }

            return {
                success: true,
                file: result.rows[0]
            };
        } catch (error) {
            console.error('Error fetching file by ID:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delete file (soft delete)
    async deleteFile(fileId, adminId) {
        try {
            const query = `
                UPDATE customer_files 
                SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND is_active = true
                RETURNING *
            `;

            const result = await this.pool.query(query, [fileId]);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'File not found'
                };
            }

            return {
                success: true,
                file: result.rows[0]
            };
        } catch (error) {
            console.error('Error deleting file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get files uploaded by admin
    async getFilesByAdminId(adminId) {
        try {
            const query = `
                SELECT cf.*, a.username as uploaded_by_username, a.full_name as uploaded_by_name
                FROM customer_files cf
                JOIN admins a ON cf.admin_id = a.id
                WHERE cf.admin_id = $1 AND cf.is_active = true
                  AND cf.upload_timestamp >= NOW() - INTERVAL '24 hours'
                ORDER BY cf.upload_timestamp DESC
                LIMIT 100
            `;

            const result = await this.pool.query(query, [adminId]);
            return {
                success: true,
                files: result.rows
            };
        } catch (error) {
            console.error('Error fetching files by admin ID:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get file statistics
    async getFileStats(adminId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_files,
                    SUM(file_size) as total_size,
                    COUNT(DISTINCT customer_id) as unique_customers
                FROM customer_files 
                WHERE admin_id = $1 AND is_active = true
            `;

            const result = await this.pool.query(query, [adminId]);
            return {
                success: true,
                stats: result.rows[0]
            };
        } catch (error) {
            console.error('Error fetching file stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Save ML processing results
    async saveMLResults(mlData) {
        try {
            console.log('🔍 Attempting to save ML results with data:', {
                customer_id: mlData.customer_id,
                admin_id: mlData.admin_id,
                person_name: mlData.person_name,
                mobile_number: mlData.mobile_number,
                has_individual_results: !!mlData.individual_results,
                has_overall_assessment: !!mlData.overall_risk_assessment,
                overall_assessment_structure: mlData.overall_risk_assessment,
                overall_assessment_keys: mlData.overall_risk_assessment ? Object.keys(mlData.overall_risk_assessment) : 'No keys',
                risk_score_in_assessment: mlData.overall_risk_assessment?.overall_risk_score,
                has_processing_summary: !!mlData.processing_summary
            });

            const query = `
                INSERT INTO ml_results (
                    customer_id, admin_id, person_name, mobile_number,
                    individual_results, overall_risk_assessment, processing_summary
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                mlData.customer_id,
                mlData.admin_id,
                mlData.person_name,
                mlData.mobile_number,
                JSON.stringify(mlData.individual_results || []),
                JSON.stringify(mlData.overall_risk_assessment || {}),
                JSON.stringify(mlData.processing_summary || {})
            ];

            console.log('📝 Executing ML results insert query...');
            const result = await this.pool.query(query, values);
            
            console.log('✅ ML results saved successfully with ID:', result.rows[0].id);
            return {
                success: true,
                ml_result: result.rows[0]
            };
        } catch (error) {
            console.error('❌ Error saving ML results:', error.message);
            console.error('❌ Full error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Save admin decision
    async saveAdminDecision(decisionData) {
        try {
            const query = `
                INSERT INTO admin_decisions (
                    customer_id, ml_result_id, admin_id, decision, 
                    feedback, risk_override, override_reason
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                decisionData.customer_id,
                decisionData.ml_result_id,
                decisionData.admin_id,
                decisionData.decision,
                decisionData.feedback,
                decisionData.risk_override || false,
                decisionData.override_reason
            ];

            const result = await this.pool.query(query, values);
            return {
                success: true,
                decision: result.rows[0]
            };
        } catch (error) {
            console.error('Error saving admin decision:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get ML results by customer ID
    async getMLResultsByCustomerId(customerId) {
        try {
            const query = `
                SELECT ml.*, a.username as admin_username, a.full_name as admin_name,
                       ad.decision, ad.feedback, ad.decision_timestamp,
                       COALESCE(
                           (ml.overall_risk_assessment->>'overall_risk_score')::numeric, 
                           0
                       ) as overall_risk_score,
                       ml.overall_risk_assessment->>'overall_status' as overall_status,
                       ml.overall_risk_assessment->>'risk_category' as risk_category
                FROM ml_results ml
                JOIN admins a ON ml.admin_id = a.id
                LEFT JOIN admin_decisions ad ON ml.id = ad.ml_result_id
                WHERE ml.customer_id = $1
                ORDER BY ml.processed_at DESC
            `;

            const result = await this.pool.query(query, [customerId]);
            
            // Log the extracted data for debugging
            console.log('📊 ML results for customer', customerId, ':', result.rows.map(row => ({
                id: row.id,
                overall_risk_score: row.overall_risk_score,
                overall_status: row.overall_status,
                risk_category: row.risk_category,
                has_overall_assessment: !!row.overall_risk_assessment,
                raw_assessment: row.overall_risk_assessment // Show the actual JSON structure
            })));
            
            return {
                success: true,
                ml_results: result.rows
            };
        } catch (error) {
            console.error('Error fetching ML results:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get admin decision history
    async getAdminDecisionHistory(adminId) {
        try {
            const query = `
                SELECT ad.*, ml.customer_id, ml.person_name, ml.mobile_number,
                       ml.overall_risk_assessment->>'overall_risk_score' as risk_score,
                       ml.overall_risk_assessment->>'overall_status' as risk_status,
                       ml.processing_summary->>'total_files' as total_files
                FROM admin_decisions ad
                JOIN ml_results ml ON ad.ml_result_id = ml.id
                WHERE ad.admin_id = $1
                ORDER BY ad.decision_timestamp DESC
            `;

            const result = await this.pool.query(query, [adminId]);
            return {
                success: true,
                decisions: result.rows
            };
        } catch (error) {
            console.error('Error fetching admin decision history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get completed decisions (decisions that have been made)
    async getCompletedDecisions(adminId) {
        try {
            const query = `
                SELECT ad.*, ml.customer_id, ml.person_name, ml.mobile_number,
                       ml.overall_risk_assessment->>'overall_risk_score' as risk_score,
                       ml.overall_risk_assessment->>'overall_status' as risk_status,
                       ml.processing_summary->>'total_files' as total_files
                FROM admin_decisions ad
                JOIN ml_results ml ON ad.ml_result_id = ml.id
                WHERE ad.admin_id = $1 AND ad.decision IN ('APPROVED', 'REJECTED')
                ORDER BY ad.decision_timestamp DESC
            `;

            const result = await this.pool.query(query, [adminId]);
            return {
                success: true,
                decisions: result.rows
            };
        } catch (error) {
            console.error('Error fetching completed decisions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get pending decisions (no admin decision yet)
    async getPendingDecisions(adminId) {
        try {
            const query = `
                SELECT ml.*, a.username as admin_username, a.full_name as admin_name,
                       COALESCE(
                           (ml.overall_risk_assessment->>'overall_risk_score')::numeric, 
                           0
                       ) as overall_risk_score,
                       ml.overall_risk_assessment->>'overall_status' as overall_status,
                       ml.overall_risk_assessment->>'risk_category' as risk_category
                FROM ml_results ml
                JOIN admins a ON ml.admin_id = a.id
                LEFT JOIN admin_decisions ad ON ml.id = ad.ml_result_id
                WHERE ad.id IS NULL 
                  AND ml.processed_at >= NOW() - INTERVAL '24 hours'
                ORDER BY ml.processed_at DESC
                LIMIT 50
            `;

            const result = await this.pool.query(query);
            
            // Log the extracted data for debugging
            console.log('📊 Pending decisions with risk scores:', result.rows.map(row => ({
                customer_id: row.customer_id,
                person_name: row.person_name,
                overall_risk_score: row.overall_risk_score,
                overall_status: row.overall_status,
                risk_category: row.risk_category
            })));
            
            return {
                success: true,
                pending_decisions: result.rows
            };
        } catch (error) {
            console.error('Error fetching pending decisions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = File;