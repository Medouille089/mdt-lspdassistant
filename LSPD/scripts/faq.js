let currentUser = null;
let faqEditLock = null; 
let sortableCategoryInstance = null;
let sortableEntriesInstances = [];
async function initFAQ() {
    try {
        const res = await fetch('/api/user');
        if (res.ok) currentUser = await res.json();
    } catch {}
    ensureFAQStyles();
    await fetchEditLock();
    await renderFAQ();
}

async function fetchEditLock() {
    try {
        const res = await fetch('/api/faq/edit-lock');
        if (res.ok) faqEditLock = await res.json();
        else faqEditLock = null;
    } catch (e) { faqEditLock = null; }
}

async function acquireEditLock() {
    try {
        const res = await fetch('/api/faq/edit-lock', { method: 'POST' });
        if (res.ok) {
            faqEditLock = await res.json();
            await renderFAQ();
            return true;
        } else if (res.status === 409) {
            const body = await res.json();
            faqEditLock = body.current;
            alert('Le mode modification est déjà activé par ' + (faqEditLock?.ownerName || 'quelqu\'un'));
            return false;
        }
    } catch (e) {}
    return false;
}

async function releaseEditLock() {
    try {
        const res = await fetch('/api/faq/edit-lock', { method: 'DELETE' });
        if (res.ok) {
            faqEditLock = null;
            await renderFAQ();
            return true;
        }
    } catch (e) {}
    return false;
}

function setupUnloadRelease() {
    window.addEventListener('beforeunload', () => {
        try {
            if (!faqEditLock || !currentUser) return;
            if (faqEditLock.ownerId !== currentUser.id) return;
            const url = '/api/faq/edit-lock/release';
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url);
                return;
            }
            try { fetch(url, { method: 'POST', keepalive: true }); } catch (e) {}
        } catch (e) {}
    });
}

// call setup after init
setTimeout(setupUnloadRelease, 2000);

// Récupère la FAQ depuis l'API
async function fetchFAQ() {
    const res = await fetch('/api/faq');
    if (!res.ok) return [];
    return await res.json();
}

// Ajoute une entrée FAQ (command staff)
async function addFAQEntry(data) {
    const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.ok;
}

