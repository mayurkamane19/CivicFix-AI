/**
 * CivicFix AI - Controlled Admin Account Seed Script
 * 
 * Securely provisions a municipal administrator account in MongoDB.
 * 
 * Recommended Usage (PowerShell):
 *   $env:ADMIN_NAME="Chief Municipal Officer"
 *   $env:ADMIN_EMAIL="admin@civicfix.gov"
 *   $env:ADMIN_PASSWORD="YourStrongPassword123!"
 *   npm run seed:admin
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
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

// Security Check: Warn if password was supplied directly on the command line
if (args.password) {
  console.warn(
    '⚠️ [SECURITY ADVISORY] Supplying credentials via command-line arguments can expose them in shell history and process monitors.'
  );
  console.warn('   For best practice, supply via environment variable ($env:ADMIN_PASSWORD="...").\n');
}

const adminName = (args.name || process.env.ADMIN_NAME || 'Municipal Administrator').trim();
const adminEmail = (args.email || process.env.ADMIN_EMAIL || 'admin@civicfix.gov').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || args.password || process.env.INITIAL_ADMIN_PASSWORD;
const shouldResetPassword = args['reset-password'] === true || process.env.ADMIN_RESET_PASSWORD === 'true';

const run = async () => {
  console.log('==================================================');
  console.log('🏛️  CivicFix AI: Municipal Admin Provisioning');
  console.log('==================================================');

  // 1. Validate Password Requirements
  if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.length < 8) {
    console.error('❌ Error: An admin password of at least 8 characters is required.');
    console.error('   Please provide it via environment variable:');
    console.error('     $env:ADMIN_PASSWORD="YourStrongPassword123!"; npm run seed:admin');
    process.exit(1);
  }

  if (adminPassword.length > 128) {
    console.error('❌ Error: Admin password exceeds maximum allowable length of 128 characters.');
    process.exit(1);
  }

  // 2. Validate Email Format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    console.error(`❌ Error: Invalid admin email format '${adminEmail}'.`);
    process.exit(1);
  }

  // 3. Check MongoDB Connection String
  if (!config.mongoUri) {
    console.error('❌ Error: MONGODB_URI is not configured in backend/.env');
    process.exit(1);
  }

  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(config.mongoUri);
    console.log('✓ Connected to database successfully.');

    // 4. Check if Admin User Already Exists
    const existingUser = await User.findOne({ email: adminEmail });

    if (existingUser) {
      if (existingUser.role !== 'admin') {
        console.log(`User exists with role '${existingUser.role}'. Promoting to 'admin'...`);
        existingUser.role = 'admin';
        if (shouldResetPassword) {
          existingUser.password = adminPassword;
          console.log('Resetting password for existing user...');
        }
        await existingUser.save();
        console.log(`✓ User ${adminEmail} successfully promoted to Municipal Administrator.`);
      } else if (shouldResetPassword) {
        existingUser.password = adminPassword;
        await existingUser.save();
        console.log(`✓ Admin user ${adminEmail} password successfully updated.`);
      } else {
        console.log(`ℹ️  Admin user already exists (${adminEmail}, ID: ${existingUser._id}).`);
        console.log('   Set ADMIN_RESET_PASSWORD="true" to update password.');
      }
    } else {
      // 5. Create New Admin Account
      const newAdmin = new User({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isActive: true
      });

      await newAdmin.save();
      console.log('✓ Municipal Administrator account successfully created:');
      console.log(`   Name:     ${newAdmin.name}`);
      console.log(`   Email:    ${newAdmin.email}`);
      console.log(`   Role:     ${newAdmin.role}`);
      console.log(`   ID:       ${newAdmin._id}`);
      console.log('   Security: Password hashed with bcrypt salt before persistence.');
    }

    console.log('==================================================');
    console.log('✓ Admin provisioning completed successfully.');
    console.log('==================================================');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Admin provisioning failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

run();
