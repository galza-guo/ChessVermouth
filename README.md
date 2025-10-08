# ChessVermouth

A LAN-friendly multiplayer chess app with optional engine analysis.

- Frontend (React + Vite): default port `9518`
- Game Server (Express + Socket.IO): default port `3001`
- Engine Server (Stockfish 17.1 bridge): default port `8080` (optional for hints/analysis)

The app uses [Chess.js](https://www.npmjs.com/package/chess.js) for core chess rules.

## One‑Click Install (No prerequisites)

Pick the script for your OS; it installs Node.js and all project dependencies.

- macOS: run `install.sh`
- Windows: run `scripts/install.ps1` (right‑click → “Run with PowerShell”, ideally as Administrator)
- Linux: run `scripts/install_linux.sh` (you may be prompted for `sudo`)

After installation, launch with: `node chessvermouth.js`

## Quick Start (Option 1)

1. Run: `node chessvermouth.js`
2. Choose “Play Chess Now (Network Multiplayer)”
3. The launcher starts Engine + Server + Frontend, then prints a concise Status Summary with ports and URLs:
   - Local URL: `http://localhost:<clientPort>`
   - Network URLs (one per LAN IP): `http://<LAN_IP>:<clientPort>/?server=<LAN_IP>`
4. Other devices on the same LAN simply open the printed Network URL in a browser.

Notes:
- Node.js v18+ required for LAN mode.
- The Engine is optional; gameplay works without it (no hints/analysis).

## Menu Options (Launcher)

1. Play Chess Now (Network Multiplayer)
   - Starts Engine + Server + Frontend; opens browser. Best for most users.
2. Hot Seat Mode (Local Two Players)
   - Frontend only, fully offline on one device; no server/engine.
3. Start Server Only
   - Starts Engine + Server; prints Status Summary; does not start the frontend.
   - Pair with another machine running option 4, or just use option 1.
4. Launch Game Only
   - Starts Frontend only; opens browser; the app discovers a running server via `?server=`, env, hostname, and a small port scan.
5. Check System Status
   - Probes Engine/Server/Frontend on default port ranges and prints a Status Summary.
6. Install Dependencies
   - Installs/builds root (engine server), `server/`, and `client/` deps; fetches Stockfish.
7. Play Chess Now (Developer Mode)
   - Same as option 1, but runs the server via `nodemon` for hot reload.
8. Exit

## Ports

- Frontend: `9518` (falls back to a nearby free port)
- Server: `3001` (falls back to a nearby free port)
- Engine: `8080` (falls back to a nearby free port)

All services bind to LAN for easy device pairing on the same network. The launcher detects and lists all RFC1918 private addresses (10.*, 172.16–31.*, 192.168.*).

## Troubleshooting

- “Node 18+ required”: upgrade Node.js (use the OS script above or install from nodejs.org).
- Engine “not responding”: the launcher waits a few seconds for startup. It’s optional; gameplay still works without it.
- No server found in option 4: make sure a server is running (option 1 or 3), or add `?server=<LAN_IP>` to the URL.
- Silent client warning about Browserslist: suppressed by the launcher; harmless during dev.

## Credits

- Piece icons inspired by chess.com
- Thanks to the maintainers of Chess.js and Stockfish
