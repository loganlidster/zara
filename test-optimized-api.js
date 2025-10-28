/**
 * Test script for optimized event endpoints
 * Tests querying the specialized RTH tables
 */

import fetch from 'node-fetch';

const API_BASE = 'https://tradiac-api-941257247637.us-central1.run.app';

async function testQuery() {
  console.log('\n=== Testing /api/events/query with specialized tables ===\n');
  
  const params = new URLSearchParams({
    symbol: 'HIVE',
    method: 'EQUAL_MEAN',
    session: 'RTH',
    buyPct: '0.5',
    sellPct: '0.5',
    startDate: '2024-09-01',
    endDate: '2024-09-30'
  });

  try {
    const response = await fetch(`${API_BASE}/api/events/query?${params}`);
    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log(`\nTable used: ${data.tableName}`);
    console.log(`Events returned: ${data.eventCount}`);
    
    if (data.events && data.events.length > 0) {
      console.log('\nFirst event:', data.events[0]);
      console.log('Last event:', data.events[data.events.length - 1]);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testSummary() {
  console.log('\n=== Testing /api/events/summary with specialized tables ===\n');
  
  const params = new URLSearchParams({
    symbol: 'HIVE',
    method: 'EQUAL_MEAN',
    session: 'RTH',
    buyPct: '0.5',
    sellPct: '0.5',
    startDate: '2024-09-01',
    endDate: '2024-09-30'
  });

  try {
    const response = await fetch(`${API_BASE}/api/events/summary?${params}`);
    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testTopPerformers() {
  console.log('\n=== Testing /api/events/top-performers with specialized tables ===\n');
  
  const params = new URLSearchParams({
    startDate: '2024-09-01',
    endDate: '2024-09-30',
    limit: '10',
    session: 'RTH'
  });

  try {
    const response = await fetch(`${API_BASE}/api/events/top-performers?${params}`);
    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run all tests
async function runTests() {
  await testQuery();
  await testSummary();
  await testTopPerformers();
}

runTests();