const express = require('express');
const path = require('path');
const fs = require('fs');
const { projectQueries, fileQueries, db } = require('../lib/db');
const { authMiddleware } = require('../lib/auth');
const { generateWebsite, editCode } = require('../lib/ai');

const router = express.Router();
router.use(authMiddleware);

// POST /api/ai/generate/:projectId
router.post('/generate/:projectId', async (req, res) => {
  try {
    const project = projectQueries.findById.get(req.params.projectId);
    if (!project || project.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { prompt, model } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    // Rate limiting
    const genCount = projectQueries.countGenerationsToday.get(req.user.id);
    const maxGenerations = parseInt(process.env.MAX_GENERATIONS_PER_DAY) || 50;
    if (genCount.count >= maxGenerations) {
      return res.status(429).json({ error: `Max ${maxGenerations} generations per day reached` });
    }

    console.log(`Generating website for project "${project.name}" — prompt: "${prompt.substring(0, 100)}..."`);

    const html = await generateWebsite(prompt, model);

    // Save to database
    fileQueries.upsert.run({
      project_id: project.id,
      filename: 'index.html',
      content: html,
    });

    // Save to filesystem for hosting
    const sitePath = path.join(__dirname, '..', 'sites', req.user.username, project.slug);
    fs.mkdirSync(sitePath, { recursive: true });
    fs.writeFileSync(path.join(sitePath, 'index.html'), html);

    // Update project prompt
    projectQueries.update.run(project.name, project.description, project.is_public, project.id);

    res.json({
      message: 'Website generated successfully',
      file: { filename: 'index.html', content: html },
      url: `/${req.user.username}/${project.slug}`,
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// POST /api/ai/edit/:projectId
router.post('/edit/:projectId', async (req, res) => {
  try {
    const project = projectQueries.findById.get(req.params.projectId);
    if (!project || project.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { filename, instruction } = req.body;
    if (!filename || !instruction) {
      return res.status(400).json({ error: 'Filename and instruction required' });
    }

    // Get current file
    const file = fileQueries.findByProjectAndFile.get(project.id, filename);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    console.log(`Editing "${filename}" in project "${project.name}" — instruction: "${instruction.substring(0, 100)}..."`);

    const updatedHtml = await editCode(file.content, instruction);

    // Save
    fileQueries.upsert.run({
      project_id: project.id,
      filename,
      content: updatedHtml,
    });

    // Write to filesystem
    const sitePath = path.join(__dirname, '..', 'sites', req.user.username, project.slug);
    fs.mkdirSync(sitePath, { recursive: true });
    fs.writeFileSync(path.join(sitePath, filename), updatedHtml);

    res.json({
      message: 'File updated successfully',
      file: { filename, content: updatedHtml },
    });
  } catch (err) {
    console.error('Edit error:', err);
    res.status(500).json({ error: err.message || 'Edit failed' });
  }
});

module.exports = router;
