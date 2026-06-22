// ==================== AI Web Builder — SPA ====================

const API = {
  token: localStorage.getItem('token'),

  async request(method, url, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (API.token) opts.headers['Authorization'] = `Bearer ${API.token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        API.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        renderAuth('login');
        throw new Error('Session expired');
      }
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  get(url) { return API.request('GET', url); },
  post(url, body) { return API.request('POST', url, body); },
  put(url, body) { return API.request('PUT', url, body); },
  delete(url) { return API.request('DELETE', url); },
};

// ==================== STATE ====================
const state = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  projects: [],
  currentProject: null,
  currentFile: null,
  files: [],
  codemirror: null,
  aiMode: 'generate', // 'generate' | 'edit'
};

// ==================== ROUTER ====================
function navigate(page, params = {}) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  // Check auth for protected routes
  if (page !== 'login' && page !== 'register' && !API.token) {
    renderAuth('login');
    return;
  }

  switch (page) {
    case 'login': renderAuth('login'); break;
    case 'register': renderAuth('register'); break;
    case 'dashboard': renderDashboard(); break;
    case 'editor': renderEditor(params.projectId); break;
    default: renderDashboard();
  }
}

// ==================== AUTH ====================
function renderAuth(mode) {
  const isLogin = mode === 'login';
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="emoji">🎀</div>
        <h1>AI Web Builder</h1>
        <p class="subtitle">${isLogin ? 'Welcome back!' : 'Create your account'}</p>
        <div class="error-msg" id="authError"></div>
        <form id="authForm">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="username" placeholder="Enter username" required minlength="3">
          </div>
          ${!isLogin ? `
          <div class="form-group">
            <label>Email (optional)</label>
            <input type="email" id="email" placeholder="you@example.com">
          </div>` : ''}
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="Min 6 characters" required minlength="6">
          </div>
          <button type="submit" class="btn-primary" id="authBtn">
            ${isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        <div class="auth-footer">
          ${isLogin
            ? `Don't have an account? <a href="#" onclick="navigate('register')">Register</a>`
            : `Already have an account? <a href="#" onclick="navigate('login')">Login</a>`
          }
        </div>
      </div>
    </div>
  `;

  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('authBtn');
    const errorEl = document.getElementById('authError');
    errorEl.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Loading...';

    try {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      const body = { username, password };
      if (!isLogin) {
        const email = document.getElementById('email').value.trim();
        if (email) body.email = email;
      }

      const data = await API.post(`/api/auth/${mode}`, body);

      API.token = data.token;
      state.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      navigate('dashboard');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = isLogin ? 'Login' : 'Register';
    }
  });
}

function logout() {
  API.token = null;
  state.user = null;
  state.projects = [];
  state.currentProject = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  navigate('login');
}

// ==================== DASHBOARD ====================
async function renderDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="main-layout">
      <div class="topbar">
        <div class="topbar-left">
          <span class="logo">🎀 <span>AI</span> Web Builder</span>
        </div>
        <div class="topbar-right">
          <span class="user-info">👤 ${state.user?.username || ''}</span>
          <button class="btn-sm" onclick="navigate('dashboard')">Dashboard</button>
          <button class="btn-sm btn-danger" onclick="logout()">Logout</button>
        </div>
      </div>
      <div class="dashboard" id="dashboardContent">
        <div class="loading-spinner"><div class="spinner"></div> Loading projects...</div>
      </div>
    </div>
  `;

  await loadProjects();
  renderProjectList();
}

async function loadProjects() {
  try {
    const data = await API.get('/api/projects');
    state.projects = data.projects;
  } catch (err) {
    console.error('Failed to load projects:', err);
    state.projects = [];
  }
}

