# ChessVermouth Migration Plan

**Goal:** Transform from LAN-only to cloud-based multiplayer accessible anywhere (including China), with mobile PWA support.

---

## Overview of Changes

| Component | From → To | Why |
|-----------|-----------|-----|
| Database | SQLite (local) → LeanCloud (cloud) | Shared access across networks |
| Stockfish | Server binary → Browser WASM | No engine server, runs locally |
| Push notifications | None → LeanCloud Push | "Your turn!" alerts |
| Frontend | Web app → PWA | Installable on mobile |
| Backend hosting | Local/LAN → Railway/Render | Always-on, accessible anywhere |

---

## Phase 1: Database Migration (LeanCloud)

**Status:** Pending
**Estimated effort:** 3-4 hours

### Tasks
- [ ] Create LeanCloud account (leancloud.cn)
- [ ] Create new app, get credentials (App ID, App Key, Server URL)
- [ ] Install LeanCloud JavaScript SDK: `npm install leancloud-storage`
- [ ] Create data model in LeanCloud (Games, Moves tables)
- [ ] Replace `server/db.js` with LeanCloud client
- [ ] Update server to use cloud DB instead of SQLite
- [ ] Test game persistence across networks

### Code Changes
**File:** `server/db.js`
```javascript
// Old: const Database = require('better-sqlite3');
// New:
import AV from 'leancloud-storage';

AV.init({
  appId: process.env.LEANCLOUD_APP_ID,
  appKey: process.env.LEANCLOUD_APP_KEY,
  serverURL: process.env.LEANCLOUD_SERVER_URL
});
```

---

## Phase 2: Stockfish WASM (Browser-Based)

**Status:** Pending
**Estimated effort:** 2-3 hours

### Tasks
- [ ] Download or reference stockfish-nnue.wasm (~15.7 MB)
- [ ] Integrate WASM in React app
- [ ] Replace engine server API calls with local WASM
- [ ] Remove engine server code (`src/server.ts`, `engine/` directory)
- [ ] Test AI analysis in browser
- [ ] Test on mobile Safari (iPhone)

### Code Changes
**File:** `client/src/App.jsx`
```javascript
// Add Stockfish WASM integration
// Use Web Worker to avoid blocking UI
```

---

## Phase 3: Backend Deployment (Railway)

**Status:** Pending
**Estimated effort:** 30 minutes

### Tasks
- [ ] Create Railway account (railway.app)
- [ ] Connect GitHub repository
- [ ] Configure environment variables:
  - `LEANCLOUD_APP_ID`
  - `LEANCLOUD_APP_KEY`
  - `LEANCLOUD_SERVER_URL`
  - `PORT`
- [ ] Deploy from GitHub
- [ ] Test always-on server

---

## Phase 4: Frontend PWA (Netlify/Vercel)

**Status:** Pending
**Estimated effort:** 1-2 hours

### Tasks
- [ ] Create `manifest.json` with app metadata
- [ ] Create `service-worker.js` for offline caching
- [ ] Add PWA meta tags to `index.html`
- [ ] Configure build settings for Vite
- [ ] Deploy to Netlify (better China routing)
- [ ] Test "Add to Home Screen" on iOS and Android

### New Files
- `client/public/manifest.json`
- `client/public/service-worker.js`
- Update `client/index.html`

---

## Phase 5: Push Notifications (LeanCloud)

**Status:** Pending
**Estimated effort:** 2-3 hours

### Tasks
- [ ] Enable LeanCloud Push service
- [ ] Install push SDK in client
- [ ] Request push notification permissions
- [ ] Integrate with game events (on opponent move)
- [ ] Test push notifications on mobile

---

## Services & Pricing

### Free Tiers (Sufficient for 2 players)

| Service | Free Tier | Paid Starts At |
|---------|-----------|----------------|
| **LeanCloud** | 30K API/day, 10K push/day | ¥30/day (商用版) |
| **Railway** | $5 credit/mo | Pay-as-you-go |
| **Netlify** | 100 GB bandwidth | $20/mo |
| **Stockfish WASM** | Free (open source) | N/A |

---

## Limitations & Considerations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| LeanCloud API limit | 30K requests/day shared | Plenty for 2 players |
| Stockfish WASM size | 15.7 MB first download | Cached after first load |
| PWA on iOS | Manual "Add to Home Screen" | User education |
| China blocking | Vercel may be slow | Use Netlify instead |
| Push notifications | Can be blocked | Handle gracefully |

---

## Decisions Needed

1. **Backend host:** Railway (recommended) vs Render vs Fly.io
2. **Frontend host:** Netlify (recommended for China) vs Vercel
3. **Room system:** Anonymous codes (simpler) vs accounts
4. **Stockfish loading:** Immediate vs lazy load (recommend lazy)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│   Frontend (Netlify) - React PWA                            │
│   - Chess board UI                                           │
│   - Stockfish WASM (runs in browser)                         │
│   - Socket.IO client                                         │
│   - LeanCloud SDK                                            │
└────────────┬────────────────────────────────────────────────┘
             │ Socket.IO (real-time)
             ▼
┌─────────────────────────────────────────────────────────────┐
│   Backend (Railway) - Express + Socket.IO                    │
│   - Game state management                                    │
│   - Real-time sync                                           │
│   - No engine server (Stockfish in browser)                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│   LeanCloud (China)                                          │
│   - Games database                                           │
│   - Push notifications                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `server/db.js` | Replace with LeanCloud SDK |
| `client/src/App.jsx` | Add Stockfish WASM, push notifications |
| `client/manifest.json` | **NEW** - PWA manifest |
| `client/service-worker.js` | **NEW** - Offline caching |
| `server/index.js` | Update for cloud DB (Socket.IO stays) |
| `.env` | Add LeanCloud credentials |
| `netlify.toml` / `vercel.json` | **NEW** - Deploy config |

---

**Last updated:** 2025-01-25
**Status:** Ready to begin implementation
