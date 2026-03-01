# ChessVermouth PWA Migration TODO

**Goal:** Transform ChessVermouth into an installable PWA with cloud backend, accessible anywhere (including China).

---

## ✅ Phase 1: LeanCloud Database (Cloud Storage)

**Why:** Shared game state between you and wife, accessible from anywhere.

### Tasks
- [ ] Sign up at leancloud.cn
- [ ] Create new app → Get App ID, App Key, Server URL
- [ ] Install SDK: `npm install leancloud-storage`
- [ ] Create Games table in LeanCloud (match current schema)
- [ ] Replace `server/db.js` with LeanCloud client
- [ ] Update `server/index.js` to use cloud DB
- [ ] Test: Create game from your device, open from wife's device

**Estimated time:** 3-4 hours

---

## ✅ Phase 2: Stockfish WASM (Browser-Based AI)

**Why:** Remove engine server, faster analysis, no infrastructure.

### Tasks
- [ ] Download stockfish-nnue.wasm files (use hi-ogawa/Stockfish)
- [ ] Add Web Worker integration in `client/src/`
- [ ] Replace engine proxy calls with local WASM
- [ ] Remove `src/server.ts` and `engine/` directory
- [ ] Test AI analysis in browser (Chrome/Safari)
- [ ] Test on mobile Safari

**Estimated time:** 2-3 hours

---

## ✅ Phase 3: PWA Configuration (Installable App)

**Why:** "Add to Home Screen" experience on iOS/Android.

### Tasks
- [ ] Create `client/public/manifest.json`:
  ```json
  {
    "name": "ChessVermouth",
    "short_name": "Chess",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#769656",
    "icons": [
      {
        "src": "/icon-192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/icon-512.png",
        "sizes": "512x512",
        "type": "image/png"
      }
    ]
  }
  ```
- [ ] Create app icons (192x192, 512x512)
- [ ] Add manifest link to `client/index.html`
- [ ] Add iOS meta tags to `client/index.html`
- [ ] Test "Add to Home Screen" on iPhone

**Estimated time:** 1-2 hours

---

## ✅ Phase 4: Service Worker (Offline Support)

**Why:** Games persist when connection drops, faster repeat loads.

### Tasks
- [ ] Create `client/public/service-worker.js`
- [ ] Cache strategy: cache-first for assets, network-first for API
- [ ] Register service worker in `client/main.jsx`
- [ ] Test offline mode (turn off WiFi, open app)
- [ ] Test cache busting on deploy

**Estimated time:** 1-2 hours

---

## ✅ Phase 5: Push Notifications (LeanCloud)

**Why:** Wife gets notified when you move.

### Tasks
- [ ] Enable LeanCloud Push service
- [ ] Install web push SDK in client
- [ ] Request notification permission on first load
- [ ] Send push on opponent move
- [ ] Test push on iPhone (background app)

**Estimated time:** 2-3 hours

---

## ✅ Phase 6: Deployment

**Why:** Always-on server, global CDN for frontend.

### Backend (Railway)
- [ ] Create Railway account
- [ ] Connect GitHub repo
- [ ] Set environment variables:
  ```
  LEANCLOUD_APP_ID=xxx
  LEANCLOUD_APP_KEY=xxx
  LEANCLOUD_SERVER_URL=https://xxx.leancloud.cn
  PORT=3001
  ```
- [ ] Deploy from GitHub
- [ ] Verify always-on server

### Frontend (Netlify)
- [ ] Create Netlify account
- [ ] Connect GitHub repo (client folder)
- [ ] Configure build command: `npm run build`
- [ ] Configure publish directory: `dist`
- [ ] Deploy
- [ ] Test PWA install from deployed URL

**Estimated time:** 30 minutes

---

## ✅ Phase 7: Testing

**Why:** Verify everything works before "shipping" to wife.

### Test Checklist
- [ ] Cross-network: You (WiFi) vs Wife (mobile)
- [ ] App switching: Switch to WeChat, come back, game persists
- [ ] Push notification: Wife gets notified when you move
- [ ] Offline: Turn off WiFi, reopen app, works
- [ ] PWA install: "Add to Home Screen" on iPhone
- [ ] Stockfish: AI analysis works in browser
- [ ] China access: Both can play from different networks

**Estimated time:** 1-2 hours

---

## 📁 New Files to Create

```
ChessVermouth/
├── client/
│   ├── public/
│   │   ├── manifest.json          ← NEW (PWA manifest)
│   │   ├── service-worker.js      ← NEW (offline caching)
│   │   ├── icon-192.png          ← NEW (app icon)
│   │   └── icon-512.png          ← NEW (app icon)
│   └── src/
│       └── workers/
│           └── stockfish.worker.js ← NEW (WASM worker)
├── server/
│   └── leancloud.js              ← NEW (replace db.js)
├── netlify.toml                  ← NEW (deploy config)
└── .env.production              ← NEW (production env vars)
```

---

## 🔧 Files to Modify

| File | Changes |
|------|---------|
| `client/index.html` | Add manifest link, iOS meta tags |
| `client/main.jsx` | Register service worker |
| `client/src/App.jsx` | Add Stockfish WASM, push notifications |
| `server/index.js` | Use LeanCloud instead of local DB |
| `server/db.js` | Replace with LeanCloud client |
| `package.json` (root) | Add LeanCloud dependencies |

---

## 🎯 Success Criteria

When done:
- ✅ Wife can install from a link (no App Store)
- ✅ You can play from different networks
- ✅ Games persist when switching apps
- ✅ AI analysis works instantly
- ✅ Push notifications work
- ✅ Everything is free (LeanCloud + Railway + Netlify)

---

## ⏱️ Total Estimated Time

| Phase | Time |
|-------|------|
| Phase 1: LeanCloud | 3-4 hours |
| Phase 2: Stockfish WASM | 2-3 hours |
| Phase 3: PWA Config | 1-2 hours |
| Phase 4: Service Worker | 1-2 hours |
| Phase 5: Push Notifications | 2-3 hours |
| Phase 6: Deployment | 30 min |
| Phase 7: Testing | 1-2 hours |
| **Total** | **~2-3 days** |

---

**Ready to start?** Begin with Phase 1 (LeanCloud setup).

**Last updated:** 2025-01-25
