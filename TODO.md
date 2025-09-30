# ChessVermouth Development Roadmap

## High Priority Objectives

| Priority | Status | Issue | Description | Category |
|----------|--------|-------|-------------|----------|
| High | Pending | 🚀 One-Click Setup | Create GUI installer/package that handles all dependencies and setup automatically | User Experience |
| High | Pending | 🚀 One-Click Launch | Build simple GUI launcher for server and client (2-click max) | User Experience |
| High | Pending | 🚀 Remove Command Line Dependency | Eliminate need for terminal/CLI interaction throughout user journey | User Experience |
| High | Pending | ♟️ Pawn Promotion | Implement pawn promotion when pawns reach 8th rank - CORE GAME RULE | Game Logic |

## Medium Priority Objectives

| Priority | Status | Issue | Description | Category |
|----------|--------|-------|-------------|----------|
| Medium | Pending | 🤖 AI Analysis Integration | Add one-click AI strategy advisor that analyzes move history via API | AI Features |
| Medium | Pending | 🔔 Toast Notifications | Add user-friendly notifications and alerts | User Experience |

## Low Priority Objectives

| Priority | Status | Issue | Description | Category |
|----------|--------|-------|-------------|----------|
| Low | Pending | 🎨 UI Improvements | General visual enhancements and polish | Visual Design |

## Technical Issues & Improvements

| Priority | Status | Issue | Description | Category |
|----------|--------|-------|-------------|----------|
| High | Pending | 🔧 Create GUI Setup Tool | Build cross-platform installer (Electron/Tauri) that handles npm install, dependency checks, and configuration | Technical |
| High | Pending | 🔧 Build Launcher Application | Create simple GUI app with "Start Server" and "Launch Game" buttons | Technical |
| Medium | Pending | 🔧 AI API Integration | Design and implement API calls for chess analysis with move history payload | Technical |
| High | Pending | 🔧 Pawn Promotion Logic | Implement promotion dialog and backend handling - CRITICAL GAME RULE | Game Logic |
| Low | Pending | 🔧 Code Refactoring | Clean up hardcoded URLs, improve state management | Code Quality |
| Low | Pending | 🔧 Error Handling | Improve error recovery and user feedback | Technical |

## Missing Core Features

| Priority | Status | Issue | Description | Category |
|----------|--------|-------|-------------|----------|
| Medium | Pending | 🎯 Game Persistence | Add save/load functionality for games | Features |
| Low | Pending | 🎯 Spectator Mode | Allow observers to watch games | Features |
| Low | Pending | 🎯 Time Controls | Add chess clock functionality | Features |
| Low | Pending | 🎯 Move Analysis | Add hint system or move suggestions | Features |

## Technical Limitations to Address

| Priority | Status | Issue | Description | Category |
|----------|--------|-------|-------------|----------|
| Medium | Pending | 🌐 Network Limitations | Currently local-network only, consider internet multiplayer | Architecture |
| Low | Pending | 🔐 Authentication | No user accounts or player profiles | Architecture |
| Low | Pending | 💾 Database Integration | Games stored only in memory | Architecture |
| Low | Pending | 📝 TypeScript Migration | Add type safety to codebase | Code Quality |

## Current Implementation Issues

| Priority | Status | Issue | Description | Category |
|----------|--------|-------|-------------|----------|
| Medium | Pending | 🔗 Hardcoded URLs | Server URL hardcoded in client | Code Quality |
| Low | Pending | 🌍 Mixed Languages | Some Chinese comments in codebase | Code Quality |
| Low | Pending | 🏗️ Global State Management | Could be improved with proper state library | Architecture |

## Status Legend
- **Pending**: Not started
- **In Progress**: Currently being worked on
- **Testing**: Ready for testing/review
- **Completed**: Done and verified
- **Blocked**: Waiting on external factors

## Priority Legend
- **High**: Critical for user adoption and core functionality
- **Medium**: Important features that enhance user experience
- **Low**: Nice-to-have improvements and polish

## Category Legend
- **User Experience**: Direct impact on user interaction and ease of use
- **Technical**: Backend/implementation improvements
- **Game Logic**: Chess-specific functionality
- **Visual Design**: UI/appearance improvements
- **Features**: New functionality additions
- **Architecture**: System-level improvements
- **Code Quality**: Development and maintenance improvements

---

**Next Steps**: Focus on the high-priority one-click setup and launch objectives first, as these are critical for making the application accessible to everyday users who are intimidated by command-line interfaces.