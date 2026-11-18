/**
 * CivicFix AI - Controlled Field Officer Provisioning Script
 * 
 * Securely provisions a municipal field officer account in MongoDB with assigned Department.
 * 
 * Recommended Usage (PowerShell):
 *   $env:OFFICER_NAME="Officer John Doe"
 *   $env:OFFICER_EMAIL="officer.road@civicfix.gov"
 *   $env:OFFICER_PASSWORD="YourStrongPassword123!"
 *   $env:OFFICER_DEPT_CODE="ROAD"
 *   npm run seed:officer
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Department } from '../src/models/Department.js';
import { config } from '../src/config/env.js';

dotenv.config();

// Parse CLI arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    acc[key] = value || true;
  }
  return acc;
}, {});

if (args.password) {
  console.warn(
    '⚠️ [SECURITY ADVISORY] Supplying credentials via command-line arguments can expose them in shell history and process monitors.'
  );
  console.warn('   For best practice, supply via environment variable ($env:OFFICER_PASSWORD="...").\n');
}

const officerName = (args.name || process.env.OFFICER_NAME || 'Municipal Field Officer').trim();
const officerEmail = (args.email || process.env.OFFICER_EMAIL || '').trim().toLowerCase();
const officerPassword = process.env.OFFICER_PASSWORD || args.password;
const deptCode = (args.dept || args.department || process.env.OFFICER_DEPT_CODE || '').trim().toUpperCase();
const shouldResetPassword = args['reset-password'] === true || process.env.OFFICER_RESET_PASSWORD === 'true';

const run = async () => {
  console.log('==================================================');
  console.log('👷 CivicFix AI: Municipal Officer Provisioning');
  console.log('==================================================');

  // 1. Validate Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!officerEmail || !emailRegex.test(officerEmail)) {
    console.error('❌ Error: A valid officer email address is required.');
    console.error('   Supply via $env:OFFICER_EMAIL="officer@civicfix.gov"');
    process.exit(1);
  }

  // 2. Validate Password Requirements
  if (!officerPassword || typeof officerPassword !== 'string' || officerPassword.length < 8) {
    console.error('❌ Error: An officer password of at least 8 characters is required.');
    console.error('   Supply via $env:OFFICER_PASSWORD="YourStrongPassword123!"');
    process.exit(1);
  }

  if (officerPassword.length > 128) {
    console.error('❌ Error: Password exceeds maximum allowable length of 128 characters.');
    process.exit(1);
  }

  // 3. Validate Department Code
  if (!deptCode) {
    console.error('❌ Error: A department code is required (e.g. ROAD, SAN, WATER, ELEC, DRAIN, GEN).');
    console.error('   Supply via $env:OFFICER_DEPT_CODE="ROAD"');
    process.exit(1);
  }

  if (!config.mongoUri) {
    console.error('❌ Error: MONGODB_URI is not configured in backend/.env');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri);
    console.log('✓ Connected to database successfully.');

    // 4. Verify Department exists and is active
    const department = await Department.findOne({ code: deptCode });
    if (!department) {
      console.error(`❌ Error: Department with code "${deptCode}" not found.`);
      console.error('   Run "npm run seed:departments" first or check existing departments.');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (!department.isActive) {
      console.error(`❌ Error: Department "${department.name}" (${deptCode}) is inactive. Cannot assign officer to inactive department.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // 5. Check if User Already Exists
    const existingUser = await User.findOne({ email: officerEmail });

    if (existingUser) {
      existingUser.role = 'officer';
      existingUser.department = department._id;
      existingUser.name = officerName;

      if (shouldResetPassword) {
        existingUser.password = officerPassword;
        console.log('Resetting password for existing officer...');
      }

      await existingUser.save();
      console.log(`✓ User ${officerEmail} successfully updated as Field Officer in department "${department.name}" (${deptCode}).`);
    } else {
      await User.create({
        name: officerName,
        email: officerEmail,
        password: officerPassword,
        role: 'officer',
        department: department._id,
        isActive: true
      });
      console.log(`✓ New Field Officer created successfully:`);
      console.log(`  Name:       ${officerName}`);
      console.log(`  Email:      ${officerEmail}`);
      console.log(`  Role:       officer`);
      console.log(`  Department: ${department.name} (${deptCode})`);
    }

    console.log('\n==================================================');
    console.log('Officer provisioning completed successfully.');
    console.log('==================================================');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Officer provisioning failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

run();
