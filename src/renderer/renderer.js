// ════════════════════════════════════════════════════
// FixMixAI Magic Mirror — Renderer Logic
// ════════════════════════════════════════════════════

const contentArea   = document.getElementById('content-area');
const contentScroll = document.getElementById('content-scroll');
const emptyState    = document.getElementById('empty-state');
const statusText    = document.getElementById('status-text');
const statusTime    = document.getElementById('status-time');
const btnRecapture  = document.getElementById('btn-recapture');
const btnWatch      = document.getElementById('btn-watch');
const btnPin        = document.getElementById('btn-pin');
const btnMaximize   = document.getElementById('btn-maximize');
const btnMinimize   = document.getElementById('btn-minimize');
const btnClose      = document.getElementById('btn-close');
const btnClear      = document.getElementById('btn-clear');
const mirrorBody    = document.getElementById('mirror-body');

let captureTimestamp = null;
let isMaximized      = false;
let watchActive      = false;

// ── RTL Detection ──
// Covers Hebrew, Arabic, Syriac, Thaana, and their presentation forms
const RTL_REGEX = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

// A line is RTL if it contains ANY Hebrew/Arabic character.
// This correctly handles lines that start with English, numbers, or
// punctuation but are primarily RTL content (e.g. "Phase 1: שלב ראשון").
function hasRtl(text) {
  return RTL_REGEX.test(text.replace(/<[^>]*>/g, ''));
}

// ── HTML Sanitization & Interactive Element Placeholders ──

function sanitizeHtml(html) {
  return html
    // Remove scripts
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove inline event handlers
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    // Strip non-http hrefs (javascript:, file://, etc.) for security
    .replace(/href=["'](?!https?:\/\/)[^"']*["']/gi, 'href="#"')
    // Replace buttons with readable placeholder
    .replace(/<button([^>]*)>([\s\S]*?)<\/button>/gi, (_, __, inner) => {
      const label = inner.replace(/<[^>]*>/g, '').trim() || 'button';
      return `<span class="interactive-placeholder">[ ${label} ]</span>`;
    })
    // Replace inputs with placeholder
    .replace(/<input([^>]*)>/gi, (_, attrs) => {
      const type  = (attrs.match(/type=["']([^"']+)["']/) || [])[1] || 'input';
      const ph    = (attrs.match(/placeholder=["']([^"']+)["']/) || [])[1] || '';
      return `<span class="interactive-placeholder">[ ${type}${ph ? ': ' + ph : ''} ]</span>`;
    })
    // Replace media/embed elements with placeholder
    .replace(/<(canvas|video|audio|iframe)([^>]*)(?:\/>|>[\s\S]*?<\/\1>)/gi, (_, tag) => {
      return `<div class="interactive-placeholder interactive-block">[ ${tag} element ]</div>`;
    })
    // Convert bare https:// URLs (not already inside href="...") to clickable links
    .replace(/(?<![="'(>])https?:\/\/[^\s<>"']+/g, (url) =>
      `<a href="${url}">${url}</a>`);
}

// ── RTL Post-Processing ──

function applyRtlToElements(container) {
  const blockTags = new Set([
    'p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'td', 'th', 'blockquote', 'span', 'table', 'tr',
  ]);

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      blockTags.has(node.tagName.toLowerCase())
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP,
  });

  let node;
  while ((node = walker.nextNode())) {
    if (hasRtl(node.textContent || '')) {
      node.setAttribute('dir', 'rtl');
      node.style.textAlign = 'right';
    }
  }

  // Fix lists: if the majority of items are RTL, force all to RTL.
  // This handles the case where one item starts with English but belongs
  // to an otherwise-RTL list.
  container.querySelectorAll('ul, ol').forEach((list) => {
    const items    = [...list.querySelectorAll('li')];
    if (items.length === 0) return;
    const rtlCount = items.filter((li) => li.getAttribute('dir') === 'rtl').length;
    if (rtlCount > items.length / 2) {
      list.setAttribute('dir', 'rtl');
      items.forEach((li) => {
        li.setAttribute('dir', 'rtl');
        li.style.textAlign = 'right';
      });
    }
  });

  // Fix tables: set RTL on table and thead/tbody when content is Hebrew
  container.querySelectorAll('table').forEach((table) => {
    if (hasRtl(table.textContent || '')) {
      table.setAttribute('dir', 'rtl');
      table.querySelectorAll('thead, tbody, tfoot').forEach((section) => {
        section.setAttribute('dir', 'rtl');
      });
    }
  });

  // Preserve centered headings from the source: add class so CSS keeps them centered
  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    if (h.style.textAlign === 'center' || h.getAttribute('align') === 'center') {
      h.classList.add('source-centered');
    }
  });
}

