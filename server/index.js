'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const controlRoutes = require('./routes/controlRoutes');

const app = express();
const port = Number(process.env.PORT ?? 5000);

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

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`TVControl server listening on http://localhost:${port}`);
});
