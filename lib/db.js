const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'webuilder.db');

// Ensure data dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ SCHEMA ============
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT DEFAULT '',
    prompt TEXT DEFAULT '',
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, slug)
  );

  CREATE TABLE IF NOT EXISTS project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    content TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, filename)
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
`);

// ============ USER QUERIES ============
const userQueries = {
  create: db.prepare(`
    INSERT INTO users (username, email, password_hash) VALUES (@username, @email, @password_hash)
  `),
  findByUsername: db.prepare(`SELECT * FROM users WHERE username = ?`),
  findByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  findById: db.prepare(`SELECT id, username, email, avatar, created_at FROM users WHERE id = ?`),
  update: db.prepare(`UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`),
};

// ============ PROJECT QUERIES ============
const projectQueries = {
  create: db.prepare(`
    INSERT INTO projects (user_id, name, slug, description, prompt) 
    VALUES (@user_id, @name, @slug, @description, @prompt)
  `),
  findById: db.prepare(`SELECT * FROM projects WHERE id = ?`),
  findByUserAndSlug: db.prepare(`SELECT * FROM projects WHERE user_id = ? AND slug = ?`),
  findByUser: db.prepare(`SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC`),
  update: db.prepare(`
    UPDATE projects SET name = ?, description = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  delete: db.prepare(`DELETE FROM projects WHERE id = ?`),
  countByUser: db.prepare(`SELECT COUNT(*) as count FROM projects WHERE user_id = ?`),
  countGenerationsToday: db.prepare(`
    SELECT COUNT(*) as count FROM projects 
    WHERE user_id = ? AND date(created_at) = date('now', 'localtime')
  `),
};

// ============ FILE QUERIES ============
const fileQueries = {
  upsert: db.prepare(`
    INSERT INTO project_files (project_id, filename, content, updated_at) 
    VALUES (@project_id, @filename, @content, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, filename) DO UPDATE SET 
      content = @content, updated_at = CURRENT_TIMESTAMP
  `),
  findByProject: db.prepare(`SELECT * FROM project_files WHERE project_id = ? ORDER BY filename`),
  findByProjectAndFile: db.prepare(`SELECT * FROM project_files WHERE project_id = ? AND filename = ?`),
  delete: db.prepare(`DELETE FROM project_files WHERE project_id = ? AND filename = ?`),
  deleteAll: db.prepare(`DELETE FROM project_files WHERE project_id = ?`),
};

module.exports = {
  db,
  userQueries,
  projectQueries,
  fileQueries,
};