// Ajoute une catégorie (command staff)
async function addFAQCategory(name) {
    const res = await fetch('/api/faq/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    return res.ok;
}

// --- Tiny formatting utilities -------------------------------------------------
// Escape HTML to avoid injection
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Render a lightweight markdown-like syntax to HTML
function renderDescription(md) {
    if (!md) return '';
    // We'll parse block-level constructs (lists, blockquotes, fenced code)
    // from the raw text so leading characters like '>' are preserved.
    const rawLines = (md || '').split(/\r?\n/);
    // Inline renderer for combinations (***, **, *, ++, __, ~~ and `code`)
    function renderInline(s) {
        if (!s) return '';
        let r = s;
        // code spans
        r = r.replace(/`([^`]+?)`/g, '<code>$1</code>');
        // markdown links [text](url) - allow simple URLs (no nested brackets)
        // run after code spans to avoid converting inside code
        r = r.replace(/\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="faq-link">$1</a>');
        // bold+italic ***text*** => <strong><em>text</em></strong>
        r = r.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        // bold **text**
        r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // underline ++text++ or __text__
        r = r.replace(/\+\+(.+?)\+\+/g, '<u>$1</u>');
        r = r.replace(/__(.+?)__/g, '<u>$1</u>');
        // italic *text*
        r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // strikethrough ~~text~~
        r = r.replace(/~~(.+?)~~/g, '<del>$1</del>');
        return r;
    }

    let out = '';
    let inList = false;
    for (let i = 0; i < rawLines.length; i++) {
        const rawLine = rawLines[i];
        const line = escapeHtml(rawLine);

        // Fenced code block (```) - detect on rawLine
        if (rawLine.trim().startsWith('```')) {
            // collect until closing ``` on raw lines
            let lang = rawLine.trim().slice(3).trim();
            let codeLines = [];
            let j = i + 1;
            for (; j < rawLines.length; j++) {
                if (rawLines[j].trim() === '```') break;
                codeLines.push(rawLines[j]);
            }
            i = j; // skip processed lines
            const codeText = escapeHtml(codeLines.join('\n'));
            out += `<div class="faq-code-wrapper"><button class="faq-copy-btn" onclick="copyCodeBlock(this)">Copier</button><pre><code>${codeText}</code></pre></div>`;
            continue;
        }

        // list item (accepts dash with or without following space) - detect on rawLine
        if (rawLine.match(/^\s*-\s*/)) {
            if (!inList) { out += '<ul>'; inList = true; }
            const content = line.replace(/^\s*-\s*/, '');
            out += '<li>' + renderInline(content) + '</li>';
            continue;
        } else {
            if (inList) { out += '</ul>'; inList = false; }
        }

        // blockquote: collect one or more lines that belong to the same blockquote
        if (rawLine.match(/^\s*>\s*/)) {
            const blockLines = [];
            // helper to strip leading '>' if present
            const strip = s => s.replace(/^\s*>\s*/, '');
            // process first line
            blockLines.push(strip(rawLine));
            // consume following lines until a blank line (double-enter) or encounter a markdown prefix
            const mdPrefix = /^\s*(?:```|#{1,6}\s+|-\s+|\*\s+|\d+\.\s+)/;
            let j = i + 1;
            for (; j < rawLines.length; j++) {
                const nxt = rawLines[j];
                // blank raw line => end of blockquote
                if (nxt.trim() === '') break;
                // if the next line starts with a markdown prefix (fence, heading, list), stop and don't include it
                if (mdPrefix.test(nxt)) break;
                // if next line starts with '>' strip and include
                if (/^\s*>/.test(nxt)) {
                    const stripped = strip(nxt);
                    blockLines.push(stripped);
                    continue;
                }
                // next line does not start with '>' but is non-blank and not a markdown prefix -> include as continuation
                blockLines.push(nxt);
            }
            // advance outer loop to last consumed line
            i = j - 1;

            // Render blockquote content: render each collected raw line as its own element
            let inner = '';
            for (const ln of blockLines) {
                const safe = escapeHtml(ln || '');
                inner += '<div class="faq-bq-line">' + renderInline(safe) + '</div>';
            }
            out += '<blockquote>' + inner + '</blockquote>';
            continue;
        }

        // headings: ###, ##, # (detect on rawLine)
        if (rawLine.match(/^\s*###\s+/)) {
            out += '<h3>' + renderInline(line.replace(/^\s*###\s+/, '')) + '</h3>';
        } else if (rawLine.match(/^\s*##\s+/)) {
            out += '<h2>' + renderInline(line.replace(/^\s*##\s+/, '')) + '</h2>';
        } else if (rawLine.match(/^\s*#\s+/)) {
            // H1 with special styling class
            out += '<h1 class="faq-desc-h1">' + renderInline(line.replace(/^\s*#\s+/, '')) + '</h1>';
        } else if (rawLine.trim() === '') {
            out += '<br/>';
        } else {
            out += '<div>' + renderInline(line) + '</div>';
        }
    }
    if (inList) out += '</ul>';
    return out;
}

// Inject minimal CSS for description H1 styling (uses CSS variables if available)
function ensureFAQStyles() {
    if (document.getElementById('faq-desc-styles')) return;
    const style = document.createElement('style');
    style.id = 'faq-desc-styles';
        style.innerHTML = `
            /* Be specific: only affect H1 rendered inside FAQ card bodies */
            .faq-card-body .faq-desc-h1 {
                color: inherit !important; /* ensure page color isn't overridden */
                background: transparent !important;
                border: none !important;
                padding: 0 !important;
                margin: 8px 0 !important;
                display: block;
                text-align: left !important;
                font-size: 2em; /* bigger than H2 */
                font-weight: 800; /* heavier */
                line-height: 1.15;
            }
            /* Make H2 slightly smaller inside FAQ descriptions */
            .faq-card-body h2 {
                font-size: 1.4em;
                font-weight: 700;
                margin: 6px 0;
            }
            /* Adjust list appearance so the bullet aligns with text */
            .faq-card-body ul {
                list-style-position: outside; /* changed from inside to outside */
                margin: 0 0 8px 1.2em; /* adjusted margin for placeholder alignment */
                padding-left: 0; /* let inside bullets align with container */
            }
            .faq-card-body ul li {
                margin: 4px 0;
            }
            /* Entries container styling for sortable columns */
            .faq-entries {
                display: flex;
                flex-direction: column;
                gap: 0px;
                padding: 6px 0;
            }
        /* Drop target styling when hovering over a category */
            .faq-drop-target-cat { outline: 2px dashed rgba(0,0,0,0.2); border-radius: 6px; }
            /* Placeholder style for entry drop target */
            .faq-drop-target { box-shadow: 0 0 0 2px rgba(30,144,255,0.12) inset; border-radius: 4px; }
            /* SortableJS helpers */
            .sortable-ghost { opacity: 0.5; transform: scale(0.98); }
            .sortable-chosen { box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
        /* Edit mode banner and toggle */
        .faq-edit-banner { background: linear-gradient(90deg,#fff7c2,#fff); border:1px solid #f0e68c; padding:8px 12px; margin-bottom:8px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .faq-edit-banner .owner { font-weight:700; color:#333 }
        .faq-edit-toggle { background:var(--main-color-dark); color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer }
        .faq-edit-toggle[disabled] { opacity:0.5; cursor:not-allowed }
    .faq-code-wrapper { position: relative; background: #0f1720; color: #e6eef3; border-radius: 6px; padding: 10px; margin: 8px 0; overflow: auto; }
    /* Use a VSCode-like monospace stack (Consolas preferred on Windows) */
    .faq-code-wrapper pre { margin: 0; font-family: Consolas, 'Roboto Mono', 'SFMono-Regular', Menlo, Monaco, 'Courier New', monospace; font-size: 13px; line-height: 1.4; white-space: pre; color: #dfeef7; }
    /* Also ensure inline <code> uses the same font for consistency */
    .faq-card-body code, .faq-code-wrapper pre code {
        font-family: Consolas, 'Roboto Mono', 'SFMono-Regular', Menlo, Monaco, 'Courier New', monospace;
        font-size: 13px;
    }
    /* Inline code rendering uses <code> in rendered output; live overlay removed to avoid bugs */
    .faq-copy-btn { position: absolute; right: 8px; top: 8px; background: rgba(255,255,255,0.06); color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .faq-copy-btn:active { transform: translateY(1px); }
    /* Blockquote styling (Discord-like left bar) */
    .faq-card-body blockquote {
        margin: 8px 0;
        padding: 8px 12px 8px 20px; /* extra left padding so text clears the left bar */
        border-radius: 6px;
        background: rgba(79,84,92,0.04); /* subtle background */
        position: relative;
        color: inherit;
        font-size: inherit; /* ensure same font size as surrounding content */
        font-weight: 400;    /* normal weight */
        line-height: 1.45;
        text-align: left; /* ensure blockquote text is left-aligned */
    }
    .faq-card-body blockquote::before {
        content: '';
        position: absolute;
        left: 10px;
        top: 8px;
        bottom: 8px;
        width: 4px;
        border-radius: 2px;
        background: rgba(95, 95, 95, 1); /* accent color, tweak to match theme */
    }
    /* Each collected blockquote line is rendered in .faq-bq-line to preserve line breaks */
    .faq-card-body .faq-bq-line { display:block; margin:3px 0; text-align:left; }
    .faq-card-body blockquote code { font-size: 13px; }
    /* Style for rendered links inside FAQ descriptions to look like Discord links */
    .faq-card-body a.faq-link {
        color: inherit; /* keep current text color */
        text-decoration: underline; /* underlined like a link */
        text-underline-offset: 2px;
        cursor: pointer;
        font-weight: 700;
    }
    .faq-card-body a.faq-link:hover { opacity: 0.9; }
    /* Character counter badge shown over the textarea bottom-right */
        `;
    document.head.appendChild(style);
}

// Copy helper used by code blocks
function copyCodeBlock(btn) {
    try {
        const wrapper = btn.closest('.faq-code-wrapper');
        if (!wrapper) return;
        const codeEl = wrapper.querySelector('pre > code');
        if (!codeEl) return;
        const text = codeEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const old = btn.textContent;
            btn.textContent = 'Copié';
            setTimeout(() => btn.textContent = old, 1200);
        }).catch(() => {
            // fallback: select + execCopy
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); btn.textContent = 'Copié'; setTimeout(() => btn.textContent = 'Copier', 1200); } catch (e) {}
            ta.remove();
        });
    } catch (e) {}
}

// Reusable confirm popup using the existing .custom-confirm-overlay markup
// returns a Promise<boolean> that resolves true if user confirms
function showConfirm(message) {
    return new Promise(resolve => {
        let overlay = document.getElementById('customConfirmSend');
        if (!overlay) {
            // fallback to window.confirm if overlay not found
            resolve(window.confirm(message));
            return;
        }
        const box = overlay.querySelector('.custom-confirm-box');
        const text = box.querySelector('p');
        const btns = overlay.querySelectorAll('.custom-confirm-buttons .btn');
        text.textContent = message;
        overlay.style.display = 'flex';
        const onCancel = () => {
            cleanup();
            resolve(false);
        };
        const onConfirm = () => {
            cleanup();
            resolve(true);
        };
        function cleanup() {
            overlay.style.display = 'none';
            btns[0].removeEventListener('click', onCancel);
            btns[1].removeEventListener('click', onConfirm);
        }
        btns[0].addEventListener('click', onCancel);
        btns[1].addEventListener('click', onConfirm);
    });
}

// When typing in a textarea we can switch to monospace font while the caret is inside backticks
function updateTextareaFontBasedOnCaret(textarea) {
    try {
        const val = textarea.value || '';
        const pos = textarea.selectionStart || 0;
        // Count triple backticks before cursor
        const before = val.slice(0, pos);
        const tripleBefore = (before.match(/```/g) || []).length;
        if (tripleBefore % 2 === 1) {
            // caret is inside a fenced code block — don't change textarea font to avoid UI bugs
            return;
        }
        // Remove triple backticks occurrences to avoid double counting
        const cleaned = val.replace(/```/g, '');
        const before2 = cleaned.slice(0, pos - ((val.length - cleaned.length)) );
        const singleBefore = (before2.match(/`/g) || []).length;
        if (singleBefore % 2 === 1) {
            // caret is inside inline backticks — do not modify textarea font, overlay removed earlier
            return;
        }
    // otherwise nothing to change
    } catch (e) {
        // ignore
    }
}

function attachCodeFontHandler(textarea) {
    if (!textarea) return;
    const handler = () => updateTextareaFontBasedOnCaret(textarea);
    textarea.addEventListener('input', handler);
    textarea.addEventListener('click', handler);
    textarea.addEventListener('keyup', handler);
    // Auto resize on input and initial state
    textarea.addEventListener('input', () => { autoResizeTextarea(textarea); });
    textarea.addEventListener('input', handler);
    // run once to set initial state
    setTimeout(() => { updateTextareaFontBasedOnCaret(textarea); autoResizeTextarea(textarea); }, 0);
}

// Auto-resize a textarea to fit its content up to a maximum height.
function autoResizeTextarea(textarea, maxHeight = 600) {
    try {
        if (!textarea) return;
        // Make non-resizable by the user
        textarea.style.resize = 'none';
        // Reset height to compute scrollHeight properly
        textarea.style.height = 'auto';
        // Use scrollHeight but cap to maxHeight
        const sh = textarea.scrollHeight;
        const target = Math.min(sh, maxHeight);
        textarea.style.height = target + 'px';
        if (sh > maxHeight) textarea.style.overflowY = 'auto'; else textarea.style.overflowY = 'hidden';
    } catch (e) {}
}

// Create an overlay element that mirrors textarea content and highlights inline code between backticks
// (overlay implementation removed — revert to caret-based monospace switch)

// Helpers to edit textarea selection
function wrapSelection(textarea, before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    const selected = val.slice(start, end) || '';
    const newVal = val.slice(0, start) + before + selected + after + val.slice(end);
    textarea.value = newVal;
    // restore selection inside the inserted wrapper
    const cursor = start + before.length + selected.length + after.length;
    textarea.selectionStart = textarea.selectionEnd = cursor;
    textarea.focus();
}

function prefixLine(textarea, prefix) {
    const start = textarea.selectionStart;
    const val = textarea.value;
    // find line start
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    textarea.value = val.slice(0, lineStart) + prefix + val.slice(lineStart);
    textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    textarea.focus();
}
// Send category order to server
async function sendCategoryOrder(order) {
    await fetch('/api/faq/order/categories', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order })
    });
}

// Send entries order to server (items = [{id, categoryId, ordre}, ...])
async function sendEntriesOrder(items) {
    await fetch('/api/faq/order/entries', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items)
    });
}

