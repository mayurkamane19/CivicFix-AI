import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { startSlaScheduler, stopSlaScheduler } from './services/slaMonitoringService.js';

const PORT = config.port;
const HOST = process.env.HOST || '0.0.0.0';

// Start Express HTTP Server
const server = app.listen(PORT, HOST, async () => {
  console.log('==================================================');
  console.log('  🏛️  CivicFix AI - Backend API Service (Phase 2)');
  console.log(`  🚀 Server running on: http://${HOST}:${PORT}`);
  console.log(`  🩺 Health check:      http://${HOST}:${PORT}/api/health`);
  console.log(`  🌱 Environment:       ${config.nodeEnv}`);
  console.log('==================================================');

  // Attempt database connection without crashing the server if it fails
  try {
    await connectDB();
    startSlaScheduler({ intervalMs: Number(process.env.SLA_MONITOR_INTERVAL_MS) || 60000 });
  } catch (error) {
    console.error(`[Server] Non-fatal database initialization error: ${error.message}`);
  }
});

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  stopSlaScheduler();

  // Close MongoDB connection if connected
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close();
      console.log('[Database] MongoDB connection closed gracefully.');
    } catch (err) {
      console.error('[Database] Error closing MongoDB connection:', err.message);
    }
  }

  // Close HTTP Server
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled rejections to prevent silent server aborts
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception thrown:', err);
});

export default server;
