// OED Reader - Main Application Logic
// Handles camera, OCR, UI state, and entry display

class OEDReaderApp {
    constructor() {
        this.currentEntry = null;
        this.videoStream = null;
        this.ocrWorker = null;
        this.currentTheme = localStorage.getItem('theme') || 'light';
        
        this.init();
    }

    async init() {
        this.setupTheme();
        this.setupEventListeners();
        this.loadRecentScans();
        await this.initOCR();
        this.registerServiceWorker();
    }

    setupTheme() {
        if (this.currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('[data-screen]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchScreen(e.target.dataset.screen);
                this.closeSidebar();
            });
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Camera
        const captureBtn = document.getElementById('captureButton');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => {
                console.log('Capture button event listener fired');
                this.captureImage();
            });
            console.log('Capture button listener attached');
        } else {
            console.error('Capture button not found!');
        }
        document.getElementById('uploadButton').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.processImage(e.target.files[0]);
            }
        });

        // OCR cancel
        document.getElementById('cancelOCR').addEventListener('click', () => {
            this.switchScreen('camera');
        });

        // Collection actions
        document.getElementById('exportButton').addEventListener('click', () => this.exportCollection());
        document.getElementById('clearButton').addEventListener('click', () => {
            if (confirm('Clear all saved entries? This cannot be undone.')) {
                this.clearCollection();
            }
        });

        // Sidebar toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            // Show on mobile, hide on desktop
            const updateMenuToggle = () => {
                menuToggle.style.display = window.innerWidth <= 768 ? 'block' : 'none';
            };
            updateMenuToggle();
            window.addEventListener('resize', updateMenuToggle);

            menuToggle.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('open');
            });
        }

        // Collapsible sections
        document.addEventListener('click', (e) => {
            if (e.target.closest('.section-header')) {
                e.target.closest('.section').classList.toggle('collapsed');
            }
        });
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.currentTheme);
        
        if (this.currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeToggle').textContent = '🌙';
        }
    }

    switchScreen(screenName) {
        // Update nav buttons
        document.querySelectorAll('[data-screen]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-screen="${screenName}"]`).classList.add('active');

        // Switch screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`${screenName}-screen`).classList.add('active');

        // Special handling for different screens
        if (screenName === 'camera') {
            this.startCamera();
        } else {
            this.stopCamera();
        }

        if (screenName === 'collection') {
            this.displayCollection();
        }
    }

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

            const video = document.getElementById('camera');
            video.srcObject = this.videoStream;

            // Wait for video metadata to load before enabling capture
            await new Promise((resolve) => {
                if (video.readyState >= 2) {
                    resolve();
                } else {
                    video.addEventListener('loadedmetadata', resolve, { once: true });
                }
            });

            // Ensure video is playing
            try {
                await video.play();
            } catch (playError) {
                console.log('Video autoplay handled by browser:', playError);
            }

            console.log('Camera ready:', video.videoWidth, 'x', video.videoHeight);
        } catch (error) {
            console.error('Camera access denied:', error);
            alert('Camera access is required to scan entries.');
        }
    }

    stopCamera() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
    }

    captureImage() {
        console.log('Capture button clicked');
        const video = document.getElementById('camera');
        const canvas = document.getElementById('captureCanvas');

        // Check if video is ready and has valid dimensions
        if (!video.videoWidth || !video.videoHeight) {
            alert('Camera is not ready yet. Please wait a moment and try again.');
            console.error('Video dimensions are 0:', video.videoWidth, video.videoHeight);
            return;
        }

        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        console.log('Drawing video to canvas...');
        ctx.drawImage(video, 0, 0);

        console.log('Converting canvas to blob...');
        try {
            canvas.toBlob((blob) => {
                console.log('Blob callback fired, blob:', blob);
                if (!blob) {
                    console.error('Blob is null or undefined');
                    alert('Failed to capture image. Please try again.');
                    return;
                }
                console.log('Blob size:', blob.size, 'bytes');
                this.processImage(blob);
            }, 'image/jpeg', 0.95);
        } catch (error) {
            console.error('Error in toBlob:', error);
            alert('Error capturing image: ' + error.message);
        }
    }

    async processImage(blob) {
        console.log('processImage called with blob:', blob);
        console.log('Switching to processing screen...');
        this.switchScreen('processing');

        const reader = new FileReader();
        reader.onload = async (e) => {
            console.log('FileReader loaded, starting OCR...');
            await this.recognizeText(e.target.result);
        };
        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('Error reading image file');
        };
        reader.readAsDataURL(blob);
        console.log('FileReader.readAsDataURL called');
    }

    async recognizeText(imageData) {
        try {
            document.getElementById('ocrText').textContent = 'Loading OCR engine...';
            
            const result = await Tesseract.recognize(
                imageData,
                'eng',
                {
                    logger: (m) => {
                        const percent = Math.round(m.progress * 100);
                        document.getElementById('progressFill').style.width = percent + '%';
                        
                        if (m.status === 'recognizing text') {
                            document.getElementById('ocrText').textContent = `Processing... ${percent}%`;
                        }
                    }
                }
            );

            const ocrText = result.data.text;
            document.getElementById('ocrText').textContent = ocrText;

            // Parse the OCR text into an entry
            const entry = parseOEDEntry(ocrText);
            
            if (entry && entry.headword) {
                this.displayEntry(entry);
                this.saveToRecentScans(entry);
            } else {
                alert('Could not parse entry from OCR. The text may be unclear.\n\nOCR result:\n' + ocrText.substring(0, 200));
                this.switchScreen('camera');
            }

        } catch (error) {
            console.error('OCR error:', error);
            alert('Error processing image: ' + error.message);
            this.switchScreen('camera');
        }
    }

    displayEntry(entry) {
        this.currentEntry = entry;
        const display = document.getElementById('entryDisplay');
        
        let html = `
            <div class="entry-header">
                <div class="headword">${escapeHtml(entry.headword)}</div>
                ${entry.pronunciation ? `<div class="pronunciation">${escapeHtml(entry.pronunciation)}</div>` : ''}
                <div class="entry-meta">
                    ${entry.partOfSpeech ? `<span class="badge">${escapeHtml(entry.partOfSpeech)}</span>` : ''}
                    ${entry.etymologySource ? `<span class="badge">${escapeHtml(entry.etymologySource)}</span>` : ''}
                </div>
            </div>
        `;

        // Etymology section
        if (entry.etymology) {
            html += `
                <div class="section">
                    <div class="section-header">
                        <span class="collapse-icon">▼</span>
                        Etymology
                    </div>
                    <div class="section-content">
                        ${escapeHtml(entry.etymology)}
                    </div>
                </div>
            `;
        }

        // Senses section
        if (entry.senses && entry.senses.length > 0) {
            html += `
                <div class="section">
                    <div class="section-header">
                        <span class="collapse-icon">▼</span>
                        Definitions
                    </div>
                    <div class="section-content">
            `;
            
            entry.senses.forEach((sense, idx) => {
                html += `
                    <div class="sense-item">
                        <span class="sense-number">${idx + 1}</span>
                        <div class="sense-text">${escapeHtml(sense.definition)}</div>
                        ${sense.quotations && sense.quotations.length > 0 ? `
                            <div class="quotation">"${escapeHtml(sense.quotations[0])}"</div>
                        ` : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Action buttons
        html += `
            <div style="margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="action-button" onclick="app.saveEntry()">⭐ Save to Collection</button>
                <button class="action-button" onclick="app.switchScreen('camera')">📷 Scan Another</button>
            </div>
        `;

        display.innerHTML = html;
        this.switchScreen('entry');
    }

    saveEntry() {
        if (!this.currentEntry) return;

        const entry = {
            ...this.currentEntry,
            savedAt: new Date().toISOString(),
            id: Date.now()
        };

        saveEntryToDB(entry).then(() => {
            alert('Entry saved to your collection!');
            this.loadRecentScans();
        });
    }

    saveToRecentScans(entry) {
        let recent = JSON.parse(localStorage.getItem('recentScans') || '[]');
        
        // Remove if exists, add to front
        recent = recent.filter(e => e.headword !== entry.headword);
        recent.unshift({
            headword: entry.headword,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 10
        recent = recent.slice(0, 10);
        
        localStorage.setItem('recentScans', JSON.stringify(recent));
    }

    loadRecentScans() {
        const recent = JSON.parse(localStorage.getItem('recentScans') || '[]');
        const list = document.getElementById('recentList');

        if (recent.length === 0) {
            list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.9em;">No recent scans yet</p>';
            return;
        }

        list.innerHTML = recent.map(item => `
            <div class="collection-item" onclick="app.loadFromRecent('${item.headword}')">
                <div class="collection-item-word">${escapeHtml(item.headword)}</div>
                <div class="collection-item-date">${new Date(item.timestamp).toLocaleDateString()}</div>
            </div>
        `).join('');
    }

    async displayCollection() {
        const entries = await getAllEntries();
        const display = document.getElementById('collectionDisplay');

        if (entries.length === 0) {
            display.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⭐</div>
                    <div class="empty-state-text">No saved entries yet</div>
                    <div class="empty-state-subtext">Scan and save entries to build your collection</div>
                </div>
            `;
            return;
        }

        let html = '<div style="display: grid; gap: 12px;">';
        entries.forEach(entry => {
            html += `
                <div class="collection-item" onclick="app.viewCollectionEntry(${entry.id})">
                    <div class="collection-item-word">${escapeHtml(entry.headword)}</div>
                    <div class="collection-item-date">
                        ${new Date(entry.savedAt).toLocaleDateString()} at ${new Date(entry.savedAt).toLocaleTimeString()}
                    </div>
                </div>
            `;
        });
        html += '</div>';

        display.innerHTML = html;
    }

    async viewCollectionEntry(id) {
        const entry = await getEntryById(id);
        if (entry) {
            this.displayEntry(entry);
        }
    }

    async initOCR() {
        // Tesseract will be loaded from CDN in index.html
        console.log('OCR engine ready (Tesseract.js loaded from CDN)');
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }

    async exportCollection() {
        const entries = await getAllEntries();
        const json = JSON.stringify(entries, null, 2);
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oed-collection-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async clearCollection() {
        await clearAllEntries();
        this.displayCollection();
        alert('Collection cleared.');
    }

    closeSidebar() {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize app
const app = new OEDReaderApp();