// Save a lightweight anchor of the current view so we can restore it after a re-render
function saveViewAnchor() {
    try {
        const x = Math.floor(window.innerWidth / 2);
        const y = 100; // a point near the top of the viewport
        const el = document.elementFromPoint(x, y);
        if (!el) return { type: 'position', scrollY: window.scrollY };
        const card = el.closest('.faq-card');
        if (card && card.dataset && card.dataset.entryId) {
            return { type: 'entry', id: String(card.dataset.entryId), top: card.getBoundingClientRect().top, scrollY: window.scrollY };
        }
        const cat = el.closest('.faq-category');
        if (cat && cat.dataset && cat.dataset.catId) {
            return { type: 'category', id: String(cat.dataset.catId), top: cat.getBoundingClientRect().top, scrollY: window.scrollY };
        }
        return { type: 'position', scrollY: window.scrollY };
    } catch (e) {
        return { type: 'position', scrollY: window.scrollY };
    }
}

// Restore the saved anchor: try to align the same element to the previous viewport offset
async function restoreViewAnchor(anchor) {
    try {
        if (!anchor) return;
        if (anchor.type === 'position') {
            window.scrollTo(0, anchor.scrollY || 0);
            return;
        }
        // small delay to let render and layout complete
        await new Promise(r => setTimeout(r, 40));
        if (anchor.type === 'entry') {
            const sel = document.querySelector(`.faq-card[data-entry-id="${anchor.id}"]`);
            if (sel) {
                const rect = sel.getBoundingClientRect();
                const diff = rect.top - anchor.top;
                window.scrollBy(0, diff);
                return;
            }
        }
        if (anchor.type === 'category') {
            const sel = document.querySelector(`.faq-category[data-cat-id="${anchor.id}"]`);
            if (sel) {
                const rect = sel.getBoundingClientRect();
                const diff = rect.top - anchor.top;
                window.scrollBy(0, diff);
                return;
            }
        }
        // fallback
        window.scrollTo(0, anchor.scrollY || 0);
    } catch (e) {
        // ignore restore errors
    }
}

