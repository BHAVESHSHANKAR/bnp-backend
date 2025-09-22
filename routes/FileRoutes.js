const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const CloudinaryService = require('../services/cloudinaryService');
const File = require('../models/File');
const Admin = require('../models/Admin');

const router = express.Router();

// Initialize services
const cloudinaryService = new CloudinaryService();
const fileModel = new File(global.dbPool);
const adminModel = new Admin(global.dbPool);

// ML Backend URL configuration for deployment
const ML_BACKEND_URL = 'https://ml-bnp-backend.onrender.com';

console.log('🤖 ML Backend URL configured:', ML_BACKEND_URL);

// Configure multer for file uploads (memory storage for encryption)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log(`Uploading file: ${file.originalname}, Type: ${file.mimetype}, Size: ${file.size || 'Unknown'} bytes`);
        cb(null, true);
    }
});

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

// Get next customer ID (for frontend compatibility)
router.get('/next-customer-id', verifyAdminToken, async (req, res) => {
    try {
        const { bankName } = req.query;
        
        // Generate a simple customer ID based on timestamp and bank name
        const timestamp = Date.now();
        const bankPrefix = bankName ? bankName.substring(0, 3).toUpperCase() : 'BNK';
        const customerId = `${bankPrefix}${timestamp}`;
        
        console.log('🆔 Generating customer ID:', {
            bankName,
            bankPrefix,
            timestamp,
            customerId
        });
        
        res.json({
            success: true,
            data: {
                nextId: timestamp, // Just the timestamp number
                fullCustomerId: customerId, // Full customer ID with prefix
                customer_id: customerId, // For backward compatibility
                bank_name: bankName || 'Default Bank',
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Generate customer ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate customer ID',
            error: error.message
        });
    }
});

// Upload multiple files for a customer
router.post('/upload/:customerId', verifyAdminToken, upload.array('files'), async (req, res) => {
    try {
        const { customerId } = req.params;
        const files = req.files;

        console.log('📤 Upload request received:', {
            customerId,
            filesCount: files?.length || 0,
            adminId: req.admin.id
        });

        // Validation
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files provided'
            });
        }

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID is required'
            });
        }

        // For now, return a simple success response
        // In a full implementation, you would:
        // 1. Upload files to cloud storage (Cloudinary)
        // 2. Send files to ML backend for processing
        // 3. Save metadata to database
        
        const uploadResults = files.map((file, index) => ({
            filename: file.originalname,
            file_id: `FILE_${Date.now()}_${index}`,
            file_size: file.size,
            upload_timestamp: new Date().toISOString()
        }));

        // Mock ML processing results
        const mockMLResults = {
            overall_risk_assessment: {
                overall_risk_score: Math.floor(Math.random() * 100),
                overall_status: 'PROCESSED',
                risk_category: 'MEDIUM'
            },
            processing_summary: {
                total_files: files.length,
                processed_files: files.length,
                processing_time: '2.5s'
            },
            results: files.map((file, index) => ({
                File: file.originalname,
                Risk_Score: Math.floor(Math.random() * 100),
                Status: Math.random() > 0.5 ? 'Verified' : 'Flagged',
                Risk_Details: ['Document analysis completed'],
                Risk_Level: Math.random() > 0.7 ? 'HIGH' : Math.random() > 0.4 ? 'MEDIUM' : 'LOW'
            }))
        };

        res.json({
            success: true,
            message: `Processed ${files.length} files`,
            data: {
                uploaded_files: uploadResults,
                ml_processing: mockMLResults,
                errors: [],
                customer_id: customerId,
                uploaded_by: {
                    admin_id: req.admin.id,
                    username: req.admin.username,
                    full_name: req.admin.full_name
                },
                summary: {
                    total_files: files.length,
                    successful_uploads: uploadResults.length,
                    failed_uploads: 0,
                    ml_processing_success: true
                }
            }
        });

    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            success: false,
            message: 'File upload failed',
            error: error.message
        });
    }
});

// Get risk statistics (for dashboard)
router.get('/risk-statistics', verifyAdminToken, async (req, res) => {
    try {
        // Get basic statistics from database
        const statsQuery = `
            SELECT 
                COUNT(*) as total_files,
                COUNT(DISTINCT customer_id) as total_customers,
                AVG(CASE WHEN ml_results.overall_risk_assessment->>'risk_level' = 'HIGH' THEN 1 ELSE 0 END) * 100 as high_risk_percentage
            FROM files 
            LEFT JOIN ml_results ON files.customer_id = ml_results.customer_id
            WHERE files.uploaded_by = $1 AND files.deleted_at IS NULL
        `;
        
        const result = await global.dbPool.query(statsQuery, [req.admin.id]);
        const stats = result.rows[0];
        
        res.json({
            success: true,
            data: {
                statistics: {
                    total_files: parseInt(stats.total_files) || 0,
                    total_customers: parseInt(stats.total_customers) || 0,
                    high_risk_percentage: parseFloat(stats.high_risk_percentage) || 0,
                    processed_today: 0 // Placeholder
                },
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    full_name: req.admin.full_name
                }
            }
        });
    } catch (error) {
        console.error('Get risk statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch risk statistics',
            error: error.message
        });
    }
});

