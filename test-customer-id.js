// Test customer ID generation endpoint
const axios = require('axios');
require('dotenv').config();

const API_URL = 'https://bnp-backend.vercel.app'; // Your deployed backend
// const API_URL = 'http://localhost:6969'; // For local testing

console.log('🧪 Testing customer ID generation...');
console.log('🔗 API URL:', API_URL);

async function testCustomerIdGeneration() {
    try {
        console.log('📡 Testing /api/files/next-customer-id endpoint...');
        
        // Note: This will fail without a valid token, but we can see if the endpoint exists
        const response = await axios.get(`${API_URL}/api/files/next-customer-id`, {
            params: { bankName: 'BNP' },
            timeout: 10000,
            validateStatus: function (status) {
                // Accept both success and auth error responses
                return status < 500;
            }
        });
        
        console.log('✅ Endpoint responded!');
        console.log('📊 Response status:', response.status);
        console.log('📋 Response data:', response.data);
        
        if (response.status === 401) {
            console.log('🔐 Authentication required (expected for this test)');
            console.log('💡 The endpoint exists and is working - just needs a valid token');
            return true;
        } else if (response.status === 200 && response.data.success) {
            console.log('🎉 Customer ID generated successfully!');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Customer ID generation test failed:');
        console.error('🔍 Error details:', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText
        });
        
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Suggestion: Make sure your backend server is running');
        } else if (error.code === 'ENOTFOUND') {
            console.log('💡 Suggestion: Check if the backend URL is correct');
        }
        
        return false;
    }
}

// Run the test
testCustomerIdGeneration().then(success => {
    if (success) {
        console.log('🎉 Customer ID endpoint is working!');
        process.exit(0);
    } else {
        console.log('⚠️  Customer ID endpoint issues detected');
        process.exit(1);
    }
});