// Load SortableJS (from CDN) and initialize sortables
async function initSortable() {
    if (!currentUser?.isCommandStaff && !currentUser?.isSupervisor) return; // only for authorized users
    // load Sortable if not present
    if (typeof Sortable === 'undefined') {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // categories
    const catWrap = document.querySelector('.faq-categories-wrapper');
    if (catWrap) {
        // destroy previous if exists
        if (sortableCategoryInstance) {
            try { sortableCategoryInstance.destroy(); } catch (e) {}
            sortableCategoryInstance = null;
        }
        sortableCategoryInstance = new Sortable(catWrap, {
            handle: '.faq-category-title',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onMove: (evt, originalEvent) => {
                // highlight related category as drop target
                const related = evt.related;
                document.querySelectorAll('.faq-category').forEach(el => el.classList.remove('faq-drop-target-cat'));
                if (related && related.classList) related.classList.add('faq-drop-target-cat');
                return true;
            },
            onEnd: async () => {
                document.querySelectorAll('.faq-category').forEach(el => el.classList.remove('faq-drop-target-cat'));
                const anchor = saveViewAnchor();
                const order = Array.from(catWrap.children).map(c => parseInt(c.dataset.catId, 10));
                await sendCategoryOrder(order);
                await renderFAQ();
                await restoreViewAnchor(anchor);
            }
        });
    }

    // entries per category (connect lists)
    // clear previous entry instances
    sortableEntriesInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
    sortableEntriesInstances = [];
    const lists = document.querySelectorAll('.faq-entries');
    lists.forEach(list => {
        let lastRelated = null;
        const inst = new Sortable(list, {
            group: 'faq-entries',
            animation: 120,
            draggable: '.faq-card',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onMove: (evt, originalEvent) => {
                const related = evt.related;
                if (lastRelated && lastRelated !== related) lastRelated.classList.remove('faq-drop-target');
                if (related && related.classList) {
                    related.classList.add('faq-drop-target');
                    lastRelated = related;
                }
                return true;
            },
            onEnd: async (evt) => {
                document.querySelectorAll('.faq-drop-target').forEach(el => el.classList.remove('faq-drop-target'));
                const anchor = saveViewAnchor();
                // build payload for all entries in all categories
                const items = [];
                document.querySelectorAll('.faq-entries').forEach(el => {
                    const catId = parseInt(el.dataset.catId, 10);
                    Array.from(el.children).forEach((child, idx) => {
                        items.push({ id: parseInt(child.dataset.entryId, 10), categoryId: catId, ordre: idx });
                    });
                });
                await sendEntriesOrder(items);
                await renderFAQ();
                await restoreViewAnchor(anchor);
            }
        });
        sortableEntriesInstances.push(inst);
    });
}

function disableSortables() {
    try {
        if (sortableCategoryInstance) { sortableCategoryInstance.destroy(); sortableCategoryInstance = null; }
    } catch (e) {}
    try {
        sortableEntriesInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
    } catch (e) {}
    sortableEntriesInstances = [];
}

function enableSortables() {
    // re-init (will no-op if user not allowed)
    initSortable();
}


// Render FAQ
async function renderFAQ() {
    const container = document.getElementById('faq-container');
    container.innerHTML = '';
    // Render edit lock banner / toggle
    const bannerWrap = document.createElement('div');
    if (currentUser && (currentUser.isCommandStaff || currentUser.isSupervisor || currentUser.isSuperAdmin)) {
        const banner = document.createElement('div');
        banner.className = 'faq-edit-banner';
        if (faqEditLock) {
            banner.innerHTML = `<div>En cours de modification par <span class="owner">${faqEditLock.ownerName}</span> depuis ${new Date(faqEditLock.since).toLocaleTimeString()}.</div>`;
            const btn = document.createElement('button');
            btn.className = 'faq-edit-toggle';
            if (faqEditLock.ownerId === currentUser.id || currentUser.isSuperAdmin) {
                btn.textContent = 'Désactiver le mode modification';
                btn.onclick = async () => { await releaseEditLock(); };
            } else {
                btn.textContent = 'Mode modification (verrouillé)';
                btn.disabled = true;
            }
            banner.appendChild(btn);
        } else {
            banner.innerHTML = `<div>Mode modification inactif</div>`;
            const btn = document.createElement('button');
            btn.className = 'faq-edit-toggle';
            btn.textContent = 'Activer le mode modification';
            btn.onclick = async () => { await acquireEditLock(); };
            banner.appendChild(btn);
        }
        bannerWrap.appendChild(banner);
        container.appendChild(bannerWrap);
    }
    const faq = await fetchFAQ();
    const hadFAQ = (faq && faq.length > 0);
    // create a container for categories to make them sortable
    const categoriesWrapper = document.createElement('div');
    categoriesWrapper.className = 'faq-categories-wrapper';
    faq.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = 'faq-category';
        catDiv.dataset.catId = cat.id;
        // Ajoute le titre de la catégorie
        const catTitle = document.createElement('div');
        catTitle.className = 'faq-category-title';
        // Structure : titre à gauche, boutons à droite
        const catTitleRow = document.createElement('div');
        catTitleRow.style.display = 'flex';
        catTitleRow.style.alignItems = 'center';
        catTitleRow.style.justifyContent = 'space-between';
        // Titre texte
        const catTitleText = document.createElement('span');
        catTitleText.textContent = cat.nom;
        catTitleText.style.flex = '1';
        catTitleRow.appendChild(catTitleText);
        // Boutons admin catégorie
    // Show category admin buttons only if edit lock is held by current user
    const editEnabled = faqEditLock && currentUser && (faqEditLock.ownerId === currentUser.id || currentUser.isSuperAdmin);
    if (editEnabled) {
            const btns = document.createElement('span');
            btns.style.display = 'flex';
            btns.style.gap = '6px';
            // Edit catégorie
            const editCatBtn = document.createElement('button');
            editCatBtn.title = 'Modifier la catégorie';
            editCatBtn.className = 'material-symbols-outlined';
            editCatBtn.style.background = 'none';
            editCatBtn.style.border = 'none';
            editCatBtn.style.color = 'var(--main-color-dark)';
            editCatBtn.style.fontSize = '1.3em';
            editCatBtn.style.cursor = 'pointer';
            editCatBtn.textContent = 'edit';
            editCatBtn.onclick = (e) => {
                e.stopPropagation();
                showEditCategoryForm(cat, catDiv, catTitle);
            };
            btns.appendChild(editCatBtn);
            // Delete catégorie
            const delCatBtn = document.createElement('button');
            delCatBtn.title = 'Supprimer la catégorie';
            delCatBtn.className = 'material-symbols-outlined';
            delCatBtn.style.background = 'none';
            delCatBtn.style.border = 'none';
            delCatBtn.style.color = 'var(--main-color-dark)';
            delCatBtn.style.fontSize = '1.3em';
            delCatBtn.style.cursor = 'pointer';
            delCatBtn.textContent = 'delete';
            delCatBtn.onclick = async (e) => {
                e.stopPropagation();
                if (await showConfirm('Supprimer cette catégorie et toutes ses questions ?')) {
                    const anchor = saveViewAnchor();
                    await fetch(`/api/faq/category/${cat.id}`, { method: 'DELETE' });
                    await renderFAQ();
                    try { await restoreViewAnchor(anchor); } catch (e) {}
                }
            };
            btns.appendChild(delCatBtn);
            catTitleRow.appendChild(btns);
        }
        catTitle.appendChild(catTitleRow);
        catDiv.appendChild(catTitle);
        // Ajout bouton catégorie (command staff)
    if (editEnabled) {
            const addBtn = document.createElement('button');
            addBtn.className = 'faq-add-btn';
            addBtn.textContent = '+ Ajouter';
            addBtn.onclick = () => showFAQForm(cat.id, catDiv);
            catDiv.appendChild(addBtn);
        }
        if (!cat.entries.length) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'faq-empty';
            emptyDiv.textContent = 'Aucun contenu dans cette catégorie.';
            catDiv.appendChild(emptyDiv);
        }
        // create an entries container for Sortable
        const entriesContainer = document.createElement('div');
        entriesContainer.className = 'faq-entries';
        entriesContainer.dataset.catId = cat.id;
        cat.entries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'faq-card';
            card.dataset.entryId = entry.id;
            card.dataset.catId = cat.id;
            // Header
            const header = document.createElement('div');
            header.className = 'faq-card-header';
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'space-between';
            // Chevron à gauche
            const chevron = document.createElement('span');
            chevron.className = 'chevron material-symbols-outlined';
            chevron.textContent = 'chevron_right';
            chevron.style.transition = 'transform 0.2s';
            header.appendChild(chevron);
            // Titre au centre
            const titleSpan = document.createElement('span');
            titleSpan.textContent = entry.titre;
            titleSpan.style.flex = '1';
            titleSpan.style.marginLeft = '10px';
            header.appendChild(titleSpan);
            // Boutons admin à droite
            if (editEnabled) {
                const btns = document.createElement('span');
                btns.style.display = 'flex';
                btns.style.gap = '6px';
                // Edit question
                const editBtn = document.createElement('button');
                editBtn.title = 'Modifier la question';
                editBtn.className = 'material-symbols-outlined';
                editBtn.style.background = 'none';
                editBtn.style.border = 'none';
                editBtn.style.color = 'var(--main-color-dark)';
                editBtn.style.fontSize = '1.1em';
                editBtn.style.cursor = 'pointer';
                editBtn.textContent = 'edit';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    showEditFAQForm(entry, card, header, cat.id);
                };
                btns.appendChild(editBtn);
                // Delete question
                const delBtn = document.createElement('button');
                delBtn.title = 'Supprimer la question';
                delBtn.className = 'material-symbols-outlined';
                delBtn.style.background = 'none';
                delBtn.style.border = 'none';
                delBtn.style.color = 'var(--main-color-dark)';
                delBtn.style.fontSize = '1.1em';
                delBtn.style.cursor = 'pointer';
                delBtn.textContent = 'delete';
                delBtn.onclick = async (e) => {
                    e.stopPropagation();
                        if (await showConfirm('Supprimer cette élément ?')) {
                        const anchor = saveViewAnchor();
                        await fetch(`/api/faq/${entry.id}`, { method: 'DELETE' });
                        await renderFAQ();
                        try { await restoreViewAnchor(anchor); } catch (e) {}
                    }
                };
                btns.appendChild(delBtn);
                header.appendChild(btns);
            }
            header.onclick = () => {
                card.classList.toggle('open');
                chevron.style.transform = card.classList.contains('open') ? 'rotate(90deg)' : '';
            };
            // Body
            const body = document.createElement('div');
            body.className = 'faq-card-body';
            const descHtml = renderDescription(entry.description);
            body.innerHTML = `<div>${descHtml}</div>` + (entry.image ? `<img src="${entry.image}" alt="Image FAQ" onerror="this.style.display='none'" style="max-width:350px;max-height:220px;">` : '');
            card.appendChild(header);
            card.appendChild(body);
            entriesContainer.appendChild(card);
        });
        catDiv.appendChild(entriesContainer);
        categoriesWrapper.appendChild(catDiv);
    });
    // append wrapper once and then initialize Sortable (categories + entries)
    container.appendChild(categoriesWrapper);
    // If there are no categories/questions, show an empty message inside the wrapper
    if (!hadFAQ) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'faq-empty';
        emptyDiv.textContent = 'Aucune question pour le moment.';
        categoriesWrapper.appendChild(emptyDiv);
    }
    // Only initialize sortables for the edit owner
    if (faqEditLock && currentUser && (faqEditLock.ownerId === currentUser.id || currentUser.isSuperAdmin)) {
        initSortable();
    }
    // Ajout catégorie (command staff)
    if (faqEditLock && currentUser && (faqEditLock.ownerId === currentUser.id || currentUser.isSuperAdmin)) {
        const addCatBtn = document.createElement('button');
        addCatBtn.className = 'faq-add-category-btn';
        addCatBtn.textContent = '+ Ajouter une catégorie';
        addCatBtn.onclick = showCategoryForm;
        container.appendChild(addCatBtn);
    }
}

