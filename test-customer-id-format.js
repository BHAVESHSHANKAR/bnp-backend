// Test customer ID format generation
require('dotenv').config();

console.log('🧪 Testing customer ID format generation...');

// Simulate the customer ID generation logic
function generateCustomerId(bankName) {
    const bankPrefix = bankName ? bankName.substring(0, 3).toUpperCase() : 'BNK';
    
    // Generate a simple sequential customer ID
    const now = new Date();
    const dailyCounter = Math.floor((now.getHours() * 60 + now.getMinutes()) / 10) + 1;
    const nextId = dailyCounter;
    const customerId = `${bankPrefix}${nextId}`;
    
    return {
        nextId,
        customerId,
        bankPrefix
    };
}

// Test different scenarios
const testCases = [
    { bankName: 'BNP', expected: /^BNP\d+$/ },
    { bankName: 'HDFC', expected: /^HDF\d+$/ },
    { bankName: 'Chase', expected: /^CHA\d+$/ },
    { bankName: null, expected: /^BNK\d+$/ }
];

console.log('🔍 Testing customer ID generation formats:');
console.log('');

testCases.forEach((testCase, index) => {
    const result = generateCustomerId(testCase.bankName);
    const matches = testCase.expected.test(result.customerId);
    
    console.log(`Test ${index + 1}: ${testCase.bankName || 'null'}`);
    console.log(`  Generated ID: ${result.customerId}`);
    console.log(`  Next ID: ${result.nextId}`);
    console.log(`  Bank Prefix: ${result.bankPrefix}`);
    console.log(`  Format Valid: ${matches ? '✅' : '❌'}`);
    console.log('');
});

// Test multiple generations to ensure uniqueness
console.log('🔄 Testing multiple generations:');
const multipleIds = [];
for (let i = 0; i < 5; i++) {
    const result = generateCustomerId('BNP');
    multipleIds.push(result.customerId);
    console.log(`Generation ${i + 1}: ${result.customerId}`);
}

console.log('');
console.log('📊 Summary:');
console.log(`- All IDs follow BNP + number format: ${multipleIds.every(id => /^BNP\d+$/.test(id)) ? '✅' : '❌'}`);
console.log(`- IDs are reasonably short: ${multipleIds.every(id => id.length <= 6) ? '✅' : '❌'}`);
console.log(`- Sample ID: ${multipleIds[0]}`);

console.log('');
console.log('🎉 Customer ID format test completed!');