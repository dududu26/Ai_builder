const express = require('express');
const path = require('path');
const fs = require('fs');
const { projectQueries, fileQueries } = require('../lib/db');
const { authMiddleware } = require('../lib/auth');

const router = express.Router();

// All project routes require auth
router.use(authMiddleware);

// Slugify helper
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'untitled';
}

// Get project site path
function getSitePath(username, slug) {
  return path.join(__dirname, '..', 'sites', username, slug);
}

// GET /api/projects
router.get('/', (req, res) => {
  const projects = projectQueries.findByUser.all(req.user.id);
  res.json({ projects });
});

// POST /api/projects
router.post('/', (req, res) => {
  try {
    const { name, description, prompt } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name required' });
    }

    // Check limits
    const count = projectQueries.countByUser.get(req.user.id);
    const maxProjects = parseInt(process.env.MAX_PROJECTS_PER_USER) || 20;
    if (count.count >= maxProjects) {
      return res.status(429).json({ error: `Max ${maxProjects} projects reached` });
    }

    let slug = slugify(name);
    // Check uniqueness
    const existing = projectQueries.findByUserAndSlug.get(req.user.id, slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const result = projectQueries.create.run({
      user_id: req.user.id,
      name,
      slug,
      description: description || '',
      prompt: prompt || '',
    });

    const project = projectQueries.findById.get(result.lastInsertRowid);

    // Create project directory
    const sitePath = getSitePath(req.user.username, slug);
    fs.mkdirSync(sitePath, { recursive: true });

    res.status(201).json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = projectQueries.findById.get(req.params.id);
  if (!project || project.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }
  const files = fileQueries.findByProject.all(project.id);
  res.json({ project, files });
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const project = projectQueries.findById.get(req.params.id);
  if (!project || project.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const { name, description, is_public } = req.body;
  projectQueries.update.run(
    name || project.name,
    description !== undefined ? description : project.description,
    is_public !== undefined ? (is_public ? 1 : 0) : project.is_public,
    project.id
  );

  const updated = projectQueries.findById.get(project.id);
  res.json({ project: updated });
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const project = projectQueries.findById.get(req.params.id);
  if (!project || project.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Delete site files
  const sitePath = getSitePath(req.user.username, project.slug);
  fs.rmSync(sitePath, { recursive: true, force: true });

  projectQueries.delete.run(project.id);
  res.json({ message: 'Project deleted' });
});

module.exports = router;