// Formulaire ajout question
function showFAQForm(categoryId, parentDiv) {
    // Ensure only one "add" form exists at a time (don't interfere with edit forms)
    const existingAdd = document.querySelector('.faq-form:not(.faq-form-edit)');
    if (existingAdd) {
        // If the existing add form is already in this category, just focus its title input
        const existingCategory = existingAdd.closest('.faq-category');
        if (existingCategory === parentDiv) {
            const titleInput = existingAdd.querySelector('input[name="titre"]');
            if (titleInput) titleInput.focus();
            return;
        }
        // Otherwise remove the other add form before opening a new one
        existingAdd.remove();
    }

    const form = document.createElement('form');
    form.className = 'faq-form';
    form.innerHTML = `
        <label>Titre</label>
        <input type="text" name="titre" maxlength="100" required />
    <label>Description</label>
        <div class="faq-textarea-wrapper" style="position:relative">
            <textarea name="description" rows="4" required></textarea>
        </div>
        <label>Lien image (optionnel)</label>
        <input type="url" name="image" class="faq-image-link" placeholder="https://..." />
        <img class="faq-image-preview" style="display:none;max-width:180px;" />
        <button type="submit" class="faq-add-btn">Ajouter</button>
        <button type="button" class="faq-add-btn faq-cancel" style="background:var(--main-color-light);color:var(--main-color-dark);">Annuler</button>
    `;
    // Preview image
    const imgInput = form.querySelector('input[name="image"]');
    const imgPreview = form.querySelector('.faq-image-preview');
    imgInput.oninput = () => {
        if (imgInput.value.match(/^https?:\/\//)) {
            imgPreview.src = imgInput.value;
            imgPreview.style.display = '';
        } else {
            imgPreview.style.display = 'none';
        }
    };
    // Attach code font handler and character counter to textarea
    const descTa = form.querySelector('textarea[name="description"]');
    attachCodeFontHandler(descTa);
    form.onsubmit = async e => {
        e.preventDefault();
        const titre = form.titre.value.trim();
        const description = form.description.value.trim();
        const image = form.image.value.trim();
        // character limit removed
        if (!titre || !description) return;
        const ok = await addFAQEntry({ titre, description, image, categoryId });
        if (ok) renderFAQ();
    };
    // Cancel button (explicit selector so toolbar buttons won't be mistaken)
    const cancelBtn = form.querySelector('.faq-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            form.remove();
        });
    }
    // Insert the add form directly below the add button and above the questions
    const entriesContainer = parentDiv.querySelector('.faq-entries');
    if (entriesContainer) {
        // insert before the entries container so the form appears above the questions
        parentDiv.insertBefore(form, entriesContainer);
    } else {
        parentDiv.appendChild(form);
    }

    // focus the title input for convenience
    const titleInput = form.querySelector('input[name="titre"]');
    if (titleInput) titleInput.focus();
}

