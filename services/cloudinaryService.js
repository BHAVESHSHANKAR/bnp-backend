const cloudinary = require('cloudinary').v2;
const FileEncryption = require('../utils/encryption');

class CloudinaryService {
    constructor() {
        // Configure Cloudinary
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        this.encryption = new FileEncryption();
    }

    // Upload encrypted file to Cloudinary
    async uploadEncryptedFile(fileBuffer, fileName, customerId, adminId) {
        try {
            // Generate file hash for integrity
            const originalHash = this.encryption.generateFileHash(fileBuffer);

            // Encrypt the file
            const encryptionResult = this.encryption.encrypt(fileBuffer);
            if (!encryptionResult.success) {
                throw new Error(`Encryption failed: ${encryptionResult.error}`);
            }

            // Upload encrypted file to Cloudinary with .enc extension
            const encryptedFileName = `${Date.now()}_${fileName}.enc`;
            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'raw', // For non-image files
                        folder: `customer_files/${customerId}`,
                        public_id: encryptedFileName,
                        tags: [`customer_${customerId}`, `admin_${adminId}`, 'encrypted', 'aes256cbc'],
                        context: {
                            original_filename: fileName,
                            encryption_algorithm: 'aes-256-cbc',
                            encrypted_at: new Date().toISOString(),
                            admin_id: adminId.toString()
                        }
                    },
                    (error, result) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(result);
                        }
                    }
                ).end(encryptionResult.encryptedData);
            });

            return {
                success: true,
                data: {
                    cloudinary_id: uploadResult.public_id,
                    secure_url: uploadResult.secure_url,
                    original_filename: fileName,
                    file_size: uploadResult.bytes,
                    upload_timestamp: uploadResult.created_at,
                    file_hash: originalHash,
                    iv: encryptionResult.iv,
                    customer_id: customerId,
                    uploaded_by: adminId
                }
            };
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Download and decrypt file from Cloudinary
    async downloadAndDecryptFile(cloudinaryId) {
        try {
            // Get file URL from Cloudinary
            const fileUrl = cloudinary.url(cloudinaryId, { resource_type: 'raw' });

            // Download the encrypted file
            const axios = require('axios');
            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const encryptedBuffer = Buffer.from(response.data);

            // Decrypt the file
            const decryptionResult = this.encryption.decrypt(encryptedBuffer);
            if (!decryptionResult.success) {
                throw new Error(`Decryption failed: ${decryptionResult.error}`);
            }

            return {
                success: true,
                decryptedData: decryptionResult.decryptedData
            };
        } catch (error) {
            console.error('Download and decrypt error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delete file from Cloudinary
    async deleteFile(cloudinaryId) {
        try {
            const result = await cloudinary.uploader.destroy(cloudinaryId, { resource_type: 'raw' });
            return {
                success: result.result === 'ok',
                result
            };
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get file info from Cloudinary
    async getFileInfo(cloudinaryId) {
        try {
            const result = await cloudinary.api.resource(cloudinaryId, { resource_type: 'raw' });
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('Get file info error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = CloudinaryService;