async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Ocorreu um erro inesperado.');
  }
  return data;
}

function formatDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function currencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function showMessage(containerId, type, text) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = `message ${type}`;
  el.textContent = text;
  el.classList.remove('hidden');
}

function hideMessage(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.add('hidden');
}

async function getSession() {
  return fetchJSON('/api/auth/session');
}

async function logout() {
  await fetchJSON('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function initFadeAnimations() {
  const items = document.querySelectorAll('.fade-up');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.15 });

  items.forEach((item) => observer.observe(item));
}

document.addEventListener('DOMContentLoaded', initFadeAnimations);