// Formulaire édition question
function showEditFAQForm(entry, card, header, categoryId) {
    // Empêche double formulaire
    if (card.querySelector('.faq-form-edit')) return;
    const form = document.createElement('form');
    form.className = 'faq-form faq-form-edit';
    form.innerHTML = `
        <label>Titre</label>
        <input type="text" name="titre" maxlength="100" required value="${(entry.titre||'').replace(/"/g,'&quot;')}" />
    <label>Description</label>
        <div class="faq-textarea-wrapper" style="position:relative">
            <textarea name="description" rows="4" required>${(entry.description||'').replace(/</g,'&lt;')}</textarea>
        </div>
        <label>Lien image (optionnel)</label>
        <input type="url" name="image" class="faq-image-link" placeholder="https://..." value="${entry.image || ''}" />
        <img class="faq-image-preview" style="display:${entry.image ? '' : 'none'};max-width:180px;" src="${entry.image || ''}" />
        <button type="submit" class="faq-add-btn">Enregistrer</button>
        <button type="button" class="faq-add-btn faq-cancel-edit" style="background:var(--main-color-light);color:var(--main-color-dark);">Annuler</button>
    `;

    // Preview image
    const imgInput = form.querySelector('input[name="image"]');
    const imgPreview = form.querySelector('.faq-image-preview');
    imgInput.oninput = () => {
        if (imgInput.value.match(/^https?:\/\//)) {
            imgPreview.src = imgInput.value;
            imgPreview.style.display = '';
        } else {
            imgPreview.style.display = 'none';
        }
    };

    // Disable drag & drop while editing so text selection works
    try { disableSortables(); } catch (e) {}

    form.onsubmit = async e => {
        e.preventDefault();
        const titre = form.titre.value.trim();
        const description = form.description.value.trim();
        const image = form.image.value.trim();
        if (!titre || !description) return;
        try {
            const res = await fetch(`/api/faq/${entry.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ titre, description, image })
            });
            if (res.ok) {
                try { enableSortables(); } catch (e) {}
                renderFAQ();
            } else {
                try { enableSortables(); } catch (e) {}
                // if patch failed, optionally show an error (simple alert for now)
                alert('Erreur lors de la modification');
            }
        } catch (err) {
            try { enableSortables(); } catch (e) {}
            alert('Erreur réseau');
        }
    };

    // Cancel button: ensure it removes the form and restores header
    const editCancel = form.querySelector('.faq-cancel-edit');
    if (editCancel) {
        editCancel.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            form.remove();
            header.style.display = '';
            try { enableSortables(); } catch (e) {}
        });
    }

    // Attach toolbar handlers for edit form
    const textarea = form.querySelector('textarea[name="description"]');
    // Attach code font handler so edit textarea uses Lucida Console when inside backticks
    attachCodeFontHandler(textarea);
    form.querySelectorAll('.faq-tb').forEach(btn => {
        btn.onclick = () => {
            const action = btn.getAttribute('data-action');
            if (action === 'bold') wrapSelection(textarea, '**', '**');
            else if (action === 'underline') wrapSelection(textarea, '++', '++');
            else if (action === 'h1') prefixLine(textarea, '# ');
            else if (action === 'list') prefixLine(textarea, '- ');
        };
    });

    // Insert form before the header and hide header while editing
    card.insertBefore(form, header);
    header.style.display = 'none';
}

// Formulaire édition catégorie
function showEditCategoryForm(cat, catDiv, catTitle) {
    // Empêche double formulaire
    if (catDiv.querySelector('.faq-category-form')) return;
    const form = document.createElement('form');
    form.className = 'faq-category-form';
    form.innerHTML = `
        <label>Nom de la catégorie</label>
        <input type="text" name="nom" maxlength="60" required value="${cat.nom.replace(/"/g, '&quot;')}" />
        <button type="submit" class="faq-add-category-btn">Enregistrer</button>
        <button type="button" class="faq-add-category-btn" style="background:var(--main-color-light);color:var(--main-color-dark);">Annuler</button>
    `;
    // Disable drag & drop while editing so text selection works
    try { disableSortables(); } catch (e) {}

    form.onsubmit = async e => {
        e.preventDefault();
        const name = form.nom.value.trim();
        if (!name) return;
        try {
            const res = await fetch(`/api/faq/category/${cat.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                try { enableSortables(); } catch (e) {}
                renderFAQ();
            } else {
                try { enableSortables(); } catch (e) {}
            }
        } catch (err) {
            try { enableSortables(); } catch (e) {}
        }
    };
    form.querySelector('button[type="button"]').onclick = () => {
        form.remove();
        catTitle.style.display = '';
        try { enableSortables(); } catch (e) {}
    };
    // Remplace le titre par le form
    catDiv.insertBefore(form, catDiv.firstChild);
    catTitle.style.display = 'none';
}

// Formulaire ajout catégorie
function showCategoryForm() {
    const container = document.getElementById('faq-container');
    const form = document.createElement('form');
    form.className = 'faq-category-form';
    form.innerHTML = `
        <label>Nom de la catégorie</label>
        <input type="text" name="nom" maxlength="60" required />
        <button type="submit" class="faq-add-category-btn">Ajouter</button>
        <button type="button" class="faq-add-category-btn" style="background:var(--main-color-light);color:var(--main-color-dark);">Annuler</button>
    `;
    form.onsubmit = async e => {
        e.preventDefault();
        const nom = form.nom.value.trim();
        if (!nom) return;
        const ok = await addFAQCategory(nom);
        if (ok) renderFAQ();
    };
    form.querySelector('button[type="button"]').onclick = () => {
        form.remove();
    };
    container.appendChild(form);
}

// Initialisation
// --- Character counter helpers ------------------------------------------------

initFAQ();
