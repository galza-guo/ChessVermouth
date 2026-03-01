# ChessVermouth PWA TODO

**目标:** 把ChessVermouth改造成可以在任何地方（包括中国）访问的PWA，支持多人对战和推送通知。

**核心架构:** LeanCloud一站式（数据库 + 实时通信 + 推送） + Stockfish WASM + PWA

---

## ✅ Phase 1: LeanCloud 一站式集成

**为什么:** 数据库 + 实时通信 + 推送通知，一个服务搞定，不需要自己搭服务器。

### Tasks
- [ ] 注册 leancloud.cn，创建应用
- [ ] 获取凭证: App ID, App Key, Server URL
- [ ] 安装SDK:
  ```bash
  npm install leancloud-storage leancloud-realtime
  ```
- [ ] 创建数据模型（Games表，匹配当前schema）
- [ ] 配置实时通信（LiveQuery订阅游戏更新）
- [ ] 配置推送通知
- [ ] 测试: 你下棋 → 老婆实时收到 + 收到推送

**预计时间:** 3-4小时

---

## ✅ Phase 2: Stockfish WASM (浏览器AI)

**为什么:** 去掉引擎服务器，Stockfish直接在浏览器运行。

### Tasks
- [ ] 下载 stockfish-nnue.wasm (hi-ogawa/Stockfish)
- [ ] 添加 Web Worker 集成到 `client/src/`
- [ ] 替换引擎API调用为本地WASM
- [ ] 删除 `src/server.ts` 和 `engine/` 目录
- [ ] 浏览器测试AI分析
- [ ] 移动Safari测试

**预计时间:** 2-3小时

---

## ✅ Phase 3: PWA 配置 (可安装)

**为什么:** iOS/Android "添加到主屏幕"体验。

### Tasks
- [ ] 创建 `client/public/manifest.json`
- [ ] 制作app图标 (192x192, 512x512)
- [ ] 添加manifest链接到 `client/index.html`
- [ ] 添加iOS meta标签
- [ ] iPhone测试 "添加到主屏幕"

**预计时间:** 1小时

---

## ✅ Phase 4: Service Worker (离线支持)

**为什么:** 断网也能继续，二次打开秒加载。

### Tasks
- [ ] 创建 `client/public/service-worker.js`
- [ ] 缓存策略: 静态资源cache-first, API网络优先
- [ ] 在 `client/main.jsx` 注册
- [ ] 测试离线模式

**预计时间:** 1小时

---

## ✅ Phase 5: 部署

**为什么:** 前端部署到CDN，全球访问。

### Frontend (Netlify)
- [ ] 注册 Netlify
- [ ] 连接 GitHub repo
- [ ] 配置构建: `npm run build` → `dist/`
- [ ] 配置环境变量 (LeanCloud凭证)
- [ ] 部署测试
- [ ] 从部署URL测试PWA安装

**预计时间:** 30分钟

---

## ✅ Phase 6: 终极测试

**为什么:** 给老婆用之前确保一切正常。

### 测试清单
- [ ] 跨网络: 你(WiFi) vs 老婆(移动)
- [ ] App切换: 切到微信再回来，游戏还在
- [ ] 推送通知: 你下棋，老婆收到推送
- [ ] 离线: 关WiFi重开，能继续
- [ ] PWA安装: iPhone "添加到主屏幕"
- [ ] Stockfish: 浏览器AI分析正常
- [ ] 中国访问: 不同网络都能玩

**预计时间:** 1小时

---

## 📁 新建文件

```
ChessVermouth/
├── client/
│   ├── public/
│   │   ├── manifest.json          ← PWA manifest
│   │   ├── service-worker.js      ← 离线缓存
│   │   ├── icon-192.png          ← App图标
│   │   └── icon-512.png          ← App图标
│   └── src/
│       ├── leancloud/            ← LeanCloud配置
│       │   ├── init.js
│       │   └── realtime.js        ← 实时通信
│       └── workers/
│           └── stockfish.worker.js ← WASM Worker
├── netlify.toml                  ← 部署配置
└── .env.production              ← 生产环境变量
```

---

## 🔧 修改文件

| 文件 | 改动 |
|------|------|
| `client/index.html` | 添加manifest链接、iOS meta标签 |
| `client/main.jsx` | 注册service worker |
| `client/src/App.jsx` | 添加Stockfish WASM、LeanCloud实时通信、推送 |
| `server/db.js` | 删除（改用LeanCloud） |
| `server/index.js` | 简化（移除本地DB逻辑） |
| `src/server.ts` | 删除（引擎服务器） |
| `engine/` | 删除整个目录 |

---

## 🎯 成功标准

完成后:
- ✅ 老婆点链接就能安装（无需App Store）
- ✅ 不同网络都能玩
- ✅ 切App游戏不丢
- ✅ AI分析秒开
- ✅ 推送通知正常
- ✅ 全部免费（LeanCloud免费额度 + Netlify免费）

---

## ⏱️ 时间估算

| 阶段 | 时间 |
|------|------|
| Phase 1: LeanCloud集成 | 3-4小时 |
| Phase 2: Stockfish WASM | 2-3小时 |
| Phase 3: PWA配置 | 1小时 |
| Phase 4: Service Worker | 1小时 |
| Phase 5: 部署 | 30分钟 |
| Phase 6: 测试 | 1小时 |
| **总计** | **~2天** |

---

## 🚀 开始

**从 Phase 1 开始:** 注册LeanCloud → 获取凭证 → 安装SDK

---

**最后更新:** 2025-01-29
**状态:** 准备开始
