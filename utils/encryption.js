const crypto = require('crypto');

class FileEncryption {
    constructor() {
        this.algorithm = 'aes-256-cbc';
        this.secretKey = process.env.ENCRYPTION_SECRET || 'your-32-character-secret-key-here!';
        // Use a more secure salt for key derivation
        this.salt = 'bnp-paribas-secure-salt-2025';
        // Ensure the key is exactly 32 bytes for AES-256
        this.key = crypto.scryptSync(this.secretKey, this.salt, 32);
        this.keyLength = 32; // AES-256 key length
        this.ivLength = 16;  // AES block size
    }

    // Encrypt file buffer with enhanced security
    encrypt(buffer) {
        try {
            // Generate cryptographically secure random IV
            const iv = crypto.randomBytes(this.ivLength);
            
            // Create cipher with AES-256-CBC
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            // Add file size header for integrity check
            const fileSizeHeader = Buffer.alloc(4);
            fileSizeHeader.writeUInt32BE(buffer.length, 0);
            
            // Encrypt: [file_size_header + original_buffer]
            const dataToEncrypt = Buffer.concat([fileSizeHeader, buffer]);
            
            const encrypted = Buffer.concat([
                cipher.update(dataToEncrypt),
                cipher.final()
            ]);

            // Create final encrypted file: [IV + encrypted_data]
            const encryptedFile = Buffer.concat([iv, encrypted]);
            
            // Add encryption signature at the beginning
            const signature = Buffer.from('BNP_ENC_', 'utf8'); // 8 bytes signature
            const finalEncryptedData = Buffer.concat([signature, encryptedFile]);

            return {
                success: true,
                encryptedData: finalEncryptedData,
                iv: iv.toString('hex'),
                originalSize: buffer.length,
                encryptedSize: finalEncryptedData.length
            };
        } catch (error) {
            console.error('Encryption error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Decrypt file buffer with enhanced security
    decrypt(encryptedBuffer) {
        try {
            // Verify encryption signature
            const signature = encryptedBuffer.slice(0, 8);
            const expectedSignature = Buffer.from('BNP_ENC_', 'utf8');
            
            if (!signature.equals(expectedSignature)) {
                throw new Error('Invalid encryption signature - file may be corrupted or not encrypted');
            }
            
            // Remove signature
            const encryptedFileData = encryptedBuffer.slice(8);
            
            // Extract IV and encrypted data
            const iv = encryptedFileData.slice(0, this.ivLength);
            const encryptedData = encryptedFileData.slice(this.ivLength);

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            
            // Decrypt the data
            const decryptedWithHeader = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);
            
            // Extract file size from header
            const fileSizeHeader = decryptedWithHeader.slice(0, 4);
            const originalFileSize = fileSizeHeader.readUInt32BE(0);
            
            // Extract original file data
            const decryptedData = decryptedWithHeader.slice(4, 4 + originalFileSize);

            return {
                success: true,
                decryptedData: decryptedData,
                originalSize: originalFileSize,
                decryptedSize: decryptedData.length
            };
        } catch (error) {
            console.error('Decryption error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate file hash for integrity verification
    generateFileHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    // Verify file integrity
    verifyFileIntegrity(buffer, expectedHash) {
        const actualHash = this.generateFileHash(buffer);
        return actualHash === expectedHash;
    }

    // Check if a buffer is encrypted with our system
    isEncrypted(buffer) {
        if (buffer.length < 8) return false;
        
        const signature = buffer.slice(0, 8);
        const expectedSignature = Buffer.from('BNP_ENC_', 'utf8');
        
        return signature.equals(expectedSignature);
    }

    // Get encryption metadata from encrypted file
    getEncryptionMetadata(encryptedBuffer) {
        try {
            if (!this.isEncrypted(encryptedBuffer)) {
                return { encrypted: false };
            }

            const encryptedFileData = encryptedBuffer.slice(8);
            const iv = encryptedFileData.slice(0, this.ivLength);
            
            return {
                encrypted: true,
                algorithm: this.algorithm,
                ivLength: this.ivLength,
                keyLength: this.keyLength,
                totalSize: encryptedBuffer.length,
                iv: iv.toString('hex')
            };
        } catch (error) {
            return { encrypted: false, error: error.message };
        }
    }
}

module.exports = FileEncryption;