function renderProjectList() {
  const content = document.getElementById('dashboardContent');
  const projects = state.projects;

  content.innerHTML = `
    <div class="dashboard-header">
      <h2>Your Projects (${projects.length})</h2>
      <button class="btn-new" onclick="showCreateDialog()">+ New Project</button>
    </div>
    ${projects.length === 0 ? `
      <div class="empty-state">
        <div class="icon">🚀</div>
        <h3>No projects yet</h3>
        <p>Create your first AI-powered website!</p>
        <button class="btn-new" onclick="showCreateDialog()">+ New Project</button>
      </div>
    ` : `
      <div class="project-grid">
        ${projects.map(p => `
          <div class="project-card" onclick="navigate('editor', {projectId: ${p.id}})">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.description || 'No description')}</p>
            <div class="meta">
              <span>📅 ${new Date(p.updated_at).toLocaleDateString()}</span>
            </div>
            <div class="url-preview" style="margin-top:8px">/${escapeHtml(state.user?.username)}/${escapeHtml(p.slug)}</div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function showCreateDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog">
      <h3>✨ Create New Project</h3>
      <form id="createForm">
        <div class="form-group">
          <label>Project Name *</label>
          <input type="text" id="projectName" placeholder="My Awesome Website" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="projectDesc" placeholder="What's this site about?"></textarea>
        </div>
        <div class="form-group">
          <label>Initial Prompt (optional, generate later)</label>
          <textarea id="projectPrompt" placeholder="e.g., A landing page for a coffee shop with dark theme..."></textarea>
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn-cancel" onclick="this.closest('.dialog-overlay').remove()">Cancel</button>
          <button type="submit" class="btn-primary" style="width:auto">Create</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDesc').value.trim();
    const prompt = document.getElementById('projectPrompt').value.trim();

    try {
      const data = await API.post('/api/projects', { name, description, prompt });
      overlay.remove();
      toast('Project created! 🎉', 'success');
      navigate('editor', { projectId: data.project.id });
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ==================== EDITOR ====================
async function renderEditor(projectId) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="main-layout">
      <div class="topbar">
        <div class="topbar-left">
          <span class="logo">🎀 <span>AI</span> Web Builder</span>
        </div>
        <div class="topbar-right">
          <span class="user-info">👤 ${state.user?.username || ''}</span>
          <button class="btn-sm" onclick="navigate('dashboard')">Dashboard</button>
          <button class="btn-sm btn-danger" onclick="logout()">Logout</button>
        </div>
      </div>
      <div class="editor-layout">
        <div class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <button class="back-btn" onclick="navigate('dashboard')" title="Back">←</button>
            <span class="project-name" id="sidebarProjectName">Loading...</span>
          </div>
          <div class="sidebar-section">
            <div class="section-title">Files</div>
            <ul class="file-list" id="fileList">
              <li>Loading...</li>
            </ul>
          </div>
          <div class="url-box" id="urlBox" style="display:none">
            <div class="label">🌐 Live URL</div>
            <div class="url" id="siteUrl"></div>
            <button class="copy-btn" onclick="copyUrl()">📋 Copy URL</button>
            <button class="copy-btn" style="margin-left:4px" onclick="openPreview()">🔗 Open</button>
          </div>
          <div class="sidebar-section">
            <button class="btn-sm btn-danger" style="width:100%;margin-top:8px" onclick="deleteProject()">🗑 Delete Project</button>
          </div>
        </div>
        <div class="editor-main">
          <div class="editor-top">
            <div class="editor-pane" id="editorPane">
              <div class="pane-header">
                <span id="editorFilename">index.html</span>
                <div class="actions">
                  <button class="save-btn" onclick="saveFile()" title="Ctrl+S">💾 Save</button>
                </div>
              </div>
              <div class="pane-content" id="editorContainer">
                <div class="loading-spinner"><div class="spinner"></div> Loading...</div>
              </div>
            </div>
            <div class="editor-pane" id="previewPane">
              <div class="pane-header">
                <span>👁 Preview</span>
                <div class="actions">
                  <button onclick="refreshPreview()">🔄 Refresh</button>
                  <button onclick="openPreview()">🔗 Open</button>
                </div>
              </div>
              <div class="pane-content" id="previewContainer">
                <iframe id="previewFrame" class="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
              </div>
            </div>
          </div>
          <div class="ai-bar">
            <div class="ai-mode-toggle">
              <button class="${state.aiMode === 'generate' ? 'active' : ''}" onclick="setAiMode('generate')">🆕 New</button>
              <button class="${state.aiMode === 'edit' ? 'active' : ''}" onclick="setAiMode('edit')">✏️ Edit</button>
            </div>
            <input type="text" id="aiPromptInput"
              placeholder="${state.aiMode === 'generate'
                ? 'Describe your website... e.g., portfolio site with dark theme and animated hero'
                : 'What should I change? e.g., make the header sticky, add a contact form'}">
            <button class="btn-ai generate" id="aiGenerateBtn" onclick="aiGenerate()">
              ${state.aiMode === 'generate' ? '🚀 Generate' : '✨ Edit Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load project data
  try {
    const data = await API.get(`/api/projects/${projectId}`);
    state.currentProject = data.project;
    state.files = data.files;

    document.getElementById('sidebarProjectName').textContent = data.project.name;

    // File list
    const fileList = document.getElementById('fileList');
    if (data.files.length === 0) {
      fileList.innerHTML = '<li style="color:var(--text-dim)">No files yet — generate content below 👇</li>';
    } else {
      fileList.innerHTML = data.files.map(f => `
        <li class="${f.filename === 'index.html' ? 'active' : ''}" onclick="openFile('${escapeAttr(f.filename)}')">
          <span class="file-icon">📄</span> ${escapeHtml(f.filename)}
        </li>
      `).join('');
    }

    // Show URL
    const urlBox = document.getElementById('urlBox');
    if (state.files.some(f => f.filename === 'index.html')) {
      urlBox.style.display = 'block';
      document.getElementById('siteUrl').textContent =
        `/${state.user.username}/${data.project.slug}`;
    }

    // Open first file or create empty editor
    if (data.files.length > 0) {
      state.currentFile = data.files[0];
      initEditor(data.files[0].content);
    } else {
      state.currentFile = { filename: 'index.html', content: '' };
      initEditor('');
    }

    updateEditorTitle();

  } catch (err) {
    toast('Failed to load project: ' + err.message, 'error');
    navigate('dashboard');
  }
}

// ==================== CODE EDITOR ====================
function initEditor(content) {
  const container = document.getElementById('editorContainer');
  container.innerHTML = '';

  state.codemirror = CodeMirror(container, {
    value: content || '',
    mode: 'htmlmixed',
    theme: 'monokai',
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2,
    indentWithTabs: false,
    autoCloseTags: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    extraKeys: {
      'Ctrl-S': () => saveFile(),
      'Cmd-S': () => saveFile(),
    },
  });

  state.codemirror.setSize('100%', '100%');
  updatePreview();
}

function updateEditorTitle() {
  const el = document.getElementById('editorFilename');
  if (el && state.currentFile) {
    el.textContent = state.currentFile.filename;
  }
}

async function openFile(filename) {
  if (!state.currentProject) return;

  try {
    const data = await API.get(`/api/files/${state.currentProject.id}/${encodeURIComponent(filename)}`);
    state.currentFile = data.file;
    state.codemirror.setValue(data.file.content);
    updateEditorTitle();
    updatePreview();

    // Highlight active file in sidebar
    document.querySelectorAll('.file-list li').forEach(li => {
      li.classList.toggle('active', li.textContent.trim().includes(filename));
    });
  } catch (err) {
    toast('Failed to open file: ' + err.message, 'error');
  }
}

async function saveFile() {
  if (!state.currentProject || !state.currentFile) return;

  const content = state.codemirror.getValue();
  try {
    await API.put(
      `/api/files/${state.currentProject.id}/${encodeURIComponent(state.currentFile.filename)}`,
      { content }
    );
    state.currentFile.content = content;
    updatePreview();
    toast('Saved! ✅', 'success');

    // Update URL box visibility
    if (state.currentFile.filename === 'index.html') {
      document.getElementById('urlBox').style.display = 'block';
    }
  } catch (err) {
    toast('Save failed: ' + err.message, 'error');
  }
}

// ==================== AI GENERATION ====================
async function aiGenerate() {
  if (!state.currentProject) return;

  const promptInput = document.getElementById('aiPromptInput');
  const prompt = promptInput.value.trim();
  if (!prompt) {
    toast('Please enter a prompt', 'error');
    return;
  }

  const btn = document.getElementById('aiGenerateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try {
    if (state.aiMode === 'generate') {
      // Full generation
      const data = await API.post(`/api/ai/generate/${state.currentProject.id}`, { prompt });

      // Update file state
      state.files = [{ filename: 'index.html', content: data.file.content }];
      state.currentFile = state.files[0];

      // Update editor
      state.codemirror.setValue(data.file.content);
      updateEditorTitle();

      // Update sidebar
      const fileList = document.getElementById('fileList');
      if (fileList) {
        fileList.innerHTML = `
          <li class="active" onclick="openFile('index.html')">
            <span class="file-icon">📄</span> index.html
          </li>`;
      }

      // Show URL
      const urlBox = document.getElementById('urlBox');
      if (urlBox) {
        urlBox.style.display = 'block';
        document.getElementById('siteUrl').textContent = data.url;
      }

      updatePreview();
      toast('Website generated! 🎉', 'success');
    } else {
      // Edit mode
      const data = await API.post(`/api/ai/edit/${state.currentProject.id}`, {
        filename: state.currentFile.filename,
        instruction: prompt,
      });

      state.currentFile.content = data.file.content;
      state.codemirror.setValue(data.file.content);
      updatePreview();
      toast('Code updated! ✨', 'success');
    }

    promptInput.value = '';
  } catch (err) {
    toast('Generation failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = state.aiMode === 'generate' ? '🚀 Generate' : '✨ Edit Code';
  }
}

function setAiMode(mode) {
  state.aiMode = mode;
  const input = document.getElementById('aiPromptInput');
  const btn = document.getElementById('aiGenerateBtn');
  const toggles = document.querySelectorAll('.ai-mode-toggle button');

  if (input) {
    input.placeholder = mode === 'generate'
      ? 'Describe your website... e.g., portfolio site with dark theme and animated hero'
      : 'What should I change? e.g., make the header sticky, add a contact form';
  }
  if (btn) {
    btn.textContent = mode === 'generate' ? '🚀 Generate' : '✨ Edit Code';
    btn.className = mode === 'generate' ? 'btn-ai generate' : 'btn-ai';
  }
  toggles.forEach(t => t.classList.toggle('active', t.textContent.includes(mode === 'generate' ? 'New' : 'Edit')));
}

// ==================== PREVIEW ====================
function updatePreview() {
  const frame = document.getElementById('previewFrame');
  if (!frame || !state.codemirror) return;

  const content = state.codemirror.getValue();
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Revoke old URL if exists
  if (frame._blobUrl) URL.revokeObjectURL(frame._blobUrl);
  frame._blobUrl = url;
  frame.src = url;
}

function refreshPreview() {
  updatePreview();
}

function openPreview() {
  if (!state.currentProject) return;
  const url = `/${state.user.username}/${state.currentProject.slug}`;
  window.open(url, '_blank');
}

function copyUrl() {
  if (!state.currentProject) return;
  const url = `${window.location.origin}/${state.user.username}/${state.currentProject.slug}`;
  navigator.clipboard.writeText(url).then(() => {
    toast('URL copied! 📋', 'success');
  });
}

// ==================== DELETE PROJECT ====================
async function deleteProject() {
  if (!state.currentProject) return;
  if (!confirm(`Delete "${state.currentProject.name}"? This cannot be undone.`)) return;

  try {
    await API.delete(`/api/projects/${state.currentProject.id}`);
    toast('Project deleted', 'success');
    navigate('dashboard');
  } catch (err) {
    toast('Delete failed: ' + err.message, 'error');
  }
}

// ==================== HELPERS ====================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function toast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    if (state.currentProject && state.codemirror) {
      e.preventDefault();
      saveFile();
    }
  }
});

// ==================== INIT ====================
if (API.token) {
  state.user = JSON.parse(localStorage.getItem('user') || 'null');
  navigate('dashboard');
} else {
  navigate('login');
}
