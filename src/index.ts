import express from 'express';
import path from 'path';
import { config } from './config';
import { apiRouter } from './api/router';
import { startScheduler } from './scheduler/scheduler';
import { db } from './db';

const app = express();

app.use(express.json());

// API routes
app.use('/api', apiRouter);

// In production, serve the built React client
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

async function start() {
  // Run migrations automatically
  try {
    await db.migrate.latest();
    console.log('Database migrations complete');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  // Start scheduler
  startScheduler();

  // Start server
  app.listen(config.port, () => {
    console.log(`Crow server running on http://localhost:${config.port}`);
  });
}

start();
