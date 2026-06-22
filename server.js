require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const aiRoutes = require('./routes/ai');
const fileRoutes = require('./routes/files');
const { optionalAuth } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ============ API ROUTES ============
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ============ HOSTED SITES ============
// Serve generated sites at /{username}/{project-slug}
app.use('/:username/:slug',
  optionalAuth,
  (req, res, next) => {
    const { username, slug } = req.params;

    // Security: disallow path traversal
    if (username.includes('..') || slug.includes('..')) {
      return res.status(400).send('Invalid path');
    }

    const sitePath = path.join(__dirname, 'sites', username, slug);

    // Check if directory exists
    if (!fs.existsSync(sitePath)) {
      return next(); // pass to SPA
    }

    // Check for index.html
    const indexPath = path.join(sitePath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return next();
    }

    // Serve the generated site
    express.static(sitePath)(req, res, next);
  }
);

// ============ SPA FRONTEND ============
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't catch API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════╗
║   🎀 AI Web Builder v1.0.0         ║
║   Server: http://0.0.0.0:${PORT}       ║
║   Sites:  /{username}/{project}     ║
╚══════════════════════════════════════╝
  `);
});
