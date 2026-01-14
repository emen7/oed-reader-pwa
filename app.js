// OED Reader - Main Application Logic
// Camera, OCR, column/word selection, multi-page continuation, UI state.

class OEDReaderApp {
    constructor() {
        this.currentEntry = null;
        this.videoStream = null;

        // New state for smart OCR flow
        this.currentImageData = null;   // data URL of last captured page
        this.wordRegions = [];          // detected word boxes
        this.imageSize = { width: 0, height: 0 };
        this.isContinuation = false;    // scanning next page/column of same entry
        this.partialEntry = null;       // stored previous part

        this.init();
    }

    async init() {
        // Force dark mode
        document.documentElement.setAttribute('data-theme', 'dark');

        this.setupEventListeners();
        this.loadRecentScans();
        this.registerServiceWorker();
        this.startCamera();
    }

    // NAVIGATION & EVENTS

    setupEventListeners() {
        // Navigation buttons
        document.querySelectorAll('[data-screen]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchScreen(e.currentTarget.dataset.screen);
                this.closeSidebar();
            });
        });

        // Camera controls
        document.getElementById('captureButton')
            .addEventListener('click', () => this.captureImage());

        document.getElementById('uploadButton')
            .addEventListener('click', () =>
                document.getElementById('fileInput').click()
            );

        document.getElementById('fileInput')
            .addEventListener('change', (e) => {
                if (e.target.files[0]) this.processImage(e.target.files[0]);
            });

        // OCR cancel
        document.getElementById('cancelOCR')
            .addEventListener('click', () => {
                this.isContinuation = false;
                this.partialEntry = null;
                this.switchScreen('camera');
            });

        // Collection actions
        document.getElementById('exportButton')
            .addEventListener('click', () => this.exportCollection());

        document.getElementById('clearButton')
            .addEventListener('click', () => {
                if (confirm('Clear all saved entries? This cannot be undone.')) {
                    this.clearCollection();
                }
            });

        // Sidebar toggle on mobile
        const menuToggle = document.getElementById('menuToggle');
        if (window.innerWidth <= 768) {
            menuToggle.style.display = 'block';
            menuToggle.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('open');
            });
        }

        // Collapsible sections (help and entry)
        document.addEventListener('click', (e) => {
            const header = e.target.closest('.section-header');
            if (header && header.parentElement.classList.contains('section')) {
                header.parentElement.classList.toggle('collapsed');
            }
        });
    }

    switchScreen(screenName) {
        // Update nav highlight
        document.querySelectorAll('[data-screen]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenName);
        });

        // Toggle screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`${screenName}-screen`);
        if (target) target.classList.add('active');

        // Camera lifecycle
        if (screenName === 'camera') {
            this.startCamera();
        } else {
            this.stopCamera();
        }

        if (screenName === 'collection') {
            this.displayCollection();
        }
    }

    closeSidebar() {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    // CAMERA

    async startCamera() {
        if (this.videoStream) return;
        try {
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            document.getElementById('camera').srcObject = this.videoStream;
        } catch (err) {
            console.error('Camera error', err);
            alert('Camera access is required to scan entries.');
        }
    }

    stopCamera() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(t => t.stop());
            this.videoStream = null;
        }
    }

    captureImage() {
        const video = document.getElementById('camera');
        if (!video.videoWidth) {
            alert('Camera not ready yet. Try again in a second.');
            return;
        }

        const canvas = document.getElementById('captureCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => this.processImage(blob), 'image/jpeg', 0.95);
    }

    // MAIN FLOW: PROCESS IMAGE → ANALYZE LAYOUT → USER SELECTS WORD → OCR

    async processImage(blob) {
        this.switchScreen('processing');
        document.getElementById('ocrText').textContent = 'Analyzing page layout...';
        document.getElementById('progressFill').style.width = '0%';

        const reader = new FileReader();
        reader.onload = async (e) => {
            this.currentImageData = e.target.result;
            await this.analyzePageLayout(e.target.result);
        };
        reader.readAsDataURL(blob);
    }

    async analyzePageLayout(imageDataUrl) {
        const img = new Image();
        await new Promise(resolve => {
            img.onload = resolve;
            img.src = imageDataUrl;
        });

        this.imageSize = { width: img.width, height: img.height };

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const columns = this.detectColumns(canvas, ctx);
        const wordRegions = [];
        columns.forEach(col => {
            wordRegions.push(...this.detectWordBoundaries(canvas, ctx, col));
        });

        if (wordRegions.length === 0) {
            // Fall back: OCR whole image with enhancement
            const enhanced = await this.enhanceAndCrop(img, {
                x: 0, y: 0, width: img.width, height: img.height
            });
            await this.recognizeText(enhanced);
            return;
        }

        this.wordRegions = wordRegions;
        this.showWordSelectionUI(imageDataUrl, wordRegions);
    }

    detectColumns(canvas, ctx) {
        const { width, height } = canvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const verticalDensity = new Array(width).fill(0);
        for (let x = 0; x < width; x++) {
            let darkCount = 0;
            for (let y = 0; y < height; y++) {
                const i = (y * width + x) * 4;
                const gray = (data[i] + data[i+1] + data[i+2]) / 3;
                if (gray < 200) darkCount++;
            }
            verticalDensity[x] = darkCount;
        }

        const threshold = height * 0.1;
        const minGutterWidth = 20;
        const gutters = [];
        let inGutter = false;
        let gutterStart = 0;

        for (let x = 0; x < width; x++) {
            const isWhite = verticalDensity[x] < threshold;
            if (isWhite && !inGutter) {
                inGutter = true;
                gutterStart = x;
            } else if (!isWhite && inGutter) {
                const gw = x - gutterStart;
                if (gw >= minGutterWidth) {
                    gutters.push(Math.floor((gutterStart + x) / 2));
                }
                inGutter = false;
            }
        }

        const columns = [];
        if (gutters.length === 0) {
            columns.push({ x: 0, y: 0, width, height });
        } else if (gutters.length === 1) {
            columns.push({ x: 0, y: 0, width: gutters[0], height });
            columns.push({ x: gutters[0] + 20, y: 0, width: width - gutters[0] - 20, height });
        } else {
            let startX = 0;
            gutters.forEach(g => {
                columns.push({ x: startX, y: 0, width: g - startX, height });
                startX = g + 20;
            });
            columns.push({ x: startX, y: 0, width: width - startX, height });
        }

        return columns;
    }

    detectWordBoundaries(canvas, ctx, col) {
        const { x, y, width, height } = col;
        const colData = ctx.getImageData(x, y, width, height);
        const data = colData.data;

        const horizontalDensity = new Array(height).fill(0);
        for (let row = 0; row < height; row++) {
            let darkCount = 0;
            for (let cx = 0; cx < width; cx++) {
                const i = (row * width + cx) * 4;
                const gray = (data[i] + data[i+1] + data[i+2]) / 3;
                if (gray < 150) darkCount++;
            }
            horizontalDensity[row] = darkCount;
        }

        const avg = horizontalDensity.reduce((a, b) => a + b, 0) / height || 1;
        const regions = [];
        let inRegion = false;
        let startRow = 0;

        for (let row = 0; row < height; row++) {
            // Use lower threshold (1.1x) to group lines within entries, not split them
            const dense = horizontalDensity[row] > avg * 1.1;
            if (dense && !inRegion) {
                inRegion = true;
                startRow = row;
            } else if (!dense && inRegion) {
                const h = row - startRow;
                // Require minimum 60px to capture full entries (4-5 lines), not individual lines
                if (h > 60 && h < 300) {
                    regions.push({
                        x: x,
                        y: y + startRow - 4,
                        width: width,
                        height: h + 8
                    });
                }
                inRegion = false;
            }
        }

        return regions;
    }

    showWordSelectionUI(imageDataUrl, wordRegions) {
        const display = document.getElementById('entryDisplay');

        const svgRects = wordRegions.map((r, idx) => `
            <rect
                x="${r.x}" y="${r.y}"
                width="${r.width}" height="${r.height}"
                fill="rgba(42,82,152,0.18)"
                stroke="rgba(42,82,152,0.9)"
                stroke-width="3"
                data-index="${idx}"
                class="word-region"
                style="cursor:pointer;"
            />
        `).join('');

        const { width, height } = this.imageSize;

        display.innerHTML = `
            <h2 style="margin-bottom: 12px;">Tap a word entry to scan</h2>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">
                The page has been analyzed into candidate entries. Tap one to run high-quality OCR on just that region.
            </p>
            <div style="position: relative; max-width: 100%; border-radius: 8px; overflow: hidden; box-shadow: var(--shadow);">
                <img src="${imageDataUrl}" id="pageImage"
                     style="display:block; width:100%; height:auto;">
                <svg id="regionOverlay"
                     viewBox="0 0 ${width} ${height}"
                     preserveAspectRatio="xMidYMid meet"
                     style="position:absolute; top:0; left:0; width:100%; height:100%;">
                    ${svgRects}
                </svg>
            </div>
            <button class="action-button" style="margin-top: 18px;"
                    onclick="app.switchScreen('camera')">
                📷 Cancel & Rescan
            </button>
        `;

        this.switchScreen('entry');

        document.querySelectorAll('.word-region').forEach(rect => {
            rect.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                this.processSelectedWord(idx);
            });
        });
    }

    async processSelectedWord(index) {
        const region = this.wordRegions[index];
        if (!region || !this.currentImageData) return;

        this.switchScreen('processing');
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('ocrText').textContent =
            'Extracting and enhancing selected entry...';

        const img = new Image();
        await new Promise(resolve => {
            img.onload = resolve;
            img.src = this.currentImageData;
        });

        const enhanced = await this.enhanceAndCrop(img, region);
        await this.recognizeText(enhanced);
    }

    async enhanceAndCrop(img, region) {
        const scale = 4; // strong upscale for micro‑print
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = region.width * scale;
        canvas.height = region.height * scale;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            img,
            region.x, region.y, region.width, region.height,
            0, 0, canvas.width, canvas.height
        );

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // High-contrast B/W thresholding.
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            const v = gray > 145 ? 255 : 0;
            data[i] = data[i+1] = data[i+2] = v;
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    }

    // OCR

    async recognizeText(imageDataUrl) {
        try {
            document.getElementById('ocrText').textContent = 'Running OCR on entry...';

            const result = await Tesseract.recognize(
                imageDataUrl,
                'eng',
                {
                    logger: (m) => {
                        if (typeof m.progress === 'number') {
                            const pct = Math.round(m.progress * 100);
                            document.getElementById('progressFill').style.width = pct + '%';
                        }
                        if (m.status === 'recognizing text') {
                            document.getElementById('ocrText').textContent =
                                `Recognizing text… ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );

            const ocrText = result.data.text || '';
            document.getElementById('ocrText').textContent = ocrText;

            const parsed = parseOEDEntry(ocrText);

            if (this.isContinuation && this.partialEntry && parsed) {
                const merged = this.mergeEntries(this.partialEntry, parsed);
                this.isContinuation = false;
                this.partialEntry = null;
                this.displayEntry(merged);
                this.saveToRecentScans(merged);
            } else if (parsed && parsed.headword) {
                this.displayEntry(parsed);
                this.saveToRecentScans(parsed);
            } else {
                alert('Could not parse an entry from this OCR result. Try a tighter crop or clearer photo.');
                this.switchScreen('camera');
            }
        } catch (err) {
            console.error('OCR error', err);
            alert('Error during OCR: ' + err.message);
            this.switchScreen('camera');
        }
    }

    // ENTRY DISPLAY & MULTI-PAGE

    displayEntry(entry) {
        this.currentEntry = entry;
        const d = document.getElementById('entryDisplay');

        let html = `
            <div class="entry-header">
                <div class="headword">${escapeHtml(entry.headword)}</div>
                ${entry.pronunciation ? `<div class="pronunciation">${escapeHtml(entry.pronunciation)}</div>` : ''}
        `;

        if (!entry.isComplete) {
            html += `
                <div style="background:#f59e0b; color:white; padding:10px 12px; border-radius:6px; margin:8px 0;">
                    ⚠️ <span style="font-weight:600;">Entry may be incomplete.</span>
                    <span style="font-size:0.9em; margin-left:4px;">
                        This definition probably continues on the next page.
                    </span>
                </div>
            `;
        } else if (entry.overflowLikely) {
            html += `
                <div style="background:#7fa650; color:white; padding:10px 12px; border-radius:6px; margin:8px 0;">
                    💡 <span style="font-weight:600;">Entry might continue in the next column.</span>
                    <span style="font-size:0.9em; margin-left:4px;">
                        Capture the adjacent column to add more senses.
                    </span>
                </div>
            `;
        }

        html += `<div class="entry-meta">`;
        if (entry.partOfSpeech) {
            html += `<span class="badge">${escapeHtml(entry.partOfSpeech)}</span>`;
        }
        if (entry.etymologySource) {
            html += `<span class="badge">${escapeHtml(entry.etymologySource)}</span>`;
        }
        html += `</div></div>`;

        if (entry.etymology) {
            html += `
                <div class="section">
                    <div class="section-header">
                        <span class="collapse-icon">▼</span> Etymology
                    </div>
                    <div class="section-content">
                        ${escapeHtml(entry.etymology)}
                    </div>
                </div>
            `;
        }

        if (entry.senses && entry.senses.length) {
            html += `
                <div class="section">
                    <div class="section-header">
                        <span class="collapse-icon">▼</span> Definitions
                    </div>
                    <div class="section-content">
            `;
            entry.senses.forEach((s, idx) => {
                html += `
                    <div class="sense-item">
                        <span class="sense-number">${idx + 1}</span>
                        <div class="sense-text">${escapeHtml(s.definition || '')}</div>
                        ${s.quotations && s.quotations.length ? `
                            <div class="quotation">"${escapeHtml(s.quotations[0])}"</div>
                        ` : ''}
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        html += `
            <div style="margin-top:24px; display:flex; flex-wrap:wrap; gap:12px;">
                ${entry.continuationNeeded ? `
                    <button class="action-button" style="background:#f59e0b;" onclick="app.continueEntry()">
                        ➕ Scan next page
                    </button>
                ` : ''}
                ${entry.overflowLikely ? `
                    <button class="action-button" style="background:#7fa650;" onclick="app.addMoreContent()">
                        ➕ Add adjacent column
                    </button>
                ` : ''}
                <button class="action-button" onclick="app.saveEntry()">⭐ Save to collection</button>
                <button class="action-button" onclick="app.switchScreen('camera')">📷 Scan another</button>
            </div>
        `;

        d.innerHTML = html;
        this.switchScreen('entry');
    }

    continueEntry() {
        if (!this.currentEntry) return;
        this.partialEntry = { ...this.currentEntry };
        this.isContinuation = true;
        alert('Now capture the continuation of this entry on the next page.');
        this.switchScreen('camera');
    }

    addMoreContent() {
        if (!this.currentEntry) return;
        this.partialEntry = { ...this.currentEntry };
        this.isContinuation = true;
        alert('Capture the adjacent column where this entry continues.');
        this.switchScreen('camera');
    }

    mergeEntries(a, b) {
        if (!b) return a;
        return {
            headword: a.headword || b.headword,
            pronunciation: a.pronunciation || b.pronunciation,
            partOfSpeech: a.partOfSpeech || b.partOfSpeech,
            etymology: [a.etymology, b.etymology].filter(Boolean).join(' '),
            etymologySource: a.etymologySource || b.etymologySource,
            senses: [...(a.senses || []), ...(b.senses || [])],
            rawText: (a.rawText || '') + '\n\n[CONTINUED]\n\n' + (b.rawText || ''),
            isComplete: b.isComplete,
            continuationNeeded: b.continuationNeeded,
            overflowLikely: b.overflowLikely
        };
    }

    // COLLECTION

    async saveEntry() {
        if (!this.currentEntry) return;
        const entry = {
            ...this.currentEntry,
            savedAt: new Date().toISOString(),
            id: Date.now()
        };
        await saveEntryToDB(entry);
        alert('Entry saved to your collection.');
        this.loadRecentScans();
    }

    saveToRecentScans(entry) {
        let recent = JSON.parse(localStorage.getItem('recentScans') || '[]');
        recent = recent.filter(r => r.headword !== entry.headword);
        recent.unshift({ headword: entry.headword, timestamp: new Date().toISOString() });
        recent = recent.slice(0, 10);
        localStorage.setItem('recentScans', JSON.stringify(recent));
        this.loadRecentScans();
    }

    loadRecentScans() {
        const list = document.getElementById('recentList');
        const recent = JSON.parse(localStorage.getItem('recentScans') || '[]');
        if (!recent.length) {
            list.innerHTML = '<p style="color:var(--text-tertiary); font-size:0.9em;">No recent scans yet</p>';
            return;
        }
        list.innerHTML = recent.map(r => `
            <div class="collection-item" onclick="app.loadFromRecent('${r.headword.replace(/'/g, "\\'")}')">
                <div class="collection-item-word">${escapeHtml(r.headword)}</div>
                <div class="collection-item-date">${new Date(r.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    }

    async loadFromRecent(headword) {
        const all = await getAllEntries();
        const match = all.find(e => e.headword === headword);
        if (match) this.displayEntry(match);
    }

    async displayCollection() {
        const entries = await getAllEntries();
        const d = document.getElementById('collectionDisplay');
        if (!entries.length) {
            d.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⭐</div>
                    <div class="empty-state-text">No saved entries yet</div>
                    <div class="empty-state-subtext">Scan and save entries to build your collection.</div>
                </div>
            `;
            return;
        }
        d.innerHTML = `
            <div style="display:grid; gap:12px;">
                ${entries.map(e => `
                    <div class="collection-item" onclick="app.viewCollectionEntry(${e.id})">
                        <div class="collection-item-word">${escapeHtml(e.headword)}</div>
                        <div class="collection-item-date">
                            ${new Date(e.savedAt).toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async viewCollectionEntry(id) {
        const entry = await getEntryById(id);
        if (entry) this.displayEntry(entry);
    }

    async exportCollection() {
        const entries = await getAllEntries();
        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oed-collection-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async clearCollection() {
        await clearAllEntries();
        this.displayCollection();
        alert('Collection cleared.');
    }

    // SERVICE WORKER

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => console.log('SW registered', reg.scope))
                .catch(err => console.error('SW registration failed', err));
        }
    }
}

// Utils

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Initialize app
const app = new OEDReaderApp();
