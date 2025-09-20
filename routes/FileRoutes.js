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

// ML Backend configuration
const ML_BACKEND_URL = process.env.ML_BACKEND_URL || 'http://127.0.0.1:5001';

// Function to send files to ML backend for processing with timeout
async function sendToMLBackend(files) {
    return new Promise(async (resolve) => {
        // Set a timeout to prevent hanging
        const timeoutId = setTimeout(() => {
            resolve({
                success: false,
                error: 'ML Backend timeout',
                details: 'ML processing took too long'
            });
        }, 120000); // 2 minutes timeout

        try {
            const formData = new FormData();

            // Add all files to form data
            files.forEach(file => {
                formData.append('files', file.buffer, {
                    filename: file.originalname,
                    contentType: file.mimetype
                });
            });

            const response = await axios.post(`${ML_BACKEND_URL}/process-files`, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                timeout: 100000, // 100 seconds timeout
            });

            clearTimeout(timeoutId);
            resolve({
                success: true,
                data: response.data
            });
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('ML Backend processing error:', error.message);
            resolve({
                success: false,
                error: error.message,
                details: error.response?.data || 'ML Backend unavailable'
            });
        }
    });
}

// Configure multer for file uploads (memory storage for encryption)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    // No limits - unlimited file size and count
    fileFilter: (req, file, cb) => {
        // Allow all file types but log them
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

// Upload multiple files for a customer
router.post('/upload/:customerId', verifyAdminToken, upload.array('files'), async (req, res) => {
    let responsesSent = false; // Flag to prevent duplicate responses

    try {
        const { customerId } = req.params;
        const { personName, mobileNumber } = req.body;
        const files = req.files;

        // Validation
        if (!files || files.length === 0) {
            if (!responsesSent) {
                responsesSent = true;
                return res.status(400).json({
                    success: false,
                    message: 'No files provided'
                });
            }
            return;
        }

        if (!customerId) {
            if (!responsesSent) {
                responsesSent = true;
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID is required'
                });
            }
            return;
        }

        if (!personName || !mobileNumber) {
            if (!responsesSent) {
                responsesSent = true;
                return res.status(400).json({
                    success: false,
                    message: 'Person name and mobile number are required'
                });
            }
            return;
        }

        // Validate mobile number format (basic validation)
        const mobileRegex = /^[+]?[\d\s\-\(\)]{10,15}$/;
        if (!mobileRegex.test(mobileNumber)) {
            if (!responsesSent) {
                responsesSent = true;
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid mobile number'
                });
            }
            return;
        }

        // No file count or size limit - allow unlimited uploads
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        console.log(`Processing ${files.length} files for customer ${customerId}, Person: ${personName}, Mobile: ${mobileNumber}`);
        console.log(`Total upload size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);

        // Send files to ML backend for processing
        console.log('📤 Sending files to ML backend for processing...');
        const mlProcessingResult = await sendToMLBackend(files);

        const uploadResults = [];
        const errors = [];
        let mlProcessingData = null;

        if (mlProcessingResult.success) {
            console.log('✅ ML processing completed successfully');
            mlProcessingData = mlProcessingResult.data;
            
            // Save ML results to database
            try {
                console.log('💾 Saving ML results to database...');
                const mlSaveResult = await fileModel.saveMLResults({
                    customer_id: customerId,
                    admin_id: req.admin.id,
                    person_name: personName,
                    mobile_number: mobileNumber,
                    individual_results: mlProcessingData.results || [],
                    overall_risk_assessment: mlProcessingData.overall_risk_assessment || {},
                    processing_summary: mlProcessingData.summary || {}
                });
                
                if (mlSaveResult.success) {
                    console.log('✅ ML results saved to database with ID:', mlSaveResult.ml_result.id);
                    mlProcessingData.ml_result_id = mlSaveResult.ml_result.id;
                    mlProcessingData.database_saved = true;
                } else {
                    console.log('⚠️ Failed to save ML results:', mlSaveResult.error);
                    mlProcessingData.database_saved = false;
                    mlProcessingData.save_error = mlSaveResult.error;
                }
            } catch (mlSaveError) {
                console.error('❌ Error saving ML results:', mlSaveError.message);
                mlProcessingData.database_saved = false;
                mlProcessingData.save_error = mlSaveError.message;
            }
        } else {
            console.log('⚠️ ML processing failed:', mlProcessingResult.error);
            errors.push({
                type: 'ml_processing',
                error: mlProcessingResult.error,
                details: mlProcessingResult.details
            });
        }

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                // Upload encrypted file to Cloudinary
                const uploadResult = await cloudinaryService.uploadEncryptedFile(
                    file.buffer,
                    file.originalname,
                    customerId,
                    req.admin.id
                );

                if (!uploadResult.success) {
                    errors.push({
                        filename: file.originalname,
                        error: uploadResult.error
                    });
                    continue;
                }

                // Add file type and person details
                uploadResult.data.file_type = file.mimetype;
                uploadResult.data.person_name = personName;
                uploadResult.data.mobile_number = mobileNumber;

                // Save file metadata to database with retry
                let saveResult;
                let retryCount = 0;
                const maxRetries = 3;

                while (retryCount < maxRetries) {
                    try {
                        saveResult = await fileModel.saveFileMetadata(uploadResult.data);
                        break; // Success, exit retry loop
                    } catch (dbError) {
                        retryCount++;
                        console.error(`Database save attempt ${retryCount} failed for ${file.originalname}:`, dbError.message);

                        if (retryCount >= maxRetries) {
                            saveResult = { success: false, error: `Database save failed after ${maxRetries} attempts` };
                        } else {
                            // Wait before retry
                            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                        }
                    }
                }

                if (saveResult && saveResult.success) {
                    uploadResults.push({
                        filename: file.originalname,
                        file_id: saveResult.file.id,
                        cloudinary_id: uploadResult.data.cloudinary_id,
                        file_size: uploadResult.data.file_size,
                        upload_timestamp: saveResult.file.upload_timestamp
                    });
                } else {
                    errors.push({
                        filename: file.originalname,
                        error: saveResult?.error || 'Failed to save file metadata'
                    });
                }

            } catch (error) {
                console.error(`Error processing file ${file.originalname}:`, error);
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
            }
        }

        // Send response only if not already sent
        if (!responsesSent) {
            responsesSent = true;
            res.json({
                success: true,
                message: `Processed ${files.length} files`,
                data: {
                    uploaded_files: uploadResults,
                    ml_processing: mlProcessingData,
                    errors: errors,
                    customer_id: customerId,
                    person_details: {
                        name: personName,
                        mobile_number: mobileNumber
                    },
                    uploaded_by: {
                        admin_id: req.admin.id,
                        username: req.admin.username,
                        full_name: req.admin.full_name
                    },
                    summary: {
                        total_files: files.length,
                        successful_uploads: uploadResults.length,
                        failed_uploads: errors.filter(e => e.type !== 'ml_processing').length,
                        ml_processing_success: mlProcessingResult.success
                    }
                }
            });
        }

    } catch (error) {
        console.error('File upload error:', error);
        if (!responsesSent) {
            responsesSent = true;
            res.status(500).json({
                success: false,
                message: 'File upload failed',
                error: error.message
            });
        }
    }
});

// Get files for a specific customer
router.get('/customer/:customerId', verifyAdminToken, async (req, res) => {
    try {
        const { customerId } = req.params;

        const result = await fileModel.getFilesByCustomerId(customerId, req.admin.id);

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
                files: result.files,
                total_files: result.files.length
            }
        });

    } catch (error) {
        console.error('Get customer files error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer files'
        });
    }
});

// Download and decrypt a specific file
router.get('/download/:fileId', verifyAdminToken, async (req, res) => {
    try {
        const { fileId } = req.params;

        // Get file metadata
        const fileResult = await fileModel.getFileById(fileId, req.admin.id);
        if (!fileResult.success) {
            return res.status(404).json({
                success: false,
                message: fileResult.message || 'File not found'
            });
        }

        const fileMetadata = fileResult.file;

        // Download and decrypt file from Cloudinary
        const downloadResult = await cloudinaryService.downloadAndDecryptFile(fileMetadata.cloudinary_id);
        if (!downloadResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to download and decrypt file'
            });
        }

        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.original_filename}"`);
        res.setHeader('Content-Type', fileMetadata.file_type || 'application/octet-stream');
        res.setHeader('Content-Length', downloadResult.decryptedData.length);

        // Send the decrypted file
        res.send(downloadResult.decryptedData);

    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({
            success: false,
            message: 'File download failed'
        });
    }
});

