/**
 * CivicFix AI - Municipal Wards Seeder
 *
 * Safely provisions standard municipal administrative wards in MongoDB.
 *
 * Usage (PowerShell):
 *   npm run seed:wards
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Ward } from '../src/models/Ward.js';
import { Department } from '../src/models/Department.js';
import { config } from '../src/config/env.js';

dotenv.config();

export const INITIAL_WARDS = [
  {
    name: 'Ward 1 - Central Civic Centre',
    code: 'WARD-01',
    number: 1,
    description: 'Central administrative and commercial district covering municipal headquarters and civic square.',
    zone: 'Central Zone',
    center: { latitude: 18.5204, longitude: 73.8567 },
    population: 45000,
    areaKm2: 8.5,
    isActive: true
  },
  {
    name: 'Ward 2 - North Heritage & Tech Corridor',
    code: 'WARD-02',
    number: 2,
    description: 'Northern zone including IT corridor, historical heritage sites, and major arterial transit routes.',
    zone: 'North Zone',
    center: { latitude: 18.5529, longitude: 73.8797 },
    population: 62000,
    areaKm2: 14.2,
    isActive: true
  },
  {
    name: 'Ward 3 - South Hillside & Residential',
    code: 'WARD-03',
    number: 3,
    description: 'Southern suburban residential sectors, watershed reservoirs, and regional green parks.',
    zone: 'South Zone',
    center: { latitude: 18.4892, longitude: 73.8542 },
    population: 58000,
    areaKm2: 12.0,
    isActive: true
  },
  {
    name: 'Ward 4 - East Riverfront & Industrial',
    code: 'WARD-04',
    number: 4,
    description: 'Eastern manufacturing hub, logistics parks, river drainage basin, and rail terminals.',
    zone: 'East Zone',
    center: { latitude: 18.5144, longitude: 73.9261 },
    population: 51000,
    areaKm2: 16.8,
    isActive: true
  },
  {
    name: 'Ward 5 - West University & Lake District',
    code: 'WARD-05',
    number: 5,
    description: 'Western educational campuses, tech institutions, urban lakes, and recreation grounds.',
    zone: 'West Zone',
    center: { latitude: 18.5308, longitude: 73.8291 },
    population: 49000,
    areaKm2: 10.4,
    isActive: true
  }
];

export async function seedWards() {
  const uri = config.mongoUri || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing from environment.');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected for ward provisioning.');

    // Fetch active departments to associate with all wards
    const activeDepartments = await Department.find({ isActive: true }).select('_id');
    const deptIds = activeDepartments.map((d) => d._id);

    for (const wardData of INITIAL_WARDS) {
      const existing = await Ward.findOne({ code: wardData.code });
      if (existing) {
        existing.name = wardData.name;
        existing.number = wardData.number;
        existing.description = wardData.description;
        existing.zone = wardData.zone;
        existing.center = wardData.center;
        existing.population = wardData.population;
        existing.areaKm2 = wardData.areaKm2;
        if (existing.assignedDepartments.length === 0 && deptIds.length > 0) {
          existing.assignedDepartments = deptIds;
        }
        await existing.save();
        console.log(`  ✓ Updated Ward: ${wardData.code} - ${wardData.name}`);
      } else {
        const newWard = new Ward({
          ...wardData,
          assignedDepartments: deptIds
        });
        await newWard.save();
        console.log(`  + Provisioned Ward: ${wardData.code} - ${wardData.name}`);
      }
    }

    console.log('Municipal wards provisioning complete.');
  } catch (err) {
    console.error('Ward provisioning error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1]?.endsWith('seedWards.js')) {
  seedWards();
}
