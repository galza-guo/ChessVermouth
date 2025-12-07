# ChessVermouth Development Roadmap

## High Priority Objectives

| Priority | Status    | Issue                             | Description                                                                            | Category        |
| -------- | --------- | --------------------------------- | -------------------------------------------------------------------------------------- | --------------- |
| High     | Completed | 🚀 One-Click Setup                | Enhanced CLI menu with `chessvermouth.js` and `install.sh` for macOS                   | User Experience |
| High     | Completed | 🚀 One-Click Launch               | Interactive menu system - user selects "1" to play instantly                           | User Experience |
| Low      | Pending   | 🎯 App Bundle Creation            | Create double-clickable ChessVermouth.app for macOS Finder integration                 | User Experience |
| High     | Completed | 🚀 Remove Command Line Dependency | No raw CLI commands needed - guided menu interface                                     | User Experience |
| High     | Completed | ♟️ Pawn Promotion                 | Complete pawn promotion system with dialog UI - backend detection + frontend selection | Game Logic      |

## Medium Priority Objectives

| Priority | Status    | Issue                      | Description                                          | Category        |
| -------- | --------- | -------------------------- | ---------------------------------------------------- | --------------- |
| Medium   | Completed | 🤖 AI Analysis Integration | AI strategy advisor with Stockfish + LLM explanation | AI Features     |
| Medium   | Pending   | 🔔 Toast Notifications     | Add user-friendly notifications and alerts           | User Experience |

## Low Priority Objectives

| Priority | Status  | Issue              | Description                            | Category      |
| -------- | ------- | ------------------ | -------------------------------------- | ------------- |
| Low      | Pending | 🎨 UI Improvements | General visual enhancements and polish | Visual Design |

## Technical Issues & Improvements

| Priority | Status    | Issue                         | Description                                                                 | Category     |
| -------- | --------- | ----------------------------- | --------------------------------------------------------------------------- | ------------ |
| High     | Completed | 🔧 Create CLI Setup Tool      | Built `chessvermouth.js` with interactive menu and `install.sh` for macOS   | Technical    |
| High     | Completed | 🔧 Build Launcher Application | Interactive CLI menu with options 1-6, handles process management           | Technical    |
| Medium   | Pending   | 🔧 AI API Integration         | Design and implement API calls for chess analysis with move history payload | Technical    |
| High     | Completed | 🔧 Pawn Promotion Logic       | Implemented promotion dialog and backend handling                           | Game Logic   |
| Low      | Completed | 🔧 Code Refactoring           | App.jsx split from 2862→1706 lines, dead code removed                       | Code Quality |
| Low      | Pending   | 🔧 Error Handling             | Improve error recovery and user feedback                                    | Technical    |

## App Bundle Creation Plan (Low Priority - Future Enhancement)

### Objective

Create a true double-clickable macOS app bundle (ChessVermouth.app) that eliminates the need for Terminal navigation while maintaining the current CLI functionality.

### Implementation Strategy

**Phase 1: App Bundle Structure**

```
ChessVermouth.app/
├── Contents/
│   ├── Info.plist          # App metadata and configuration
│   ├── MacOS/
│   │   └── ChessVermouth   # Executable launcher script
│   └── Resources/
│       └── chess-icon.icns # Application icon
```

**Phase 2: Launcher Script**
Create executable that:

- Detects if Node.js is available
- Shows user-friendly error if setup needed
- Launches `chessvermouth.js` automatically
- Handles working directory navigation
- Provides macOS-native error dialogs

**Phase 3: Distribution Package**

```
ChessVermouth.dmg/
├── ChessVermouth.app/     # Main application
├── Applications/          # Shortcut to Applications folder
├── background.png         # Visual instructions
└── README.txt            # Simple setup instructions
```

**Phase 4: Enhanced Install Script**
Modify `install.sh` to:

- Create the .app bundle automatically
- Generate DMG distribution package
- Code-sign the app (optional, for Gatekeeper)
- Create both CLI and GUI entry points

### User Experience Flow

```
Download ChessVermouth.dmg → Double-click DMG →
Drag ChessVermouth.app to Applications →
Double-click ChessVermouth.app →
Game menu appears automatically!
```

### Technical Requirements

- **No Terminal knowledge required**
- **Works from any location** (Downloads, Desktop, Applications)
- **Handles missing dependencies gracefully**
- **Maintains CLI functionality** for power users
- **Cross-platform compatible** (Windows/Linux variants)

### Files to Create

1. `create-app-bundle.sh` - App bundle generator
2. `ChessVermouth.applescript` - AppleScript wrapper (backup method)
3. Enhanced `install.sh` with DMG creation
4. App icon design and creation

### Benefits

- **Consumer-grade experience** for everyday users
- **Familiar macOS conventions** (app in Applications folder)
- **No directory navigation required**
- **Professional appearance** vs CLI scripts
- **Gatekeeper compatibility** (with code signing)

This enhancement transforms ChessVermouth from a developer-friendly setup to a consumer-ready application while preserving all existing functionality.

## Missing Core Features

| Priority | Status    | Issue               | Description                                                | Category   |
| -------- | --------- | ------------------- | ---------------------------------------------------------- | ---------- |
| High     | Completed | 🎮 Hot Seat Mode    | Local multiplayer implemented - two players on same device | Game Modes |
| Low      | Pending   | 🤖 Play Against Bot | AI opponent with difficulty levels                         | Game Modes |

## Technical Limitations to Address

| Priority | Status      | Issue                   | Description                                                 | Category     |
| -------- | ----------- | ----------------------- | ----------------------------------------------------------- | ------------ |
| Medium   | Pending     | 🌐 Network Limitations  | Currently local-network only, consider internet multiplayer | Architecture |
| Low      | Pending     | 🔐 Authentication       | No user accounts or player profiles                         | Architecture |
| Low      | In Progress | 💾 Database Integration | JSON persistence implemented, SQLite migration planned      | Architecture |
| Low      | Pending     | 📝 TypeScript Migration | Add type safety to codebase                                 | Code Quality |

## Current Implementation Issues

| Priority | Status  | Issue                      | Description                                 | Category     |
| -------- | ------- | -------------------------- | ------------------------------------------- | ------------ |
| Medium   | Pending | 🔗 Hardcoded URLs          | Server URL hardcoded in client              | Code Quality |
| Low      | Pending | 🌍 Mixed Languages         | Some Chinese comments in codebase           | Code Quality |
| Low      | Pending | 🏗️ Global State Management | Could be improved with proper state library | Architecture |

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

**Next Steps**: Implement Hot Seat Mode (high priority) to enable local multiplayer on the same device, then work on Play Against Bot feature (low priority) for single-player gameplay.