// ── User vs AI Detection ──
// Short plain text = likely a user message; long or structured = AI response.
function detectMessageType(html, text) {
  const hasBlockMarkup = /<(h[1-6]|ul|ol|pre|table|blockquote)/i.test(html);
  const cleanLen = (text || html.replace(/<[^>]*>/g, '')).trim().length;
  return (hasBlockMarkup || cleanLen > 200) ? 'ai' : 'user';
}

// ── Code Block Post-processing ──
// Wraps <pre><code> blocks in a container with a language label and copy button.
function enhanceCodeBlocks(wrapper) {
  wrapper.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;

    // Detect language from class (e.g. class="language-python")
    const langMatch = (code.className || '').match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : '';

    const container = document.createElement('div');
    container.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="code-lang-label">${lang || 'code'}</span>
      <button class="btn-copy-code" title="Copy code">Copy</button>
    `;
    header.querySelector('.btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(code.textContent || '').then(() => {
        const btn = header.querySelector('.btn-copy-code');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });

    pre.parentNode.insertBefore(container, pre);
    container.appendChild(header);
    container.appendChild(pre);

    // Apply syntax highlighting if hljs is loaded
    if (typeof hljs !== 'undefined') {
      code.removeAttribute('class'); // let hljs auto-detect language
      if (lang) code.className = `language-${lang}`;
      hljs.highlightElement(code);
    }
  });
}

// ── Block Builders ──

function buildHtmlBlock(html, type) {
  const wrapper = document.createElement('div');
  wrapper.className = `capture-block capture-block--${type}`;
  wrapper.innerHTML = sanitizeHtml(html);
  applyRtlToElements(wrapper);
  enhanceCodeBlocks(wrapper);
  return wrapper;
}

function buildPlainTextBlock(text, type) {
  const wrapper  = document.createElement('div');
  wrapper.className = `capture-block capture-block--${type}`;
  const fragment = document.createDocumentFragment();

  text.split('\n').forEach((line) => {
    const div = document.createElement('div');
    div.className = 'text-line';
    if (!line.trim()) {
      div.classList.add('empty-line');
    } else {
      div.setAttribute('dir', hasRtl(line) ? 'rtl' : 'ltr');
      div.textContent = line;
    }
    fragment.appendChild(div);
  });

  wrapper.appendChild(fragment);
  return wrapper;
}

// ── Append Mode ──
// Each capture is added BELOW the previous ones with a timestamp separator,
// matching the natural scroll behaviour of an AI chat window.

function appendCapture(data) {
  let block;
  const type = detectMessageType(data.html || '', data.text || '');

  if (data.html && data.html.trim().length > 20) {
    block = buildHtmlBlock(data.html, type);
  } else if (data.text && data.text.trim()) {
    block = buildPlainTextBlock(data.text, type);
  } else {
    block = document.createElement('div');
    block.className = 'capture-block capture-block--ai';
    block.innerHTML =
      '<div class="text-line" dir="rtl" style="color:var(--text-muted);padding:20px 0">' +
      'לא נמצא טקסט בלוח ההעתקה</div>';
  }

  // Separator between captures (not before the first one)
  if (contentScroll.children.length > 0) {
    const sep  = document.createElement('div');
    sep.className = 'capture-separator';
    const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    sep.innerHTML = `<span>${time}</span>`;
    contentScroll.appendChild(sep);
  }

  contentScroll.appendChild(block);

  // Reveal content area
  emptyState.style.display  = 'none';
  contentArea.style.display = 'block';

  // Scroll to bottom only if the user is near the bottom already
  const nearBottom =
    contentScroll.scrollHeight - contentScroll.scrollTop - contentScroll.clientHeight < 120;
  if (nearBottom) {
    requestAnimationFrame(() => { contentScroll.scrollTop = contentScroll.scrollHeight; });
  }

  // Flash border animation
  mirrorBody.classList.remove('capture-flash');
  void mirrorBody.offsetWidth; // force reflow
  mirrorBody.classList.add('capture-flash');

  captureTimestamp = Date.now();
  updateTimestamp();
  statusText.innerHTML = '<span class="status-dot active"></span> Text captured';
}

function clearCaptures() {
  contentScroll.innerHTML   = '';
  emptyState.style.display  = '';
  contentArea.style.display = 'none';
  captureTimestamp = null;
  updateTimestamp();
  // Reset source lock so the next copy from any app sets a new lock
  window.mirrorAPI.clearSourceLock();
  updateSourceLockDisplay(null);
  statusText.innerHTML = 'Waiting for capture…';
}

// ── Timestamp Updater ──
function updateTimestamp() {
  if (!captureTimestamp) { statusTime.textContent = ''; return; }
  const elapsed = Math.floor((Date.now() - captureTimestamp) / 1000);
  if      (elapsed < 5)  statusTime.textContent = 'Just now';
  else if (elapsed < 60) statusTime.textContent = `${elapsed}s ago`;
  else                   statusTime.textContent = `${Math.floor(elapsed / 60)}m ago`;
}
setInterval(updateTimestamp, 5000);

// ── Watch Mode helpers ──
function setWatchVisual(active) {
  watchActive = active;
  btnWatch.classList.toggle('active', active);
  if (active) {
    btnWatch.title = 'Watch Mode ON — monitoring all apps — click to stop';
    if (!captureTimestamp)
      statusText.innerHTML = '<span class="status-dot watch-dot"></span> Watching all apps…';
  } else {
    btnWatch.title = 'Watch Mode — auto-capture when you copy text';
    if (!captureTimestamp)
      statusText.innerHTML = '<span class="status-dot"></span> Waiting for capture…';
  }
}

function updateSourceLockDisplay(appName) {
  let indicator = document.getElementById('source-lock-indicator');
  if (!indicator) {
    indicator = document.createElement('span');
    indicator.id = 'source-lock-indicator';
    indicator.className = 'source-lock-indicator';
    statusText.parentNode.insertBefore(indicator, statusText.nextSibling);
  }
  if (appName) {
    indicator.textContent = `🔒 ${appName}`;
    indicator.title = `Locked to: ${appName} — click Clear × to unlock`;
    indicator.style.display = 'inline';
  } else {
    indicator.style.display = 'none';
  }
}

// ── Pin helpers ──
function setPinVisual(pinned) {
  btnPin.classList.toggle('active', pinned);
  btnPin.title = pinned
    ? 'Always on Top: ON — click to unpin'
    : 'Always on Top: OFF — click to pin';
}

// ── Event Listeners ──

// Global shortcut (Alt+Space) fired from main process
window.mirrorAPI.onTextCaptured((data) => appendCapture(data));

// Watch Mode status from clipboard bridge
window.mirrorAPI.onWatchStatus(({ active }) => setWatchVisual(active));

// Source lock notification: first copy after Watch Mode starts
window.mirrorAPI.onWatchSourceLocked((appName) => {
  updateSourceLockDisplay(appName);
  statusText.innerHTML = `<span class="status-dot watch-dot"></span> Locked to: ${appName}`;
});

// Intercept all link clicks — open in system browser, never navigate Electron window
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    if (href && href.startsWith('http')) {
      window.mirrorAPI.openExternal(href);
    }
  }
});

// Re-capture button
btnRecapture.addEventListener('click', async () => {
  statusText.innerHTML = '<span class="status-dot"></span> Reading clipboard…';
  const data = await window.mirrorAPI.readClipboard();
  appendCapture(data);
});

// Watch toggle
btnWatch.addEventListener('click', async () => {
  if (watchActive) {
    window.mirrorAPI.watchStop();
    setWatchVisual(false);
  } else {
    statusText.innerHTML = '<span class="status-dot"></span> Starting watch…';
    const result = await window.mirrorAPI.watchStart();
    if (!result || !result.ok) {
      const reason = result?.reason || 'Unknown error';
      statusText.innerHTML =
        `<span class="status-dot" style="background:var(--danger)"></span> ${reason}`;
    }
    // Positive visual update arrives via onWatchStatus when bridge sends READY
  }
});

// Pin toggle
btnPin.addEventListener('click', async () => {
  const newState = await window.mirrorAPI.togglePin();
  setPinVisual(newState);
});

// Maximize / Restore toggle (single button)
btnMaximize.addEventListener('click', () => {
  window.mirrorAPI.maximize();
  isMaximized = !isMaximized;
  btnMaximize.title = isMaximized ? 'Restore window' : 'Maximize';
});

// Minimize
btnMinimize.addEventListener('click', () => window.mirrorAPI.minimize());

// Close
btnClose.addEventListener('click', () => window.mirrorAPI.close());

// Clear all captures
if (btnClear) btnClear.addEventListener('click', clearCaptures);

// Keyboard shortcuts inside the Mirror window
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.mirrorAPI.minimize();
  if (e.ctrlKey && (e.key === 'Delete' || e.key === 'Backspace')) clearCaptures();
});

// Allow text selection in the content area
contentScroll.addEventListener('mousedown', () => {
  contentScroll.style.userSelect = 'text';
});

// ── Initialization ──
(async () => {
  const pinned = await window.mirrorAPI.getPinState();
  setPinVisual(pinned);

  const watchStatus = await window.mirrorAPI.getWatchStatus();
  if (watchStatus.active) {
    setWatchVisual(true);
    if (watchStatus.source) updateSourceLockDisplay(watchStatus.source);
  } else {
    // Eye button is ON by default — auto-start watch mode on every launch
    const result = await window.mirrorAPI.watchStart();
    if (result && result.ok) {
      // Visual update arrives via onWatchStatus when bridge sends READY
    } else {
      setWatchVisual(false);
      statusText.innerHTML =
        `<span class="status-dot" style="background:var(--danger)"></span> ${result?.reason || 'Watch mode unavailable'}`;
    }
  }
})();

console.log('[FixMixAI] Mirror renderer initialized.');
