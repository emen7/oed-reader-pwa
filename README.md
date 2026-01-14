# OED Micro-Print Reader

A Progressive Web App (PWA) for scanning and beautifully displaying Oxford English Dictionary micro-print entries using Google Cloud Vision API for professional-quality OCR.

![Status](https://img.shields.io/badge/status-production-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![PWA](https://img.shields.io/badge/PWA-enabled-orange)

## ✨ Features

- **Smart Region Detection** - Automatically detects column layout and individual word entries
- **High-Quality OCR** - Uses Google Cloud Vision API for accurate text recognition of micro-print
- **Multi-Page Continuation** - Seamlessly merge entries that span multiple pages or columns
- **Offline Storage** - Save entries to your device for offline access with IndexedDB
- **Beautiful Display** - Clean, readable formatting with collapsible sections
- **PWA** - Install on your phone for a native app experience
- **Privacy-First** - Your API key and images stay on your device

## 🌐 Live Demo

[https://oed.ubdata.org](https://oed.ubdata.org)

## 🚀 Quick Start

### 1. Get a Google Cloud Vision API Key

The app requires a Google Cloud Vision API key for OCR. **Good news:** Google offers **1,000 free scans per month**!

**Step-by-step:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable the **Cloud Vision API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Cloud Vision API"
   - Click "Enable"
4. Create an API key:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy your new API key
5. **Recommended:** Restrict your API key:
   - Click on your API key to edit it
   - Under "API restrictions", select "Restrict key"
   - Choose "Cloud Vision API" from the dropdown
   - Under "Application restrictions", add `https://oed.ubdata.org/*` (or your domain)
   - Click "Save"

### 2. Configure the App

1. Open [https://oed.ubdata.org](https://oed.ubdata.org)
2. Click **⚙️ Settings** in the sidebar
3. Paste your API key
4. Click **💾 Save Key**
5. Click **🧪 Test Key** to verify
6. Start scanning!

## 📱 Installation

**Android:**
1. Open app in Chrome
2. Tap menu (⋮) → "Install app"
3. Launch from home screen

**iOS:**
1. Open app in Safari
2. Share → "Add to Home Screen"
3. Launch from home screen

## 🔍 How to Use

### Scanning an Entry

1. Click **📷 Scan Entry** to access your camera
2. Frame a micro-print entry
3. Tap **📸 Capture**
4. The app will:
   - Detect columns and word entries
   - Highlight detected regions
   - Let you tap a region to OCR just that entry
5. View the formatted result!

### Multi-Page Entries

If an entry spans multiple pages:

1. After scanning the first part, the app shows: **⚠️ Entry may be incomplete**
2. Click **➕ Scan next page**
3. Scan the continuation
4. The app automatically merges both parts

### Saving Entries

- Click **⭐ Save to collection** on any entry
- Access saved entries via **⭐ My Collection**
- Export your collection as JSON via **📥 Export Collection**

## 💰 Cost Information

**Google Cloud Vision API Pricing:**
- **Free tier:** 1,000 requests/month
- **After free tier:** $1.50 per 1,000 requests
- **For occasional use:** Most users stay within free tier

See [Google Cloud Vision Pricing](https://cloud.google.com/vision/pricing) for details.

## 🔐 Privacy & Security

- ✅ **Your API key** stored only on your device (localStorage)
- ✅ **OCR requests** go directly from browser to Google
- ✅ **No intermediary servers** - we never see your images or key
- ✅ **No tracking** - pure client-side PWA
- ✅ **Open source** - inspect the code yourself

## 📂 Project Structure

```
oed-reader-pwa/
├── index.html          # App shell with inline CSS
├── app.js              # Application logic
├── oedParser.js        # OED entry parser
├── storage.js          # IndexedDB wrapper
├── service-worker.js   # PWA offline support
├── manifest.json       # PWA manifest
└── README.md           # This file
```

## 🛠️ Technical Details

### Architecture

- **Smart Detection:** Analyzes page layout to find columns and word boundaries
- **Enhancement:** 4x upscaling with high-contrast thresholding for micro-print
- **Parser:** Heuristic-based OED structure detection (headword, pronunciation, etymology, senses)
- **Completeness:** Identifies incomplete entries via punctuation and quote analysis

### Browser Compatibility

Works on:
- iOS Safari (iPhone/iPad)
- Android Chrome
- Desktop Chrome/Edge/Firefox

Requires:
- Camera access
- Modern browser with JavaScript
- localStorage support

### Offline Functionality

- Service Worker caches app shell
- Saved entries in IndexedDB
- OCR requires internet (Vision API)

## 💡 Tips for Best Results

- Use good lighting (avoid shadows and glare)
- Hold camera steady
- Center the entry in frame
- Keep text sharp and focused
- The app works best with the OED Compact Edition micro-print format

## 🚀 Deploy Your Own Instance

```bash
# Clone repository
git clone https://github.com/yourusername/oed-reader-pwa.git
cd oed-reader-pwa

# Deploy to Vercel
npm install -g vercel
vercel --prod

# Or deploy to any static hosting (Netlify, GitHub Pages, etc.)
```

Ensure HTTPS is enabled (required for camera and PWA features).

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs via Issues
- Submit pull requests
- Suggest features
- Fork and customize

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Credits

Built with:
- Google Cloud Vision API
- Vanilla JavaScript (no frameworks!)
- Service Worker API
- IndexedDB

## 🔗 Related Projects

- [ubdata.org](https://ubdata.org) - Urantia Book research platform
- Main use case: Etymology research for Urantia Book terminology

---

**Built for micro-print enthusiasts**

Questions? Open an [issue](https://github.com/yourusername/oed-reader-pwa/issues)
