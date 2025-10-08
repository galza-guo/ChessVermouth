const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
app.use(cors())
app.use(express.json())

const { Chess } = require('chess.js')
const os = require('os')
const { execSync } = require('child_process')

// Use dynamic port from environment variable or default to 3001
const PORT = process.env.PORT || 3001
// Use dynamic client port from environment variable or default to 9518
const CLIENT_PORT = process.env.CLIENT_PORT || 9518

let x = 233

// Get LAN IP address for network multiplayer
function getLanIp() {
  const interfaces = os.networkInterfaces()
  let fallback = 'localhost'
  let firstExternal = null
  for (const name of Object.keys(interfaces)) {
    for (const netIf of interfaces[name]) {
      if (netIf.family === 'IPv4' && !netIf.internal) {
        // Prefer RFC1918 private ranges
        if (
          netIf.address.startsWith('10.') ||
          netIf.address.startsWith('192.168.') ||
          (netIf.address.startsWith('172.') && (() => { const n = parseInt(netIf.address.split('.')[1], 10); return n >= 16 && n <= 31 })())
        ) {
          return netIf.address
        }
        if (!firstExternal) {
          firstExternal = netIf.address
        }
      }
    }
  }
  return firstExternal || fallback
}

const LAN_IP = process.env.LAN_IP || getLanIp()
const ENGINE_HOST = process.env.ENGINE_HOST || '127.0.0.1'
const ENGINE_PORT = process.env.ENGINE_PORT || '8080'
const ENGINE_BASE = process.env.ENGINE_BASE || `http://${ENGINE_HOST}:${ENGINE_PORT}`

