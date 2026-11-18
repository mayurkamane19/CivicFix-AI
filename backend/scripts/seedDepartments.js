/**
 * CivicFix AI - Initial Municipal Departments Seeder
 * 
 * Safely provisions or updates the default municipal departments in MongoDB.
 * 
 * Usage (PowerShell):
 *   npm run seed:departments
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Department } from '../src/models/Department.js';
import { config } from '../src/config/env.js';

dotenv.config();

export const INITIAL_DEPARTMENTS = [
  {
    name: 'Road Maintenance',
    code: 'ROAD',
    description: 'Potholes, damaged asphalt, sidewalk collapses, road sign repairs, and urban street infrastructure.',
    isActive: true
  },
  {
    name: 'Sanitation',
    code: 'SAN',
    description: 'Garbage accumulation, illegal waste dumping, public bins, and citywide hygiene maintenance.',
    isActive: true
  },
  {
    name: 'Water Supply',
    code: 'WATER',
    description: 'Pipeline leakages, drinking water supply interruptions, contaminated water, and low pressure.',
    isActive: true
  },
  {
    name: 'Electrical Department',
    code: 'ELEC',
    description: 'Non-functional streetlights, hanging power cables, electrical hazards, and public grid issues.',
    isActive: true
  },
  {
    name: 'Drainage Department',
    code: 'DRAIN',
    description: 'Blocked storm drains, open sewer manholes, waterlogging, and urban flood prevention.',
    isActive: true
  },
  {
    name: 'General Maintenance',
    code: 'GEN',
    description: 'Public parks, community infrastructure, civic structures, and miscellaneous public hazards.',
    isActive: true
  }
];

export const seedDepartments = async () => {
  console.log('==================================================');
  console.log('🏢 CivicFix AI: Municipal Department Provisioning');
  console.log('==================================================');

  if (!config.mongoUri) {
    console.error('❌ Error: MONGODB_URI is not configured in backend/.env');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri);
    console.log('✓ Connected to database successfully.');

    let createdCount = 0;
    let existingCount = 0;

    for (const dept of INITIAL_DEPARTMENTS) {
      const existing = await Department.findOne({ code: dept.code });
      if (existing) {
        existingCount++;
        console.log(`ℹ️  Department [${dept.code}] "${existing.name}" already exists.`);
      } else {
        await Department.create(dept);
        createdCount++;
        console.log(`✓ Department [${dept.code}] "${dept.name}" created successfully.`);
      }
    }

    console.log('\n==================================================');
    console.log(`Summary: ${createdCount} created, ${existingCount} already present.`);
    console.log('==================================================');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Department seeding failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// If run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seedDepartments.js')) {
  seedDepartments();
}
