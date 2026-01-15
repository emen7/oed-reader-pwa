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

        // Check for API key before starting camera
        if (!this.hasApiKey()) {
            this.showFirstRunMessage();
        } else {
            this.startCamera();
        }
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

        // Settings actions
        document.getElementById('saveApiKey')
            .addEventListener('click', () => this.saveApiKey());

        document.getElementById('testApiKey')
            .addEventListener('click', () => this.testApiKey());

        document.getElementById('clearApiKey')
            .addEventListener('click', () => {
                if (confirm('Clear your API key? You will need to re-enter it to use the scanner.')) {
                    this.clearApiKey();
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

        if (screenName === 'settings') {
            this.loadSettingsScreen();
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
        document.getElementById('ocrText').textContent = 'Analyzing full page with Vision API...';
        document.getElementById('progressFill').style.width = '0%';

        const reader = new FileReader();
        reader.onload = async (e) => {
            this.currentImageData = e.target.result;
            await this.analyzeFullPage(e.target.result);
        };
        reader.readAsDataURL(blob);
    }

    async analyzeFullPage(imageDataUrl) {
        // Check for API key
        if (!this.hasApiKey()) {
            alert('Please configure your Google Vision API key in Settings first.');
            this.switchScreen('settings');
            return;
        }

        try {
            document.getElementById('ocrText').textContent = 'Sending page to Vision API...';
            document.getElementById('progressFill').style.width = '25%';

            // Extract base64 data from data URL
            const base64Data = imageDataUrl.split(',')[1];

            const apiKey = this.getApiKey();
            const response = await fetch(
                `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: [{
                            image: { content: base64Data },
                            features: [
                                { type: 'DOCUMENT_TEXT_DETECTION' },
                                { type: 'TEXT_DETECTION' }
                            ]
                        }]
                    })
                }
            );

            document.getElementById('progressFill').style.width = '50%';

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Vision API request failed');
            }

            const result = await response.json();
            document.getElementById('progressFill').style.width = '75%';

            console.log('Vision API full response:', result);

            // Extract entries from structured document data
            const entries = this.extractEntriesFromVisionResponse(result.responses[0]);
            document.getElementById('progressFill').style.width = '100%';

            console.log('Extracted entries:', entries);

            if (entries.length === 0) {
                alert('No dictionary entries detected on this page. Try a clearer photo or different angle.');
                this.switchScreen('camera');
                return;
            }

            // Show entry selection UI
            this.showEntrySelectionUI(entries);

        } catch (err) {
            console.error('Vision API error', err);
            alert('Error analyzing page: ' + err.message);
            this.switchScreen('camera');
        }
    }

    // VISION API ENTRY EXTRACTION

    extractEntriesFromVisionResponse(response) {
        const entries = [];

        if (!response.fullTextAnnotation || !response.fullTextAnnotation.pages) {
            return entries;
        }

        const fullText = response.fullTextAnnotation.text || '';
        const pages = response.fullTextAnnotation.pages;

        // Get all paragraphs from all blocks
        const allParagraphs = [];
        pages.forEach(page => {
            page.blocks.forEach(block => {
                block.paragraphs.forEach(para => {
                    allParagraphs.push(para);
                });
            });
        });

        console.log(`Found ${allParagraphs.length} paragraphs`);

        // Extract headwords from paragraphs
        allParagraphs.forEach((para, idx) => {
            const paraText = this.getParagraphText(para);
            const headword = this.extractHeadword(para);

            if (headword && headword.length >= 2) {
                entries.push({
                    id: idx,
                    headword: headword,
                    paragraph: para,
                    fullText: paraText,
                    preview: paraText.substring(0, 100) + '...'
                });
            }
        });

        return entries;
    }

    getParagraphText(paragraph) {
        let text = '';
        paragraph.words.forEach(word => {
            const wordText = word.symbols.map(s => s.text).join('');
            text += wordText + ' ';
        });
        return text.trim();
    }

    extractHeadword(paragraph) {
        // Headword identification:
        // 1. Must be in first few words of paragraph
        // 2. Should have bold symbols OR be all caps
        // 3. Not part of previous entry (check position)

        if (!paragraph.words || paragraph.words.length === 0) {
            return null;
        }

        // Check first 3 words maximum
        const candidateWords = paragraph.words.slice(0, 3);
        let headword = '';

        for (const word of candidateWords) {
            const wordText = word.symbols.map(s => s.text).join('');
            const isBold = this.wordHasBoldSymbols(word);
            const isAllCaps = wordText === wordText.toUpperCase() && wordText.length > 1;

            // Stop if we hit a lowercase word (not part of headword)
            if (!isBold && !isAllCaps && wordText === wordText.toLowerCase()) {
                break;
            }

            // Add to headword if bold or all caps
            if (isBold || isAllCaps) {
                headword += wordText + ' ';
            }
        }

        return headword.trim();
    }

    wordHasBoldSymbols(word) {
        // Check if word has any bold symbols
        if (!word.symbols) return false;

        return word.symbols.some(symbol => {
            return symbol.property &&
                   symbol.property.detectedLanguages &&
                   symbol.property.detectedLanguages.some(lang =>
                       lang.confidence > 0.8
                   );
        });
    }

    showEntrySelectionUI(entries) {
        const display = document.getElementById('entryDisplay');

        // Store entries for batch processing
        this.detectedEntries = entries;

        const entriesList = entries.map(entry => `
            <div class="collection-item" style="padding: 12px 16px; margin-bottom: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg);">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" class="entry-checkbox" data-entry-id="${entry.id}"
                           style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--accent-primary); font-size: 0.95em; margin-bottom: 4px;">
                            ${escapeHtml(entry.headword)}
                        </div>
                        <div style="font-size: 0.85em; color: var(--text-secondary); line-height: 1.4;">
                            ${escapeHtml(entry.preview)}
                        </div>
                    </div>
                </label>
            </div>
        `).join('');

        display.innerHTML = `
            <h2 style="margin-bottom: 12px;">📖 Found ${entries.length} entries on this page</h2>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">
                Select entries to add to your collection. The app detected dictionary entries based on bold headwords.
            </p>

            <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="action-button" id="selectAllBtn" style="background: var(--accent-secondary);">
                    ✓ Select All
                </button>
                <button class="action-button" id="deselectAllBtn">
                    ✗ Deselect All
                </button>
            </div>

            <div style="max-height: 50vh; overflow-y: auto; margin-bottom: 16px;">
                ${entriesList}
            </div>

            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="action-button" id="processSelectedBtn" style="background: var(--accent-primary);">
                    ➕ Add Selected to Collection
                </button>
                <button class="action-button" onclick="app.switchScreen('camera')">
                    📷 Cancel & Rescan
                </button>
            </div>
        `;

        this.switchScreen('entry');

        // Add event listeners
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            document.querySelectorAll('.entry-checkbox').forEach(cb => cb.checked = true);
        });

        document.getElementById('deselectAllBtn').addEventListener('click', () => {
            document.querySelectorAll('.entry-checkbox').forEach(cb => cb.checked = false);
        });

        document.getElementById('processSelectedBtn').addEventListener('click', () => {
            this.processSelectedEntries();
        });
    }

    async processSelectedEntries() {
        const selectedIds = [];
        document.querySelectorAll('.entry-checkbox:checked').forEach(cb => {
            selectedIds.push(parseInt(cb.dataset.entryId));
        });

        if (selectedIds.length === 0) {
            alert('Please select at least one entry to process.');
            return;
        }

        this.switchScreen('processing');
        document.getElementById('ocrText').textContent = `Processing ${selectedIds.length} selected entries...`;
        document.getElementById('progressFill').style.width = '0%';

        let processed = 0;
        for (const id of selectedIds) {
            const entry = this.detectedEntries.find(e => e.id === id);
            if (entry) {
                // Parse the full text for this entry
                const parsed = parseOEDEntry(entry.fullText);
                if (parsed && parsed.headword) {
                    await saveEntryToDB({
                        ...parsed,
                        savedAt: new Date().toISOString(),
                        id: Date.now() + processed
                    });
                }
                processed++;
                const progress = Math.round((processed / selectedIds.length) * 100);
                document.getElementById('progressFill').style.width = progress + '%';
            }
        }

        document.getElementById('ocrText').textContent = `Successfully added ${processed} entries to your collection!`;

        // Show success message and redirect
        setTimeout(() => {
            this.loadRecentScans();
            alert(`✓ Added ${processed} entries to your collection!`);
            this.switchScreen('collection');
        }, 1500);
    }

    // API KEY MANAGEMENT

    hasApiKey() {
        return !!localStorage.getItem('google_vision_api_key');
    }

    getApiKey() {
        return localStorage.getItem('google_vision_api_key');
    }

    showFirstRunMessage() {
        const display = document.getElementById('entryDisplay');
        display.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 3em; margin-bottom: 20px;">🔑</div>
                <h2 style="margin-bottom: 16px; color: var(--accent-primary);">Welcome to OED Reader</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px; line-height: 1.6;">
                    To use this app, you'll need a Google Cloud Vision API key for professional-quality OCR.
                    Don't worry - it's free for up to 1,000 scans per month!
                </p>
                <button class="action-button" onclick="app.switchScreen('settings')">
                    ⚙️ Go to Settings
                </button>
            </div>
        `;
        this.switchScreen('entry');
    }

    loadSettingsScreen() {
        const apiKey = this.getApiKey();
        const input = document.getElementById('apiKeyInput');
        if (apiKey && input) {
            input.value = apiKey;
        }
    }

    saveApiKey() {
        const input = document.getElementById('apiKeyInput');
        const key = input.value.trim();

        if (!key) {
            this.showApiKeyStatus('Please enter an API key', 'error');
            return;
        }

        localStorage.setItem('google_vision_api_key', key);
        this.showApiKeyStatus('✓ API key saved successfully!', 'success');
    }

    async testApiKey() {
        const key = document.getElementById('apiKeyInput').value.trim();

        if (!key) {
            this.showApiKeyStatus('Please enter an API key first', 'error');
            return;
        }

        this.showApiKeyStatus('Testing API key...', 'info');

        try {
            // Create a small test image (1x1 white pixel as base64)
            const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

            const response = await fetch(
                `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: [{
                            image: { content: testImage },
                            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
                        }]
                    })
                }
            );

            if (response.ok) {
                this.showApiKeyStatus('✓ API key is valid and working!', 'success');
                localStorage.setItem('google_vision_api_key', key);
            } else {
                const error = await response.json();
                this.showApiKeyStatus(`✗ API key test failed: ${error.error?.message || 'Invalid key'}`, 'error');
            }
        } catch (err) {
            this.showApiKeyStatus(`✗ Test failed: ${err.message}`, 'error');
        }
    }

    clearApiKey() {
        localStorage.removeItem('google_vision_api_key');
        document.getElementById('apiKeyInput').value = '';
        this.showApiKeyStatus('API key cleared', 'info');
    }

    showApiKeyStatus(message, type) {
        const statusEl = document.getElementById('apiKeyStatus');
        statusEl.style.display = 'block';
        statusEl.textContent = message;

        const colors = {
            success: '#7fa650',
            error: '#dc2626',
            info: '#60a5fa'
        };

        statusEl.style.background = colors[type] || colors.info;
        statusEl.style.color = 'white';
    }

    // Note: recognizeText removed - we now use DOCUMENT_TEXT_DETECTION in analyzeFullPage

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
