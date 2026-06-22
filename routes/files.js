const express = require('express');
const path = require('path');
const fs = require('fs');
const { projectQueries, fileQueries } = require('../lib/db');
const { authMiddleware } = require('../lib/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/files/:projectId
router.get('/:projectId', (req, res) => {
  const project = projectQueries.findById.get(req.params.projectId);
  if (!project || project.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = fileQueries.findByProject.all(project.id);
  res.json({ files });
});

// GET /api/files/:projectId/:filename
router.get('/:projectId/:filename', (req, res) => {
  const project = projectQueries.findById.get(req.params.projectId);
  if (!project || project.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const file = fileQueries.findByProjectAndFile.get(project.id, req.params.filename);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.json({ file });
});

// PUT /api/files/:projectId/:filename — manual save
router.put('/:projectId/:filename', (req, res) => {
  try {
    const project = projectQueries.findById.get(req.params.projectId);
    if (!project || project.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ error: 'Content required' });
    }

    fileQueries.upsert.run({
      project_id: project.id,
      filename: req.params.filename,
      content,
    });

    // Write to filesystem
    const sitePath = path.join(__dirname, '..', 'sites', req.user.username, project.slug);
    fs.mkdirSync(sitePath, { recursive: true });
    fs.writeFileSync(path.join(sitePath, req.params.filename), content);

    res.json({ message: 'File saved', filename: req.params.filename });
  } catch (err) {
    console.error('Save file error:', err);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// DELETE /api/files/:projectId/:filename
router.delete('/:projectId/:filename', (req, res) => {
  const project = projectQueries.findById.get(req.params.projectId);
  if (!project || project.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  fileQueries.delete.run(project.id, req.params.filename);

  // Remove from filesystem
  const sitePath = path.join(__dirname, '..', 'sites', req.user.username, project.slug);
  const filePath = path.join(sitePath, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ message: 'File deleted' });
});

module.exports = router;
