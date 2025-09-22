// Test all backend endpoints
const axios = require('axios');
require('dotenv').config();

const API_URL = 'https://bnp-backend.vercel.app'; // Your deployed backend

console.log('🧪 Testing all backend endpoints...');
console.log('🔗 API URL:', API_URL);

const endpoints = [
    { method: 'GET', path: '/', name: 'Health Check' },
    { method: 'GET', path: '/ping', name: 'Ping' },
    { method: 'GET', path: '/health/db', name: 'Database Health' },
    { method: 'GET', path: '/api/files/next-customer-id?bankName=BNP', name: 'Customer ID Generation' },
    { method: 'POST', path: '/api/files/upload/BNP123', name: 'File Upload' },
    { method: 'GET', path: '/api/files/pending-decisions', name: 'Pending Decisions' },
    { method: 'GET', path: '/api/files/risk-statistics', name: 'Risk Statistics' }
];

async function testEndpoint(endpoint) {
    try {
        const config = {
            method: endpoint.method,
            url: `${API_URL}${endpoint.path}`,
            timeout: 10000,
            validateStatus: function (status) {
                // Accept any status code to see what the server returns
                return status < 600;
            }
        };

        // Add form data for upload test
        if (endpoint.path.includes('/upload/')) {
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('files', Buffer.from('test file content'), 'test.txt');
            config.data = formData;
            config.headers = formData.getHeaders();
        }

        const response = await axios(config);
        
        return {
            name: endpoint.name,
            method: endpoint.method,
            path: endpoint.path,
            status: response.status,
            statusText: response.statusText,
            success: response.status < 500,
            data: response.data,
            error: null
        };
    } catch (error) {
        return {
            name: endpoint.name,
            method: endpoint.method,
            path: endpoint.path,
            status: error.response?.status || 'NO_RESPONSE',
            statusText: error.response?.statusText || error.code,
            success: false,
            data: error.response?.data || null,
            error: {
                message: error.message,
                code: error.code
            }
        };
    }
}

async function runAllTests() {
    console.log('🚀 Starting endpoint tests...\n');
    
    const results = [];
    
    for (const endpoint of endpoints) {
        console.log(`📡 Testing ${endpoint.name}...`);
        const result = await testEndpoint(endpoint);
        results.push(result);
        
        if (result.success) {
            console.log(`✅ ${result.name}: ${result.status} ${result.statusText}`);
        } else {
            console.log(`❌ ${result.name}: ${result.status} ${result.statusText}`);
            if (result.error) {
                console.log(`   Error: ${result.error.message} (${result.error.code})`);
            }
        }
        console.log('');
    }
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log('='.repeat(50));
    
    const working = results.filter(r => r.success);
    const failing = results.filter(r => !r.success);
    const authRequired = results.filter(r => r.status === 401);
    const notFound = results.filter(r => r.status === 404);
    const serverError = results.filter(r => r.status >= 500);
    const networkError = results.filter(r => r.status === 'NO_RESPONSE');
    
    console.log(`✅ Working endpoints: ${working.length}/${results.length}`);
    console.log(`🔐 Auth required: ${authRequired.length}`);
    console.log(`❓ Not found (404): ${notFound.length}`);
    console.log(`🔥 Server errors (5xx): ${serverError.length}`);
    console.log(`🌐 Network errors: ${networkError.length}`);
    
    if (notFound.length > 0) {
        console.log('\n❓ Missing endpoints:');
        notFound.forEach(r => console.log(`   - ${r.method} ${r.path}`));
    }
    
    if (networkError.length > 0) {
        console.log('\n🌐 Network issues:');
        networkError.forEach(r => console.log(`   - ${r.name}: ${r.error?.message}`));
    }
    
    if (serverError.length > 0) {
        console.log('\n🔥 Server errors:');
        serverError.forEach(r => console.log(`   - ${r.name}: ${r.status} ${r.statusText}`));
    }
    
    console.log('\n💡 Recommendations:');
    if (notFound.length > 0) {
        console.log('   - Deploy your latest backend code with missing endpoints');
    }
    if (networkError.length > 0) {
        console.log('   - Check if your backend is running and accessible');
    }
    if (authRequired.length > 0) {
        console.log('   - Auth-protected endpoints are working (expected behavior)');
    }
    
    return results;
}

// Run the tests
runAllTests().then(results => {
    const hasNetworkIssues = results.some(r => r.status === 'NO_RESPONSE');
    const hasMissingEndpoints = results.some(r => r.status === 404);
    
    if (hasNetworkIssues || hasMissingEndpoints) {
        console.log('\n⚠️  Issues detected - please check your backend deployment');
        process.exit(1);
    } else {
        console.log('\n🎉 All endpoints are accessible!');
        process.exit(0);
    }
});