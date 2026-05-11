// ════════════════════════════════════════════════════
// FixMixAI Magic Mirror — Renderer Logic
// ════════════════════════════════════════════════════

const contentArea = document.getElementById('content-area');
const contentScroll = document.getElementById('content-scroll');
const emptyState = document.getElementById('empty-state');
const statusText = document.getElementById('status-text');
const statusTime = document.getElementById('status-time');
const btnRecapture = document.getElementById('btn-recapture');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const mirrorBody = document.getElementById('mirror-body');

let captureTimestamp = null;
let scrollPositionBeforeCapture = 0;

// ── RTL Detection ──
// Unicode ranges for RTL scripts: Hebrew, Arabic, Thaana, Syriac, etc.
const RTL_REGEX = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

function isRtlLine(text) {
  // Strip HTML tags for detection purposes
  const clean = text.replace(/<[^>]*>/g, '').trim();
  if (!clean) return false;
  // Check the first meaningful character
  return RTL_REGEX.test(clean.charAt(0));
}

// ── Content Rendering ──

function renderPlainText(text) {
  if (!text || !text.trim()) return;

  const lines = text.split('\n');
  const fragment = document.createDocumentFragment();

  lines.forEach((line) => {
    const div = document.createElement('div');
    div.className = 'text-line';

    if (!line.trim()) {
      div.classList.add('empty-line');
    } else {
      const direction = isRtlLine(line) ? 'rtl' : 'ltr';
      div.setAttribute('dir', direction);
      div.textContent = line;
    }

    fragment.appendChild(div);
  });

  contentScroll.innerHTML = '';
  contentScroll.appendChild(fragment);
}

function renderHtmlContent(html) {
  if (!html || !html.trim()) return;

  // Sanitize: remove scripts, event handlers
  const sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');

  contentScroll.innerHTML = sanitized;

  // Post-process: apply RTL direction to text nodes
  applyRtlToTextElements(contentScroll);
}

function applyRtlToTextElements(container) {
  // Walk through all leaf text-bearing elements and set direction
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        // Accept block-level elements that contain direct text
        const tag = node.tagName.toLowerCase();
        const blockTags = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'blockquote', 'span'];
        if (blockTags.includes(tag)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent || '';
    if (RTL_REGEX.test(text.trim().charAt(0))) {
      node.setAttribute('dir', 'rtl');
      node.style.textAlign = 'right';
    }
  }
}

function displayCapture(data) {
  // Save scroll position before replacing content
  scrollPositionBeforeCapture = contentScroll.scrollTop;

  // Try HTML first, fall back to plain text
  if (data.html && data.html.trim().length > 20) {
    renderHtmlContent(data.html);
  } else if (data.text && data.text.trim()) {
    renderPlainText(data.text);
  } else {
    // Nothing captured — show a message
    contentScroll.innerHTML = `
      <div class="text-line" dir="rtl" style="color: var(--text-muted); text-align: center; padding-top: 40px;">
        לא נמצא טקסט בלוח ההעתקה
        <br><span style="direction: ltr; display: block; margin-top: 8px;">No text found on the clipboard</span>
      </div>
    `;
    return;
  }

  // Show content area, hide empty state
  emptyState.style.display = 'none';
  contentArea.style.display = 'block';

  // Flash animation
  mirrorBody.classList.remove('capture-flash');
  void mirrorBody.offsetWidth; // force reflow
  mirrorBody.classList.add('capture-flash');

  // Update timestamp
  captureTimestamp = Date.now();
  updateTimestamp();

  // Restore scroll position (approximately)
  requestAnimationFrame(() => {
    contentScroll.scrollTop = scrollPositionBeforeCapture;
  });

  // Update status
  statusText.innerHTML = '<span class="status-dot active"></span> Text captured';
}

// ── Timestamp Updater ──
function updateTimestamp() {
  if (!captureTimestamp) {
    statusTime.textContent = '';
    return;
  }

  const elapsed = Math.floor((Date.now() - captureTimestamp) / 1000);

  if (elapsed < 5) {
    statusTime.textContent = 'Just now';
  } else if (elapsed < 60) {
    statusTime.textContent = `${elapsed}s ago`;
  } else {
    const minutes = Math.floor(elapsed / 60);
    statusTime.textContent = `${minutes}m ago`;
  }
}

// Update timestamp every 5 seconds
setInterval(updateTimestamp, 5000);

// ── Event Listeners ──

// Listen for text captured via global shortcut
window.mirrorAPI.onTextCaptured((data) => {
  displayCapture(data);
});

// Re-capture button
btnRecapture.addEventListener('click', async () => {
  statusText.innerHTML = '<span class="status-dot"></span> Reading clipboard…';
  const data = await window.mirrorAPI.readClipboard();
  displayCapture(data);
});

// Window controls
btnMinimize.addEventListener('click', () => window.mirrorAPI.minimize());
btnClose.addEventListener('click', () => window.mirrorAPI.close());

// ── Keyboard shortcuts inside the window ──
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+M — recapture (also caught globally, but handle locally too)
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    btnRecapture.click();
  }

  // Escape — minimize
  if (e.key === 'Escape') {
    window.mirrorAPI.minimize();
  }
});

// Allow text selection inside content area
contentScroll.addEventListener('mousedown', () => {
  contentScroll.style.userSelect = 'text';
});

console.log('[FixMixAI] Mirror renderer initialized.');