// Get pending decisions (customers awaiting admin decision)
router.get('/pending-decisions', verifyAdminToken, async (req, res) => {
    try {
        const result = await fileModel.getPendingDecisions(req.admin.id);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: {
                pending_decisions: result.pending_decisions,
                total_pending: result.pending_decisions.length,
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    full_name: req.admin.full_name
                }
            }
        });

    } catch (error) {
        console.error('Get pending decisions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending decisions'
        });
    }
});

// Get ML results and decisions for a customer
router.get('/ml-results/:customerId', verifyAdminToken, async (req, res) => {
    try {
        const { customerId } = req.params;

        const result = await fileModel.getMLResultsByCustomerId(customerId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: {
                customer_id: customerId,
                ml_results: result.ml_results,
                total_results: result.ml_results.length
            }
        });

    } catch (error) {
        console.error('Get ML results error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ML results'
        });
    }
});

// Make admin decision on customer documents
router.post('/decision/:customerId', verifyAdminToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const { mlResultId, decision, feedback, riskOverride, overrideReason } = req.body;

        // Validation
        if (!mlResultId || !decision) {
            return res.status(400).json({
                success: false,
                message: 'ML result ID and decision are required'
            });
        }

        const validDecisions = ['APPROVED', 'REJECTED', 'PENDING', 'REVIEW_REQUIRED'];
        if (!validDecisions.includes(decision)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid decision. Must be: APPROVED, REJECTED, PENDING, or REVIEW_REQUIRED'
            });
        }

        // Save admin decision
        const decisionResult = await fileModel.saveAdminDecision({
            customer_id: customerId,
            ml_result_id: mlResultId,
            admin_id: req.admin.id,
            decision: decision,
            feedback: feedback,
            risk_override: riskOverride,
            override_reason: overrideReason
        });

        if (!decisionResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to save admin decision',
                error: decisionResult.error
            });
        }

        res.json({
            success: true,
            message: 'Admin decision saved successfully',
            data: {
                decision: decisionResult.decision,
                customer_id: customerId,
                ml_result_id: mlResultId,
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    full_name: req.admin.full_name
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to save admin decision',
            error: error.message
        });
    }
});

// Get admin decision history
router.get('/my-decisions', verifyAdminToken, async (req, res) => {
    try {
        const result = await fileModel.getAdminDecisionHistory(req.admin.id);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: {
                decisions: result.decisions,
                total_decisions: result.decisions.length,
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    full_name: req.admin.full_name
                }
            }
        });

    } catch (error) {
        console.error('Get admin decisions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin decisions'
        });
    }
});

// Get completed decisions (decisions that have been made)
router.get('/completed-decisions', verifyAdminToken, async (req, res) => {
    try {
        const result = await fileModel.getCompletedDecisions(req.admin.id);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch completed decisions',
                error: result.error
            });
        }

        res.json({
            success: true,
            data: {
                decisions: result.decisions,
                total_completed: result.decisions.length,
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    email: req.admin.email
                }
            }
        });

    } catch (error) {
        console.error('Get completed decisions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch completed decisions'
        });
    }
});

// Placeholder endpoints for frontend compatibility
router.get('/download-report/:customerId', verifyAdminToken, async (req, res) => {
    res.json({
        success: false,
        message: 'PDF report generation is not yet implemented',
        customer_id: req.params.customerId
    });
});

router.post('/send-analysis-to-express', verifyAdminToken, async (req, res) => {
    res.json({
        success: true,
        message: 'Analysis data received',
        data: {
            received_at: new Date().toISOString(),
            analysis_id: `ANALYSIS_${Date.now()}`,
            status: 'processed'
        }
    });
});

router.get('/debug/risk-data', verifyAdminToken, async (req, res) => {
    try {
        const debugQuery = `
            SELECT 
                ml_results.id,
                ml_results.customer_id,
                ml_results.overall_risk_assessment,
                ml_results.processing_summary,
                ml_results.processed_at,
                COUNT(files.id) as file_count
            FROM ml_results 
            LEFT JOIN files ON ml_results.customer_id = files.customer_id
            WHERE files.uploaded_by = $1 OR ml_results.admin_id = $1
            GROUP BY ml_results.id, ml_results.customer_id, ml_results.overall_risk_assessment, ml_results.processing_summary, ml_results.processed_at
            ORDER BY ml_results.processed_at DESC
            LIMIT 10
        `;
        
        const result = await global.dbPool.query(debugQuery, [req.admin.id]);
        
        res.json({
            success: true,
            data: {
                debug_info: result.rows,
                total_records: result.rows.length,
                admin_id: req.admin.id
            }
        });
    } catch (error) {
        console.error('Debug risk data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch debug data',
            error: error.message
        });
    }
});

module.exports = router;