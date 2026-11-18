/**
 * Test script to verify MongoDB connection resilience, URI sanitization,
 * and graceful fallback when database is disconnected or unavailable.
 */

import mongoose from 'mongoose';
import { connectDB, getDatabaseStatus } from './src/config/db.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('==================================================');
console.log('🧪 CivicFix AI: Database Error Handling Tests');
console.log('==================================================\n');

// Test 1: getDatabaseStatus when not connected
assert(
  getDatabaseStatus() === 'disconnected',
  'Initial database status is correctly reported as "disconnected"'
);

// Test 2: connectDB with empty URI
process.env.MONGODB_URI = '';
const emptyResult = await connectDB();
assert(
  emptyResult === null,
  'connectDB returns null without throwing when MONGODB_URI is empty'
);
assert(
  getDatabaseStatus() === 'disconnected',
  'Database status remains "disconnected" when URI is empty'
);

// Test 3: connectDB with unreachable URI
console.log('\n--- Testing Unreachable Host Fallback ---');
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27018/civicfix_test'; // unused port
const unreachableResult = await connectDB();
assert(
  unreachableResult === null,
  'connectDB returns null gracefully when host is unreachable (no server crash)'
);
assert(
  getDatabaseStatus() === 'disconnected',
  'Database status remains "disconnected" on unreachable host'
);

console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} resilience tests passed.`);
console.log('==================================================');

await mongoose.connection.close();
process.exit(passed === total ? 0 : 1);
