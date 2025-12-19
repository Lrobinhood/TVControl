'use strict';

// Global error handlers to prevent unexpected exits
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, keep the server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, keep the server running
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const controlRoutes = require('./routes/controlRoutes');

const app = express();
const port = Number(process.env.PORT ?? 8000);

app.use(cors());
app.use(express.json());

app.use('/api', controlRoutes);

// Serve production build of the client when available
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/test', (_req, res) => {
  res.json({ message: 'Server is working', pid: process.pid });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`TVControl server listening on http://0.0.0.0:${port} (also http://localhost:${port})`);
  console.log('Server started successfully, PID:', process.pid);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try a different port.`);
  }
});

// Keep the process alive
setInterval(() => {
  // Keep-alive interval to prevent unexpected exit
}, 60000);
