const FileEncryption = require('../utils/encryption');
const fs = require('fs');
const path = require('path');

// Test the encryption system
async function testEncryption() {
    console.log('🔐 Testing AES-256-CBC Encryption System...\n');

    const encryption = new FileEncryption();

    // Test 1: Enhanced text encryption/decryption
    console.log('Test 1: Enhanced Text Encryption with .enc format');
    const testText = 'This is a test document for BNP Paribas file encryption system.';
    const textBuffer = Buffer.from(testText, 'utf8');

    console.log('Original text:', testText);
    console.log('Original buffer size:', textBuffer.length, 'bytes');

    // Encrypt
    const encryptResult = encryption.encrypt(textBuffer);
    if (!encryptResult.success) {
        console.error('❌ Encryption failed:', encryptResult.error);
        return;
    }

    console.log('✅ Encryption successful');
    console.log('Encrypted buffer size:', encryptResult.encryptedData.length, 'bytes');
    console.log('Original size:', encryptResult.originalSize, 'bytes');
    console.log('Encrypted size:', encryptResult.encryptedSize, 'bytes');
    console.log('IV (hex):', encryptResult.iv);
    
    // Test encryption detection
    console.log('Is encrypted:', encryption.isEncrypted(encryptResult.encryptedData));
    const metadata = encryption.getEncryptionMetadata(encryptResult.encryptedData);
    console.log('Encryption metadata:', metadata);

    // Decrypt
    const decryptResult = encryption.decrypt(encryptResult.encryptedData);
    if (!decryptResult.success) {
        console.error('❌ Decryption failed:', decryptResult.error);
        return;
    }

    const decryptedText = decryptResult.decryptedData.toString('utf8');
    console.log('✅ Decryption successful');
    console.log('Decrypted text:', decryptedText);
    console.log('Match original:', testText === decryptedText ? '✅ YES' : '❌ NO');

    // Test 2: File hash integrity
    console.log('\nTest 2: File Hash Integrity');
    const originalHash = encryption.generateFileHash(textBuffer);
    const decryptedHash = encryption.generateFileHash(decryptResult.decryptedData);
    
    console.log('Original hash:', originalHash);
    console.log('Decrypted hash:', decryptedHash);
    console.log('Hash integrity:', originalHash === decryptedHash ? '✅ VERIFIED' : '❌ FAILED');

    // Test 3: Large file simulation
    console.log('\nTest 3: Large File Simulation');
    const largeData = Buffer.alloc(10 * 1024 * 1024, 'A'); // 10MB of 'A' characters
    console.log('Large file size:', largeData.length, 'bytes (10MB)');

    const largeEncryptResult = encryption.encrypt(largeData);
    if (!largeEncryptResult.success) {
        console.error('❌ Large file encryption failed:', largeEncryptResult.error);
        return;
    }

    console.log('✅ Large file encryption successful');
    console.log('Encrypted size:', largeEncryptResult.encryptedData.length, 'bytes');

    const largeDecryptResult = encryption.decrypt(largeEncryptResult.encryptedData);
    if (!largeDecryptResult.success) {
        console.error('❌ Large file decryption failed:', largeDecryptResult.error);
        return;
    }

    console.log('✅ Large file decryption successful');
    console.log('Decrypted size:', largeDecryptResult.decryptedData.length, 'bytes');
    console.log('Large file integrity:', largeData.equals(largeDecryptResult.decryptedData) ? '✅ VERIFIED' : '❌ FAILED');

    // Test 4: Different file types simulation
    console.log('\nTest 4: Different File Types Simulation');
    
    // Simulate PDF header
    const pdfHeader = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj', 'utf8');
    const pdfResult = encryption.encrypt(pdfHeader);
    const pdfDecrypted = encryption.decrypt(pdfResult.encryptedData);
    console.log('PDF simulation:', pdfHeader.equals(pdfDecrypted.decryptedData) ? '✅ PASSED' : '❌ FAILED');

    // Simulate image header (JPEG)
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const jpegResult = encryption.encrypt(jpegHeader);
    const jpegDecrypted = encryption.decrypt(jpegResult.encryptedData);
    console.log('JPEG simulation:', jpegHeader.equals(jpegDecrypted.decryptedData) ? '✅ PASSED' : '❌ FAILED');

    // Test 5: IV uniqueness
    console.log('\nTest 5: IV Uniqueness Test');
    const ivs = new Set();
    for (let i = 0; i < 100; i++) {
        const result = encryption.encrypt(textBuffer);
        ivs.add(result.iv);
    }
    console.log('Generated 100 encryptions, unique IVs:', ivs.size);
    console.log('IV uniqueness:', ivs.size === 100 ? '✅ PASSED' : '❌ FAILED');

    // Test 6: .enc file format verification
    console.log('\nTest 6: .enc File Format Verification');
    const samplePdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj', 'utf8');
    const pdfEncrypted = encryption.encrypt(samplePdfContent);
    
    if (pdfEncrypted.success) {
        console.log('PDF encrypted successfully');
        console.log('Encrypted file starts with BNP_ENC_ signature:', 
                   pdfEncrypted.encryptedData.slice(0, 8).toString('utf8') === 'BNP_ENC_');
        
        // Simulate saving as .enc file
        const encFileName = 'sample_document.pdf.enc';
        console.log('Would save as:', encFileName);
        
        // Test decryption
        const pdfDecrypted = encryption.decrypt(pdfEncrypted.encryptedData);
        if (pdfDecrypted.success) {
            console.log('PDF decryption successful');
            console.log('Content matches:', samplePdfContent.equals(pdfDecrypted.decryptedData) ? '✅ YES' : '❌ NO');
        }
    }

    console.log('\n🎉 Enhanced Encryption System Test Complete!');
    console.log('🔐 Files are now encrypted with BNP_ENC_ signature');
    console.log('📁 Files will be saved with .enc extension on Cloudinary');
}

// Run the test
if (require.main === module) {
    testEncryption().catch(console.error);
}

module.exports = { testEncryption };