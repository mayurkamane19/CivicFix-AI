/**
 * CivicFix AI - Database Restore Utility
 * Restores collections from a timestamped backup directory into the active database or isolated staging database.
 * Usage:
 *   node backend/scripts/restoreDatabase.js [backup-folder-name] [target-database-name-or-uri]
 * Examples:
 *   node backend/scripts/restoreDatabase.js latest civicfix_staging
 *   node backend/scripts/restoreDatabase.js civicfix_dev_2026-11-21T10-31-06-273Z civicfix_staging
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

let baseUri = process.env.MONGODB_RESTORE_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civicfix_dev';

async function restore() {
  console.log('==================================================');
  console.log('🔄 CivicFix AI: Database Restore Utility');
  console.log('==================================================\n');

  const backupsRoot = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupsRoot)) {
    console.error('Error: No backups directory found at backend/backups/');
    process.exit(1);
  }

  const targetBackupArg = process.argv[2];
  const targetDbArg = process.argv[3] || process.env.TARGET_DB;

  let backupDir;
  if (targetBackupArg && targetBackupArg !== 'latest') {
    backupDir = path.isAbsolute(targetBackupArg) ? targetBackupArg : path.join(backupsRoot, targetBackupArg);
  } else {
    // Pick the most recent backup
    const entries = fs.readdirSync(backupsRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
      .reverse();

    if (entries.length === 0) {
      console.error('Error: No backup archives found in backend/backups/');
      process.exit(1);
    }

    backupDir = path.join(backupsRoot, entries[0]);
  }

  if (!fs.existsSync(backupDir)) {
    console.error(`Error: Backup directory "${backupDir}" does not exist.`);
    process.exit(1);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Corrupt backup archive. manifest.json missing in "${backupDir}".`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Source Backup Archive: ${path.basename(backupDir)}`);
  console.log(`Source Database:       ${manifest.database}`);
  console.log(`Backup Timestamp:      ${manifest.timestamp}\n`);

  // Target Database Resolution
  let finalUri = baseUri;
  if (targetDbArg) {
    if (targetDbArg.startsWith('mongodb://') || targetDbArg.startsWith('mongodb+srv://')) {
      finalUri = targetDbArg;
    } else {
      // Replace database name in connection string
      finalUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/${targetDbArg}$2`);
    }
  }

  console.log(`Attempting connection to target database...`);
  await mongoose.connect(finalUri);
  const db = mongoose.connection.db;
  const targetDbName = db.databaseName;
  console.log(`✓ Connected to Target Database: "${targetDbName}"\n`);

  console.log('--- Restoring Collections ---');
  const restorationSummary = [];

  for (const col of manifest.collections) {
    const filePath = path.join(backupDir, col.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️ Warning: File ${col.file} not found, skipping.`);
      continue;
    }

    const docs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (docs.length === 0) {
      console.log(`  - ${col.name}: 0 documents (empty in backup)`);
      restorationSummary.push({ collection: col.name, expected: 0, restored: 0, status: 'SKIPPED_EMPTY' });
      continue;
    }

    const collection = db.collection(col.name);
    let restoredCount = 0;

    for (const doc of docs) {
      // Cast _id back to ObjectId if 24-character hex string
      const targetId = (typeof doc._id === 'string' && mongoose.Types.ObjectId.isValid(doc._id))
        ? new mongoose.Types.ObjectId(doc._id)
        : doc._id;

      doc._id = targetId;

      // Handle common date field re-hydrations
      if (doc.createdAt && typeof doc.createdAt === 'string') doc.createdAt = new Date(doc.createdAt);
      if (doc.updatedAt && typeof doc.updatedAt === 'string') doc.updatedAt = new Date(doc.updatedAt);
      if (doc.submissionDate && typeof doc.submissionDate === 'string') doc.submissionDate = new Date(doc.submissionDate);

      await collection.replaceOne({ _id: targetId }, doc, { upsert: true });
      restoredCount++;
    }

    // Verify record count consistency in database
    const postCount = await collection.countDocuments();
    const isConsistent = restoredCount === col.count;

    console.log(`  ✓ Restored ${col.name}: ${restoredCount}/${col.count} documents (DB total: ${postCount})`);
    restorationSummary.push({
      collection: col.name,
      expected: col.count,
      restored: restoredCount,
      dbTotal: postCount,
      consistent: isConsistent
    });
  }

  console.log('\n==================================================');
  console.log('✓ Database Restore Verification Complete!');
  console.log(`Target Database: ${targetDbName}`);
  console.log(`Total Collections Processed: ${restorationSummary.length}`);
  console.log('==================================================\n');

  await mongoose.disconnect();
}

restore().catch((err) => {
  console.error('\n❌ Database Restore Failed:', err.message);
  process.exit(1);
});
