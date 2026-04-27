/* ============================================
   ISAIAH AMOS — PORTFOLIO
   main.js  —  Frontend interactions
============================================ */

'use strict';

// ── NAV ──────────────────────────────────────
const header    = document.getElementById('header');
const hamburger = document.getElementById('hamburger');
const navMenu   = document.getElementById('nav-menu');
const navLinks  = document.querySelectorAll('.nav-link');

hamburger.addEventListener('click', () => {
  const isOpen = navMenu.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(isOpen));
  // Prevent page scroll when menu is open
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Close menu when a link is clicked
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

// Scroll shadow on header
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// Active link on scroll
const sections = document.querySelectorAll('section[id]');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));


// ── REVEAL ANIMATION ─────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger siblings within the same parent
      const siblings = entry.target.parentElement.querySelectorAll('.reveal');
      siblings.forEach((el, idx) => {
        el.style.transitionDelay = `${idx * 80}ms`;
      });
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


// ── PROJECTS (CMS-powered) ───────────────────
const projectGrid = document.getElementById('project-grid');

async function loadProjects() {
  try {
    const res  = await fetch('/api/projects');

    if (!res.ok) throw new Error('Failed to load projects');

    const data = await res.json();

    if (!data.projects || data.projects.length === 0) {
      projectGrid.innerHTML = `
        <p class="project-loading" style="color:var(--color-text-muted)">
          No projects yet. Check back soon.
        </p>`;
      return;
    }

    projectGrid.innerHTML = data.projects.map(p => `
      <article class="project-card reveal">
        <div class="project-img-wrap">
          <img
            src="${escapeHTML(p.imageUrl)}"
            alt="${escapeHTML(p.title)}"
            loading="lazy"
          >
          ${p.category ? `<span class="project-tag">${escapeHTML(p.category)}</span>` : ''}
        </div>
        <div class="project-body">
          <h3>${escapeHTML(p.title)}</h3>
          <p>${escapeHTML(p.description)}</p>
          ${p.liveUrl ? `
            <a href="${escapeHTML(p.liveUrl)}" class="project-link" target="_blank" rel="noopener noreferrer">
              View Project <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </a>` : ''}
        </div>
      </article>
    `).join('');

    // Observe newly injected cards
    projectGrid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  } catch (err) {
    projectGrid.innerHTML = `
      <p class="project-loading" style="color:var(--color-error)">
        Could not load projects. Please try again later.
      </p>`;
    console.error('Projects load error:', err);
  }
}

loadProjects();


// ── CONTACT FORM ─────────────────────────────
const form       = document.getElementById('contact-form');
const submitBtn  = document.getElementById('submit-btn');
const feedback   = document.getElementById('form-feedback');

// Simple sanitiser — prevents XSS when inserting into the DOM
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// Field validators — return an error string or empty string if valid
const validators = {
  name(val) {
    if (!val.trim())               return 'Name is required.';
    if (val.trim().length < 2)    return 'Name must be at least 2 characters.';
    if (val.trim().length > 100)  return 'Name is too long.';
    return '';
  },
  email(val) {
    if (!val.trim()) return 'Email is required.';
    // RFC 5322 simplified
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim())) return 'Enter a valid email address.';
    return '';
  },
  subject(val) {
    if (!val.trim())              return 'Subject is required.';
    if (val.trim().length < 3)   return 'Subject is too short.';
    if (val.trim().length > 150) return 'Subject is too long.';
    return '';
  },
  message(val) {
    if (!val.trim())               return 'Message is required.';
    if (val.trim().length < 10)    return 'Message must be at least 10 characters.';
    if (val.trim().length > 2000)  return 'Message is too long (max 2000 characters).';
    return '';
  }
};

function showFieldError(fieldName, message) {
  const input = form.querySelector(`[name="${fieldName}"]`);
  const errorEl = document.getElementById(`${fieldName}-error`);
  if (!input || !errorEl) return;
  if (message) {
    input.classList.add('error');
    errorEl.textContent = message;
  } else {
    input.classList.remove('error');
    errorEl.textContent = '';
  }
}

// Live validation
['name', 'email', 'subject', 'message'].forEach(fieldName => {
  const input = form.querySelector(`[name="${fieldName}"]`);
  if (!input) return;
  input.addEventListener('blur', () => {
    showFieldError(fieldName, validators[fieldName](input.value));
  });
  input.addEventListener('input', () => {
    if (input.classList.contains('error')) {
      showFieldError(fieldName, validators[fieldName](input.value));
    }
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous feedback
  feedback.className  = 'form-feedback';
  feedback.textContent = '';

  const fields   = ['name', 'email', 'subject', 'message'];
  let   hasError = false;

  const payload = {};

  fields.forEach(fieldName => {
    const input = form.querySelector(`[name="${fieldName}"]`);
    const err   = validators[fieldName](input.value);
    showFieldError(fieldName, err);
    if (err) hasError = true;
    payload[fieldName] = input.value.trim();
  });

  // Honeypot check (client-side, server also checks)
  const honey = form.querySelector('[name="_honey"]');
  if (honey && honey.value) return; // Bot detected, silently stop

  if (hasError) return;

  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = 'Sending…';

  try {
    const res  = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      feedback.className   = 'form-feedback success';
      feedback.textContent = data.message || 'Message sent! I\'ll get back to you soon.';
      form.reset();
      fields.forEach(f => showFieldError(f, ''));
    } else {
      feedback.className   = 'form-feedback error';
      feedback.textContent = data.message || 'Something went wrong. Please try again.';
    }
  } catch {
    feedback.className   = 'form-feedback error';
    feedback.textContent = 'Network error. Please check your connection and try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = 'Send Message';
  }
});


// ── FOOTER YEAR ──────────────────────────────
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
