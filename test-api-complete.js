// API Test Suite for Icarus Game Manager
// Run with: node test-api-complete.js

const baseURL = 'http://localhost:3000/api';

async function testEndpoint(method, endpoint, data = null) {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${baseURL}${endpoint}`, options);
    const responseData = await response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      parsedData = responseData;
    }

    console.log(`${method} ${endpoint}:`);
    console.log('  Status:', response.status);
    console.log('  Response:', typeof parsedData === 'string' ? parsedData.substring(0, 100) + '...' : parsedData);
    console.log();

    return {
      status: response.status,
      data: parsedData
    };
  } catch (error) {
    console.log(`${method} ${endpoint}:`);
    console.log('  Error:', error.message);
    console.log();
    return null;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('ICARUS GAME MANAGER API TEST SUITE');
  console.log('='.repeat(60));
  console.log();

  // Test OpenAPI Documentation
  console.log('📚 TESTING API DOCUMENTATION');
  console.log('-'.repeat(40));
  await testEndpoint('GET', '/docs');

  // Test Server Management
  console.log('🎮 TESTING SERVER MANAGEMENT');
  console.log('-'.repeat(40));
  await testEndpoint('GET', '/server/status');
  await testEndpoint('GET', '/server/stats');
  await testEndpoint('GET', '/server/config');

  // Test Mod Management
  console.log('🔧 TESTING MOD MANAGEMENT');
  console.log('-'.repeat(40));
  await testEndpoint('GET', '/mods');
  await testEndpoint('GET', '/mods/browse');

  // Test Backup Management
  console.log('💾 TESTING BACKUP MANAGEMENT');
  console.log('-'.repeat(40));
  await testEndpoint('GET', '/backups');

  // Test endpoints that require POST data (commented out to avoid side effects)
  console.log('⚠️  DESTRUCTIVE OPERATIONS (commented out for safety)');
  console.log('-'.repeat(40));
  console.log('  These endpoints require POST data and may affect the server:');
  console.log('  - POST /server/start');
  console.log('  - POST /server/stop');
  console.log('  - POST /server/restart');
  console.log('  - POST /server/force-kill');
  console.log('  - POST /logs/clear');
  console.log('  - POST /mods/download');
  console.log('  - POST /mods/install');
  console.log('  - POST /backups');
  console.log('  - POST /backups/restore');
  console.log('  - POST /backups/delete');
  console.log();

  console.log('='.repeat(60));
  console.log('API TEST SUITE COMPLETED');
  console.log('='.repeat(60));
  console.log();
  console.log('📖 View full API documentation at: http://localhost:3000/docs');
  console.log('🔍 Access OpenAPI spec at: http://localhost:3000/api/docs');
}

// Run the tests
runTests().catch(console.error);