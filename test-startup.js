// Simple test to verify server can start without errors
const express = require('express');
const cors = require('cors');

console.log('🧪 Testing server startup...');

try {
    // Test basic Express setup
    const app = express();
    console.log('✅ Express initialized');

    // Test CORS
    app.use(cors());
    console.log('✅ CORS configured');

    // Test route imports
    const adminRoutes = require('./routes/AdminRoutes');
    const fileRoutes = require('./routes/FileRoutes');
    console.log('✅ Routes imported successfully');

    // Test route mounting
    app.use('/api/admin', adminRoutes);
    app.use('/api/files', fileRoutes);
    console.log('✅ Routes mounted successfully');

    console.log('🎉 Server startup test PASSED!');
    console.log('💡 Your server should now start without syntax errors.');
    
} catch (error) {
    console.error('❌ Server startup test FAILED:', error.message);
    console.error('🔧 Please fix the error above before starting the server.');
    process.exit(1);
}