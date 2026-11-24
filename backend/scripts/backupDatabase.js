/**
 * CivicFix AI - Database Backup Utility
 * Exports all collections from the active MongoDB database to timestamped JSON archives.
 * Works seamlessly across local MongoDB and MongoDB Atlas staging/production clusters.
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

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civicfix_dev';

async function backup() {
  console.log('--- CivicFix AI Database Backup ---');
  console.log(`Connecting to database...`);
  
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  console.log(`Connected to database: ${dbName}`);

  const collections = await db.listCollections().toArray();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, `../backups/${dbName}_${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const manifest = {
    database: dbName,
    timestamp: new Date().toISOString(),
    collections: []
  };

  for (const colInfo of collections) {
    const colName = colInfo.name;
    // Skip internal system collections
    if (colName.startsWith('system.')) continue;

    const docs = await db.collection(colName).find({}).toArray();
    const filePath = path.join(backupDir, `${colName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');

    manifest.collections.push({
      name: colName,
      count: docs.length,
      file: `${colName}.json`
    });

    console.log(`  - Exported ${colName}: ${docs.length} documents`);
  }

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Backup completed successfully! Location: ${backupDir}`);
  
  await mongoose.disconnect();
}

backup().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