// Delete a file
router.delete('/:fileId', verifyAdminToken, async (req, res) => {
    try {
        const { fileId } = req.params;

        // Get file metadata first
        const fileResult = await fileModel.getFileById(fileId, req.admin.id);
        if (!fileResult.success) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const fileMetadata = fileResult.file;

        // Delete from database (soft delete)
        const deleteResult = await fileModel.deleteFile(fileId, req.admin.id);
        if (!deleteResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to delete file from database'
            });
        }

        // Delete from Cloudinary
        const cloudinaryDeleteResult = await cloudinaryService.deleteFile(fileMetadata.cloudinary_id);

        res.json({
            success: true,
            message: 'File deleted successfully',
            data: {
                file_id: fileId,
                filename: fileMetadata.original_filename,
                cloudinary_deleted: cloudinaryDeleteResult.success
            }
        });

    } catch (error) {
        console.error('File delete error:', error);
        res.status(500).json({
            success: false,
            message: 'File deletion failed'
        });
    }
});

// Get files uploaded by current admin
router.get('/my-uploads', verifyAdminToken, async (req, res) => {
    try {
        const result = await fileModel.getFilesByAdminId(req.admin.id);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: {
                files: result.files,
                total_files: result.files.length,
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    full_name: req.admin.full_name
                }
            }
        });

    } catch (error) {
        console.error('Get admin files error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin files'
        });
    }
});

