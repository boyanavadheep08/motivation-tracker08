const API = '/api';

function getToken() { return localStorage.getItem('token'); }
function getUser()  { return JSON.parse(localStorage.getItem('user') || '{}'); }
function logout()   { localStorage.clear(); window.location.href = '/'; }
function requireAuth() { if (!getToken()) window.location.href = '/'; }

async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(`${API}${endpoint}`, config);
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function renderNav(activePage) {
  const user = getUser();
  const initial = (user.username || 'U')[0].toUpperCase();
  const color = user.avatarColor || '#6366f1';
  const links = [
    { href: '/pages/dashboard.html', icon: '⚡', label: 'Dashboard',    id: 'dashboard' },
    { href: '/pages/goals.html',     icon: '🎯', label: 'Goals',        id: 'goals' },
    { href: '/pages/tasks.html',     icon: '✅', label: "Today's Work", id: 'tasks' },
    { href: '/pages/diary.html',     icon: '📖', label: 'Diary',        id: 'diary' },
    { href: '/pages/stats.html',     icon: '📊', label: 'Statistics',   id: 'stats' },
    { href: '/pages/settings.html',  icon: '⚙️', label: 'Settings',     id: 'settings' },
  ];
  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">🔥</div>
        <div class="sidebar-logo-text">Moti<span>track</span></div>
      </div>
      <div class="sidebar-user">
        <div class="avatar" style="background:${color}">${initial}</div>
        <div class="user-info">
          <div class="name">${user.username || 'User'}</div>
          <div class="streak">🔥 <span id="sidebarStreak">${user.streak || 0}</span> day streak</div>
        </div>
      </div>
      <div class="nav-links">
        <div class="nav-section-label">Navigation</div>
        ${links.map(l => `
          <a href="${l.href}" class="nav-link ${activePage === l.id ? 'active' : ''}">
            <span class="nav-icon">${l.icon}</span>${l.label}
          </a>`).join('')}
      </div>
      <div class="sidebar-bottom">
        <button class="logout-btn" onclick="logout()">
          <span class="nav-icon">🚪</span> Sign Out
        </button>
      </div>
    </aside>`;
}

function today() { return new Date().toISOString().split('T')[0]; }

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getProgressColor(pct) {
  if (pct >= 80) return '#6dfac8';
  if (pct >= 50) return '#7c6dfa';
  if (pct >= 25) return '#fac76d';
  return '#fa6d9a';
}

function getWeekDates() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}