// Proxy a subset of engine REST endpoints to avoid browser CORS issues
app.post('/engine/game/start', async (req, res) => {
  try {
    const r = await fetch(`${ENGINE_BASE}/game/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Engine proxy start failed' })
  }
})

app.post('/engine/game/move', async (req, res) => {
  try {
    const r = await fetch(`${ENGINE_BASE}/game/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Engine proxy move failed' })
  }
})

app.post('/engine/game/end', async (req, res) => {
  try {
    const r = await fetch(`${ENGINE_BASE}/game/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Engine proxy end failed' })
  }
})
// Try to detect Wi-Fi SSID/Network Name (best-effort, platform-specific)
function getNetworkName() {
  // Allow override
  if (process.env.NETWORK_NAME) return process.env.NETWORK_NAME
  const platform = process.platform
  try {
    if (platform === 'darwin') {
      // macOS: find Wi-Fi device then query its SSID
      try {
        const list = execSync('/usr/sbin/networksetup -listallhardwareports', { encoding: 'utf8' })
        const blocks = list.split(/\n\n+/)
        let wifiDev = null
        for (const b of blocks) {
          if (/Hardware Port:\s*(Wi-Fi|AirPort)/.test(b)) {
            const m = b.match(/Device:\s*(en\d+)/)
            if (m) { wifiDev = m[1]; break }
          }
        }
        if (wifiDev) {
          const out = execSync(`/usr/sbin/networksetup -getairportnetwork ${wifiDev}`, { encoding: 'utf8' })
          const m = out.match(/Current Wi-Fi Network:\s*(.+)/)
          if (m && m[1]) return m[1].trim()
        }
      } catch (_) {}
      try {
        const out = execSync('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I', { encoding: 'utf8' })
        const m = out.match(/\n\s*SSID:\s*(.+)\n/)
        if (m && m[1]) return m[1].trim()
      } catch (_) {}
    } else if (platform === 'linux') {
      // Linux: try iwgetid, then nmcli
      try {
        const out = execSync('iwgetid -r', { encoding: 'utf8' }).trim()
        if (out) return out
      } catch (_) {}
      try {
        const out = execSync('nmcli -t -f active,ssid dev wifi', { encoding: 'utf8' })
        const line = out.split('\n').find(l => l.startsWith('yes:'))
        if (line) {
          const ssid = line.split(':').slice(1).join(':').trim()
          if (ssid) return ssid
        }
      } catch (_) {}
    } else if (platform === 'win32') {
      // Windows: parse netsh output
      try {
        const out = execSync('netsh wlan show interfaces', { encoding: 'utf8' })
        const m = out.match(/\n\s*SSID\s*:\s*(.+)\n/i)
        if (m && m[1]) return m[1].trim()
      } catch (_) {}
    }
  } catch (_) {}
  return null
}
const NETWORK_NAME = getNetworkName()

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    // Allow dev clients from any origin (LAN dev convenience)
    origin: '*',
    methods: ["GET", "POST"],
    credentials: true
  }
})

const sendPosition = (emitter, gameId) => {
  let moveType = 'move'
  if(!games[gameId]) {
    return
  }
  let chess = games[gameId].game
  
  if(chess.history().length > 0) {
    let lastMove = chess.history({verbose: true})[chess.history().length - 1]
    if(lastMove.flags.includes('k') || lastMove.flags.includes('q')) {
      moveType = 'castle'
    }
    if(lastMove.flags.includes('e') || lastMove.flags.includes('c')) {
      moveType = 'capture'
    }
    if(chess.inCheck()) {
      moveType = 'check'
    }
    if(chess.isGameOver()) {
      moveType = 'gameOver'
    }
  }

  emitter.emit('position',{
    position: chess.board(),
    turn: chess.turn(),
    history: chess.history({verbose: true}).map(move => {
      return {
        from: move.from,
        to: move.to,
        type: moveType,
        san: move.san
      }
    }),
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
    isStalemate: chess.isStalemate(),
    isGameOver: chess.isGameOver()
  })
}

const games = {}
const sessions = {}

io.on('connection', (socket) => {
  // Utility: generate a random session id
  const genId = () => {
    let id = ''
    do {
      id = Math.random().toString(36).slice(2, 8).toUpperCase()
    } while (games[id])
    return id
  }

  // Utility: find the first waiting game (hosted, 1 player)
  const findWaitingGameId = () => {
    for (const [gid, g] of Object.entries(games)) {
      if (g && g.status === 'waiting' && g.numPlayers === 1 && g.players && g.players.host) {
        return gid
      }
    }
    return null
  }

  // On fresh connection, let clients know which names are currently claimed
  // for the first waiting game (best-effort; typical setup has a single session).
  const emitCurrentClaimsTo = (sock) => {
    const waiting = findWaitingGameId()
    if (waiting && games[waiting] && games[waiting].claimedNames) {
      sock.emit('nameClaims', { claimed: games[waiting].claimedNames })
    }
  }

  socket.on('join', (providedId) => {
    let gameId = (typeof providedId === 'string' && providedId.trim()) ? providedId.trim() : ''

    // If no id provided, auto-match: join a waiting game or create a new one
    if (!gameId) {
      const waiting = findWaitingGameId()
      if (waiting) {
        gameId = waiting
      } else {
        gameId = genId()
      }
    }

    if(!games[gameId]) {
      // Create a new game and wait for opponent
      socket.join(gameId)
      sessions[socket.id] = gameId
      socket.emit('gameId', gameId)
      games[gameId] = {
        game: new Chess(),
        numPlayers: 1,
        players: {
          host: socket.id,
          opponent: ''
        },
        status: 'waiting',
        // Track claimed quick-join names (Gallant/Vermouth) for lobby UX
        claimedNames: { Gallant: false, Vermouth: false },
        pendingPromotion: null
      }
      socket.emit('color', 'white')
      io.to(gameId).emit('status','waiting')
      sendPosition(io.to(gameId), gameId)
    } else if(games[gameId]['numPlayers'] === 1){
      // Join existing waiting game
      socket.join(gameId)
      sessions[socket.id] = gameId
      socket.emit('gameId', gameId)
      games[gameId]['numPlayers'] = 2
      games[gameId]['players']['opponent'] = socket.id
      socket.emit('color', 'black')
      games[gameId].status = 'ready'
      io.to(gameId).emit('status', 'ready')
      sendPosition(io.to(gameId), gameId)
    } else {
      // Game full
      socket.emit('status', 'fail')
    }
  })

  // Player claims a display name for quick-join (Gallant or Vermouth)
  socket.on('claimName', (name) => {
    try {
      const gameId = sessions[socket.id]
      if (!gameId || !games[gameId]) return
      if (!games[gameId].claimedNames) {
        games[gameId].claimedNames = { Gallant: false, Vermouth: false }
      }
      if (name === 'Gallant' || name === 'Vermouth') {
        games[gameId].claimedNames[name] = true
        // Broadcast globally so lobby clients (not in room) can update
        io.emit('nameClaims', { claimed: games[gameId].claimedNames })
      }
    } catch (_) {
      // ignore
    }
  })

  socket.on('move', (data) => {
    let gameId = data.gameId
    let move = data.move
    if(games[gameId].status === 'ready') {
      try {
        // Attempt the move
        let result = games[gameId].game.move(move)
        
        if (result) {
          // Check if this was a pawn promotion
          if (result.flags && result.flags.includes('p')) {
            // Pawn promotion detected - revert the tentative move and prompt the mover only
            games[gameId].game.undo()
            games[gameId].pendingPromotion = {
              square: result.to,
              color: result.color,
              from: result.from,
              playerSocketId: socket.id
            }

            // Send promotion required event to the player who moved
            socket.emit('promotionRequired', {
              square: result.to,
              color: result.color,
              availablePieces: ['q', 'r', 'b', 'n'],
              from: result.from
            })
          } else {
            // Regular move - send position update
            sendPosition(io.to(gameId), gameId)
          }
        } else {
          // Invalid move
          socket.emit('invalidMove', { error: 'Invalid move' })
        }
      } catch (error) {
        socket.emit('invalidMove', { error: error.message })
      }
    }
  })

  socket.on('reset', (gameId) => {
    if(games[gameId].status === 'ready') {
      games[gameId].game.reset()
      sendPosition(io.to(gameId), gameId)
    }
  })

  socket.on('undo', (gameId) => {
    if(games[gameId].status === 'ready') {
      games[gameId].game.undo()
      sendPosition(io.to(gameId), gameId)
    }
  })

  socket.on('promote', (data) => {
    let gameId = data.gameId
    let piece = data.piece // 'q', 'r', 'b', or 'n'
    
    if(games[gameId].status === 'ready' && games[gameId].pendingPromotion) {
      try {
        const pending = games[gameId].pendingPromotion
        // Only allow the player who made the move to choose the promotion
        if (pending.playerSocketId && pending.playerSocketId !== socket.id) {
          socket.emit('invalidPromotion', { error: 'Not your promotion' })
          return
        }
        // Complete the promotion move using object form
        let result = games[gameId].game.move({ from: pending.from, to: pending.square, promotion: piece })
        
        if (result) {
          // Clear pending promotion
          games[gameId].pendingPromotion = null
          
          // Send updated position
          sendPosition(io.to(gameId), gameId)
          
          // Send confirmation
          io.to(gameId).emit('promotionComplete', {
            square: result.to,
            piece: piece,
            color: result.color
          })
        } else {
          socket.emit('invalidPromotion', { error: 'Invalid promotion' })
        }
      } catch (error) {
        socket.emit('invalidPromotion', { error: error.message })
      }
    }
  })

  socket.on('leave', (gameId) => {
    //check if socket is host
    if(games[gameId].players.host === socket.id) {
      io.in(gameId).fetchSockets().then((sockets) => {
        for(let socket of sockets) {
          socket.leave(gameId)
          delete sessions[socket.id]
          socket.emit('terminate')
        }
      })
      delete games[gameId]
      //check is socket is player
    } else if (games[gameId].players.opponent === socket.id) {
      games[gameId]['numPlayers'] = 1
      games[gameId]['players']['opponent'] = ''
      games[gameId]['status'] = 'waiting'
      io.to(gameId).emit('status', 'waiting')
      delete sessions[socket.id]
      socket.leave(gameId)
      socket.emit('terminate')
    }
  })

  socket.on('disconnect', () => {
    //check if socket is in a session
    let gameId = ''
    if(sessions[socket.id]) {
      gameId = sessions[socket.id]
    }

    //if socket is in a session
    if(gameId !== '' && gameId) {
      console.log('gg', gameId)
      //if socket is a host
      if(games[gameId].players.host === socket.id) {
        //leave session and terminate the game
        io.to(gameId).emit('terminate')
        io.in(gameId).fetchSockets().then((sockets) => {
          for(let socket of sockets) {
            socket.leave(gameId)
            socket.emit('gameId', '')
          }
        })
        delete games[gameId]
      } else if(games[gameId].players.opponent === socket.id){
        games[gameId]['numPlayers'] = 1
        games[gameId]['players']['opponent'] = ''
        games[gameId]['status'] = 'waiting'
        io.to(gameId).emit('status', 'waiting')
        socket.leave(gameId)
      }
    }
  })

  // Send any existing claimed names for a waiting game to the newly connected client
  emitCurrentClaimsTo(socket)
})

app.get('/moves', (req, res) => {
  let gameId = req.query.gameId
  if(games[gameId]?.status !== 'ready') {
    res.send({
      moves: [],
      error: 'Game not ready'
    })
    return
  }
  try {
    res.send({
      moves: games[req.query.gameId].game.moves({square: req.query.square, verbose: true})
    })
  } catch(err){
    res.send({
      moves: [],
      error: err.message
    })
  }
})

// Endpoint to get server network info for LAN multiplayer
app.get('/server-info', (req, res) => {
  res.send({
    lanIp: LAN_IP,
    port: PORT,
    serverUrl: `http://${LAN_IP}:${PORT}`,
    networkName: NETWORK_NAME || null
  })
})

server.listen(PORT, '0.0.0.0', ()=>{
  console.log(`Server is online on port ${PORT}`)
  console.log(`Server accessible on all network interfaces`)
  console.log(`LAN IP for multiplayer: ${LAN_IP}:${PORT}`)
  if (NETWORK_NAME) {
    console.log(`Detected Wi-Fi SSID: ${NETWORK_NAME}`)
  }
})