// Get file upload statistics
router.get('/stats', verifyAdminToken, async (req, res) => {
    try {
        const result = await fileModel.getFileStats(req.admin.id);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            data: {
                statistics: result.stats,
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    full_name: req.admin.full_name
                }
            }
        });

    } catch (error) {
        console.error('Get file stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch file statistics'
        });
    }
});

// Debug endpoint to test ML backend connection
router.get('/test-ml-connection', verifyAdminToken, async (req, res) => {
    try {
        console.log('Testing ML backend connection...');
        const response = await axios.get(`${ML_BACKEND_URL}/`, { timeout: 5000 });

        res.json({
            success: true,
            message: 'ML backend connection successful',
            ml_backend_url: ML_BACKEND_URL,
            ml_response: response.data
        });
    } catch (error) {
        console.error('ML backend connection test failed:', error.message);
        res.json({
            success: false,
            message: 'ML backend connection failed',
            ml_backend_url: ML_BACKEND_URL,
            error: error.message,
            error_code: error.code
        });
    }
});

// Verify encryption status of a file
router.get('/verify-encryption/:fileId', verifyAdminToken, async (req, res) => {
    try {
        const { fileId } = req.params;

        // Get file metadata
        const fileResult = await fileModel.getFileById(fileId, req.admin.id);
        if (!fileResult.success) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const fileMetadata = fileResult.file;

        // Download encrypted file from Cloudinary (first few bytes only)
        const axios = require('axios');
        const response = await axios.get(fileMetadata.secure_url, {
            responseType: 'arraybuffer',
            headers: { 'Range': 'bytes=0-100' } // Only download first 100 bytes
        });
        const encryptedSample = Buffer.from(response.data);

        // Check encryption
        const FileEncryption = require('../utils/encryption');
        const encryption = new FileEncryption();
        const isEncrypted = encryption.isEncrypted(encryptedSample);
        const metadata = encryption.getEncryptionMetadata(encryptedSample);

        res.json({
            success: true,
            data: {
                file_id: fileId,
                filename: fileMetadata.original_filename,
                cloudinary_id: fileMetadata.cloudinary_id,
                is_encrypted: isEncrypted,
                encryption_metadata: metadata,
                file_info: {
                    size: fileMetadata.file_size,
                    type: fileMetadata.file_type,
                    upload_timestamp: fileMetadata.upload_timestamp
                }
            }
        });

    } catch (error) {
        console.error('Encryption verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify encryption',
            error: error.message
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

        // Check if ML result exists
        console.log(`🔍 Checking if ML result ID ${mlResultId} exists for customer ${customerId}...`);
        const mlCheckQuery = 'SELECT id, customer_id FROM ml_results WHERE id = $1';
        const mlCheckResult = await global.dbPool.query(mlCheckQuery, [mlResultId]);
        
        if (mlCheckResult.rows.length === 0) {
            // Get available ML results for this customer
            const availableQuery = 'SELECT id, customer_id, processed_at FROM ml_results WHERE customer_id = $1 ORDER BY processed_at DESC';
            const availableResults = await global.dbPool.query(availableQuery, [customerId]);
            
            return res.status(400).json({
                success: false,
                message: `ML result ID ${mlResultId} not found`,
                available_ml_results: availableResults.rows,
                suggestion: availableResults.rows.length > 0 ? 
                    `Use ML result ID: ${availableResults.rows[0].id}` : 
                    'No ML results found for this customer. Please upload and process files first.'
            });
        }

        // Save admin decision
        console.log(`💾 Saving admin decision: ${decision} for customer ${customerId}...`);
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

        console.log('✅ Admin decision saved successfully');
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
        console.error('❌ Admin decision error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save admin decision',
            error: error.message
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

// Debug endpoint to check database contents
router.get('/debug/database-status', verifyAdminToken, async (req, res) => {
    try {
        // Check ML results
        const mlQuery = 'SELECT id, customer_id, person_name, processed_at FROM ml_results ORDER BY id DESC LIMIT 10';
        const mlResults = await global.dbPool.query(mlQuery);
        
        // Check admin decisions
        const decisionQuery = 'SELECT id, customer_id, ml_result_id, decision, decision_timestamp FROM admin_decisions ORDER BY id DESC LIMIT 10';
        const decisionResults = await global.dbPool.query(decisionQuery);
        
        // Check customer files
        const filesQuery = 'SELECT id, customer_id, person_name, upload_timestamp FROM customer_files ORDER BY id DESC LIMIT 10';
        const filesResults = await global.dbPool.query(filesQuery);

        res.json({
            success: true,
            data: {
                ml_results: {
                    count: mlResults.rows.length,
                    records: mlResults.rows
                },
                admin_decisions: {
                    count: decisionResults.rows.length,
                    records: decisionResults.rows
                },
                customer_files: {
                    count: filesResults.rows.length,
                    records: filesResults.rows
                }
            }
        });

    } catch (error) {
        console.error('Database debug error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check database status',
            error: error.message
        });
    }
});

// Debug endpoint to manually save ML results for testing
router.post('/debug/save-ml-results/:customerId', verifyAdminToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const { personName, mobileNumber } = req.body;

        // Create sample ML results for testing
        const sampleMLData = {
            customer_id: customerId,
            admin_id: req.admin.id,
            person_name: personName || 'Test Person',
            mobile_number: mobileNumber || '+1234567890',
            individual_results: [
                { file: 'test1.pdf', risk_score: 30, status: 'Verified' },
                { file: 'test2.pdf', risk_score: 55, status: 'Flagged' }
            ],
            overall_risk_assessment: {
                overall_risk_score: 100,
                overall_status: 'REJECTED',
                risk_category: 'HIGH_RISK'
            },
            processing_summary: {
                total_files: 2,
                successful_processing: 2,
                failed_processing: 0
            }
        };

        console.log('🧪 Testing ML results save for customer:', customerId);
        const result = await fileModel.saveMLResults(sampleMLData);

        res.json({
            success: result.success,
            message: result.success ? 'Test ML results saved successfully' : 'Failed to save test ML results',
            data: result.success ? {
                ml_result_id: result.ml_result.id,
                customer_id: customerId,
                saved_data: sampleMLData
            } : null,
            error: result.error || null
        });

    } catch (error) {
        console.error('Debug ML save error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save test ML results',
            error: error.message
        });
    }
});

module.exports = router;