// Test ML Backend connection
const axios = require('axios');
require('dotenv').config();

const ML_BACKEND_URL = process.env.ML_BACKEND_URL || 'https://ml-bnp-backend.onrender.com';

console.log('🧪 Testing ML Backend connection...');
console.log('🔗 ML Backend URL:', ML_BACKEND_URL);

async function testMLConnection() {
    try {
        console.log('📡 Attempting to connect to ML Backend...');
        
        const response = await axios.get(`${ML_BACKEND_URL}/`, {
            timeout: 10000 // 10 seconds timeout
        });
        
        console.log('✅ ML Backend connection successful!');
        console.log('📊 Response status:', response.status);
        console.log('📋 Response data:', response.data);
        
        return true;
    } catch (error) {
        console.error('❌ ML Backend connection failed:');
        console.error('🔍 Error details:', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText
        });
        
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Suggestion: Make sure your ML Backend server is running and accessible');
        } else if (error.code === 'ENOTFOUND') {
            console.log('💡 Suggestion: Check if the ML Backend URL is correct');
        } else if (error.code === 'ECONNABORTED') {
            console.log('💡 Suggestion: The ML Backend might be slow to respond (cold start)');
        }
        
        return false;
    }
}

// Run the test
testMLConnection().then(success => {
    if (success) {
        console.log('🎉 ML Backend is ready for use!');
        process.exit(0);
    } else {
        console.log('⚠️  ML Backend connection issues detected');
        console.log('🔧 Please check your ML Backend deployment');
        process.exit(1);
    }
});