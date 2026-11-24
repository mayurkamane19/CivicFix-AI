/**
 * CivicFix AI - Municipal Ward GeoJSON Boundary Importer
 *
 * Imports official municipal GeoJSON FeatureCollections into MongoDB.
 * Validates topology, coordinates, and properties according to RFC-7946.
 *
 * Usage:
 *   node scripts/importWardGeoJSON.js --file path/to/wards.geojson
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Ward } from '../src/models/Ward.js';
import { validateGeoJSONGeometry } from '../src/utils/geofencing.js';
import { config } from '../src/config/env.js';

dotenv.config();

export async function importWardGeoJSON(filePath) {
  if (!filePath) {
    console.error('Error: Missing --file argument. Usage: node importWardGeoJSON.js --file <path>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found at path: ${resolvedPath}`);
    process.exit(1);
  }

  let geojson;
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    geojson = JSON.parse(raw);
  } catch (err) {
    console.error(`Error parsing GeoJSON JSON: ${err.message}`);
    process.exit(1);
  }

  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    console.error('Error: Input GeoJSON must be a FeatureCollection with a features array.');
    process.exit(1);
  }

  const uri = config.mongoUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civicfix_dev';
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB for GeoJSON boundary import: ${uri.replace(/\/\/(.*?)@/, '//***:***@')}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const feature of geojson.features) {
    const props = feature.properties || {};
    const geom = feature.geometry;

    if (!geom) {
      console.warn(`  [SKIP] Feature without geometry skipped: ${JSON.stringify(props)}`);
      skipped++;
      continue;
    }

    const validation = validateGeoJSONGeometry(geom);
    if (!validation.isValid) {
      console.warn(`  [REJECT] Invalid geometry for ward "${props.name || 'unnamed'}": ${validation.error}`);
      skipped++;
      continue;
    }

    const wardCode = (props.code || props.wardCode || `WARD-${props.number || Date.now()}`).toUpperCase().trim();
    const wardName = props.name || `Ward ${props.number || wardCode}`;
    const wardNumber = Number(props.number) || Math.floor(100 + Math.random() * 800);

    const boundaryDoc = {
      type: geom.type,
      coordinates: geom.coordinates,
      description: props.description || `Official municipal boundary for ${wardName}`
    };

    const existing = await Ward.findOne({ code: wardCode });

    if (existing) {
      existing.name = wardName;
      existing.number = wardNumber;
      existing.boundaries = boundaryDoc;
      if (props.zone) existing.zone = props.zone;
      if (props.population) existing.population = props.population;
      if (props.areaKm2) existing.areaKm2 = props.areaKm2;
      existing.isActive = true;

      await existing.save();
      console.log(`  ✓ [UPDATED] Ward ${wardCode} (${wardName}) with ${geom.type} boundary`);
      updated++;
    } else {
      const newWard = new Ward({
        name: wardName,
        code: wardCode,
        number: wardNumber,
        zone: props.zone || 'Central Zone',
        boundaries: boundaryDoc,
        population: Number(props.population) || 50000,
        areaKm2: Number(props.areaKm2) || 10.0,
        isActive: true
      });

      await newWard.save();
      console.log(`  + [IMPORTED] New Ward ${wardCode} (${wardName}) with ${geom.type} boundary`);
      imported++;
    }
  }

  console.log(`\nImport Summary: ${imported} created, ${updated} updated, ${skipped} rejected.`);
  await mongoose.disconnect();
}

// CLI execution
if (process.argv[1]?.endsWith('importWardGeoJSON.js')) {
  const fileArgIndex = process.argv.indexOf('--file');
  const filePath = fileArgIndex !== -1 ? process.argv[fileArgIndex + 1] : process.argv[2];
  importWardGeoJSON(filePath);
}
