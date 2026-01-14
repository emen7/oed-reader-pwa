# OED Micro-Print Reader PWA

A progressive web app for scanning and displaying Oxford English Dictionary micro-print entries with camera-enabled OCR.

![Status](https://img.shields.io/badge/status-production-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![PWA](https://img.shields.io/badge/PWA-enabled-orange)

## ✨ Features

- 📸 **Camera Integration** - Real-time camera access on Android and iOS
- 🔍 **Client-Side OCR** - Tesseract.js processing (no server uploads)
- 📖 **Beautiful Display** - Clean typography with collapsible sections
- 🌙 **Dark Mode** - Toggle between light and dark themes
- 💾 **Offline Storage** - IndexedDB for local collection management
- 📱 **PWA Installation** - Add to home screen like a native app
- ⚡ **Offline First** - Full functionality without internet

## 🚀 Quick Start

### Deploy Your Own Instance

**1. Clone this repository:**
```bash
git clone https://github.com/YOUR_USERNAME/oed-reader-pwa.git
cd oed-reader-pwa
```

**2. Deploy to Vercel (1 minute):**
```bash
npm install -g vercel
vercel --prod
```

**3. Install on your phone:**
- Open the deployed URL
- Add to home screen (iOS Safari or Android Chrome)
- Start scanning!

See **[DEPLOY.md](DEPLOY.md)** for complete deployment instructions.

### Local Testing

```bash
# Use any static server
python3 -m http.server 8000
# Open http://localhost:8000
```

## 📱 Installation

**Android:**
1. Open app in Chrome
2. Tap menu (⋮) → "Install app"
3. Launch from home screen

**iOS:**
1. Open app in Safari
2. Share → "Add to Home Screen"
3. Launch from home screen

## 📂 Project Structure

```
oed-reader-pwa/
├── index.html           # App shell with inline CSS
├── app.js              # Core application logic
├── oedParser.js        # OCR text → OED entry parser
├── storage.js          # IndexedDB wrapper
├── service-worker.js   # Offline support
├── manifest.json       # PWA configuration
├── DEPLOY.md          # Deployment guide
├── SETUP.md           # Detailed setup instructions
└── README.md          # This file
```

## 🛠️ How It Works

1. **Capture** - Use camera or upload image
2. **OCR** - Tesseract.js processes the image client-side
3. **Parse** - Extract headword, pronunciation, etymology, definitions
4. **Display** - Beautifully formatted entry with collapsible sections
5. **Save** - Store in IndexedDB for offline access

## 💡 Tips for Best Results

- Use good lighting (avoid shadows and glare)
- Hold camera steady during capture
- Center the entry in the frame
- Keep text sharp and focused
- First scan takes longer (downloading OCR model)

## 🌐 Live Demo

**Production:** https://oed.ubdata.org

## 📊 Technical Details

- **Size:** ~82KB total (25KB gzipped)
- **OCR:** Tesseract.js v5 (100MB model, cached after first use)
- **Storage:** IndexedDB (~10,000 entries capacity)
- **Framework:** Vanilla JavaScript (no dependencies)
- **Compatibility:** Modern browsers with camera API support

## 🔐 Privacy

- ✅ 100% client-side processing
- ✅ No server uploads
- ✅ No analytics or tracking
- ✅ Offline-first architecture
- ✅ Data stays on your device

## 📖 Documentation

- **[DEPLOY.md](DEPLOY.md)** - Complete deployment walkthrough
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Technical overview

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs via Issues
- Submit pull requests
- Suggest features
- Fork and customize

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Oxford English Dictionary for the incredible micro-print edition
- Tesseract.js team for client-side OCR
- PWA community for web platform standards

## 🔗 Related Projects

- **[ubdata.org](https://ubdata.org)** - Urantia Book research platform
- Main use case: Etymology research for Urantia Book terminology

---

**Built with ❤️ for micro-print enthusiasts**

Questions? Open an [issue](https://github.com/YOUR_USERNAME/oed-reader-pwa/issues)
