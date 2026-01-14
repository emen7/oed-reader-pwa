# Deployment Guide - OED Reader PWA

This guide walks you through deploying your OED Reader PWA to production.

## Prerequisites

- GitHub account
- Vercel account (free tier works great)
- Domain access for `ubdata.org` (for custom domain setup)

## Quick Deploy to Vercel (5 minutes)

### Step 1: Push to GitHub

```bash
# Initialize Git repository (if not already done)
cd oed-reader-pwa
git init
git add .
git commit -m "Initial commit - OED Micro-Print Reader PWA"

# Create new repo on GitHub
# Go to: https://github.com/new
# Name: oed-reader-pwa
# Description: "PWA for scanning Oxford English Dictionary micro-print with OCR"
# Public or Private (your choice)
# Do NOT initialize with README (we already have one)

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/oed-reader-pwa.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

**Option A: Via Vercel Dashboard (Easiest)**

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your `oed-reader-pwa` GitHub repository
4. Configure project:
   - **Framework Preset:** Other (no framework)
   - **Root Directory:** ./
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)
5. Click "Deploy"
6. Wait ~30 seconds for deployment to complete
7. You'll get a URL like: `https://oed-reader-pwa.vercel.app`

**Option B: Via Vercel CLI**

```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy from project directory
cd oed-reader-pwa
vercel --prod

# Follow prompts:
# - "Set up and deploy?" → Yes
# - "Link to existing project?" → No
# - "Project name?" → oed-reader-pwa
# - "Directory?" → ./ (press Enter)
# - Deployment complete!
```

### Step 3: Test the Deployment

1. Open the Vercel URL in your browser
2. Test on desktop first:
   - Camera access (should prompt for permission)
   - Upload image fallback
   - OCR processing
   - Entry display
   - Dark mode toggle
   - Save to collection
3. Test on your phone:
   - Open the URL in mobile browser
   - Grant camera permission
   - Try scanning an OED entry
   - Test installation (see Step 4)

### Step 4: Install on Phone

**Android (Chrome):**
1. Open the deployed URL in Chrome
2. Tap menu (⋮) → "Install app" or "Add to Home screen"
3. Confirm installation
4. App appears on home screen

**iOS (Safari):**
1. Open the deployed URL in Safari
2. Tap Share button
3. Scroll and tap "Add to Home Screen"
4. Name it "OED Reader"
5. Tap "Add"

## Custom Domain Setup (oed.ubdata.org)

### Step 1: Add Domain in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Click "Add Domain"
4. Enter: `oed.ubdata.org`
5. Click "Add"
6. Vercel will show DNS configuration instructions

### Step 2: Configure DNS

**You'll need to add a CNAME record in your DNS provider:**

**Record Details:**
- **Type:** CNAME
- **Name:** `oed` (or `oed.ubdata.org` depending on your DNS provider)
- **Value:** `cname.vercel-dns.com` (use the exact value Vercel provides)
- **TTL:** 3600 (or Auto)

**Common DNS Providers:**

**Cloudflare:**
1. Log into Cloudflare dashboard
2. Select `ubdata.org` domain
3. Go to DNS → Records
4. Click "Add record"
5. Set Type: CNAME, Name: `oed`, Target: `cname.vercel-dns.com`
6. Set Proxy status: DNS only (gray cloud)
7. Save

**Namecheap:**
1. Log into Namecheap
2. Domain List → Manage → Advanced DNS
3. Add New Record
4. Type: CNAME Record, Host: `oed`, Value: `cname.vercel-dns.com`
5. Save

**GoDaddy:**
1. Log into GoDaddy
2. My Products → DNS
3. Add → CNAME
4. Name: `oed`, Value: `cname.vercel-dns.com`
5. Save

### Step 3: Verify Domain

1. Wait 5-60 minutes for DNS propagation
2. In Vercel dashboard, check domain status
3. When verified, your app is live at: `https://oed.ubdata.org`
4. Vercel automatically provisions SSL certificate

### Step 4: Set as Primary Domain (Optional)

In Vercel → Settings → Domains:
- Click the ⋮ menu next to `oed.ubdata.org`
- Select "Set as Primary Domain"
- This makes it the canonical URL for your PWA

## Post-Deployment Checklist

- [ ] Test PWA on desktop browser
- [ ] Test camera access
- [ ] Test OCR processing
- [ ] Verify offline functionality (disconnect internet, reload)
- [ ] Test on Android phone
- [ ] Test on iOS phone
- [ ] Install to home screen on both platforms
- [ ] Test saved entries persist after closing app
- [ ] Verify dark mode toggle works
- [ ] Test export collection feature

## Updating the App

**To deploy updates:**

```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push origin main

# Vercel automatically redeploys
# Or manually redeploy from Vercel dashboard
```

**Service Worker Updates:**

When you update the app, users will get the new version automatically on next visit. The service worker handles cache updates.

If you change the service worker itself:
1. Increment `CACHE_NAME` (e.g., `'oed-reader-v2'`)
2. Commit and push
3. Vercel redeploys
4. Users get update on next app open

## Troubleshooting

### "Camera not working"
- Ensure app is served over HTTPS (Vercel does this automatically)
- Check browser permissions
- Try different browser

### "Service worker won't register"
- Check browser console for errors
- Verify all files in `ASSETS_TO_CACHE` exist
- Must be HTTPS (localhost also works for testing)

### "Installation prompt not showing"
- Clear browser data and revisit
- Check manifest.json is being served correctly
- PWA criteria: HTTPS, manifest, service worker, valid icons

### "DNS not resolving"
- Wait longer (DNS can take up to 48 hours, usually 5-60 minutes)
- Verify CNAME record is correct
- Check DNS propagation: https://dnschecker.org
- Ensure DNS record is not proxied (Cloudflare: set to DNS only)

## Performance Tips

**First Load Optimization:**
- Tesseract.js model (~100MB) downloads on first scan
- Subsequent scans are much faster (model is cached)
- Consider adding a "pre-load" button to download model in background

**Storage Management:**
- IndexedDB can store ~10,000 entries comfortably
- Export collection regularly as backup
- Consider adding auto-export feature

## Security Notes

- All processing is client-side (no server uploads)
- Camera images never leave the device
- IndexedDB data is encrypted by the browser
- No analytics or tracking
- No external dependencies except Tesseract.js CDN

## Next Steps

After deployment:
1. ✅ Test thoroughly on target devices
2. ✅ Update main site (ubdata.org) with link to OED tool
3. ✅ Share with beta testers
4. ✅ Gather feedback on OCR accuracy
5. ✅ Iterate on UI/UX based on real usage

## Support

- **Repository Issues:** https://github.com/YOUR_USERNAME/oed-reader-pwa/issues
- **Vercel Docs:** https://vercel.com/docs
- **PWA Reference:** https://web.dev/progressive-web-apps/

---

**Enjoy your OED Reader PWA! 📖✨**
