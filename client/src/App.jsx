import AnimatedPiece from './components/AnimatedPiece';
import PlayerBar from './components/PlayerBar';
import ControlPanel from './components/ControlPanel';
import GameJoinPanel from './components/GameJoinPanel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useSound from 'use-sound'

import { Chess } from 'chess.js'
import QRCode from 'qrcode'

import { bb, bk, bn, bp, bq, br, wb, wk, wn, wp, wq, wr, move, check, capture, castle, gameOver } from './assets'
import ResumeDialog from './components/ResumeDialog'
import PromotionDialog from './components/PromotionDialog'
import ConfirmDialog from './components/ConfirmDialog'


const icons = { bb, bk, bn, bp, bq, br, wb, wk, wn, wp, wq, wr }
const sounds = { move, check, capture, castle, gameOver }
const MIN_HISTORY_MOVES = 6

// Detect hot seat mode from URL parameter (SSR-safe)
const getUrlParams = () => {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
};
const urlParams = getUrlParams();
const isHotSeatMode = urlParams.get('mode') === 'hotseat';
// Frontend dev server indicator (Vite exposes this flag)
const isDevMode = import.meta.env.DEV === true;
// Prefer explicit ?server=, then env, then current host if not localhost, else fallback to 'localhost'
const inferredHost = (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? window.location.hostname
  : 'localhost';
const serverIp = urlParams.get('server') || import.meta.env.VITE_SERVER_IP || inferredHost;

function App() {
  const tableEnd = useRef(null)
  let dragged = ""
  const [moveSound] = useSound(sounds.move)
  const [checkSound] = useSound(sounds.check)
  const [captureSound] = useSound(sounds.capture)
  const [castleSound] = useSound(sounds.castle)
  const [gameOverSound] = useSound(sounds.gameOver)
  
  const soundboard = useMemo(() => ({
    move: moveSound,
    check: checkSound,
    capture: captureSound,
    castle: castleSound,
    gameOver: gameOverSound
  }), [moveSound, checkSound, captureSound, castleSound, gameOverSound])

  // Best move arrow for chessboard (updated by ControlPanel)
  const [bestMoveArrow, setBestMoveArrow] = useState(null)

  // Socket connection for network mode
  const [socket, setSocket] = useState(null)
  const [serverPort, setServerPort] = useState(() => {
    const envPort = import.meta.env.VITE_SERVER_PORT
    const n = envPort ? parseInt(envPort) : 3001
    return Number.isFinite(n) ? n : 3001
  })
  // Frontend (client) port inferred from current page or env
  const clientPort = useMemo(() => {
    const fromLoc = typeof window !== 'undefined' && window.location && window.location.port
      ? parseInt(window.location.port)
      : null
    if (Number.isFinite(fromLoc)) return fromLoc
    const envPort = import.meta.env.VITE_PORT
    const n = envPort ? parseInt(envPort) : 9518
    return Number.isFinite(n) ? n : 9518
  }, [])
  // Optional engine server port (for Stockfish analysis server)
  const enginePort = useMemo(() => {
    const env = import.meta.env.VITE_ENGINE_PORT
    const n = env ? parseInt(env) : 8080
    return Number.isFinite(n) ? n : 8080
  }, [])

  // Hot seat mode game state
  const [hotSeatGame, setHotSeatGame] = useState(null)
  const [hotSeatCurrentPlayer, setHotSeatCurrentPlayer] = useState('w')

  // Always initialize local Chess instance for hot seat logic
  useEffect(() => {
    console.log('Initializing hot seat game…')
    try {
      const game = new Chess()
      setHotSeatGame(game)
      setHotSeatCurrentPlayer(game.turn())
      console.log('Hot seat game initialized successfully')
    } catch (error) {
      console.error('Failed to initialize hot seat game:', error)
    }
  }, [])

  const [board, setBoard] = useState(Array(8).fill([null, null, null, null, null, null, null, null]))
  const [availableMoves, setAvailableMoves] = useState([])
  const [selectedSquare, setSelectedSquare] = useState('')
  const [turn, setTurn] = useState('')
  const [isCheck, setIsCheck] = useState(false)
  const [isGameOver, setIsGameOver] = useState([false, {
    isCheckmate: false,
    isDraw: false,
    isStalemate: false
  }])
  const [history, setHistory] = useState([])
  const [color, setColor] = useState('')
  const [gameId, setGameId] = useState('')
  const [pieceAnimNonce, setPieceAnimNonce] = useState(0) // increment to trigger piece hop-on animation
  const [status, setStatus] = useState(isHotSeatMode ? 'ready' : 'lobby')
  const [promotionRequired, setPromotionRequired] = useState(false)
  const [promotionData, setPromotionData] = useState(null)
  const [serverInfo, setServerInfo] = useState(null)
  // Resume modal (unfinished game)
  const [resumeModal, setResumeModal] = useState({ open: false, game: null })
  // QR code state (shared to lobby renderer)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  // Reset confirmation dialog
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  // Leave/New Game confirmation dialog
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [hotSeatResumeChecked, setHotSeatResumeChecked] = useState(false)
  // Clock reset signal (increments on new game/reset)
  const [clockResetNonce, setClockResetNonce] = useState(0)
  // Optional player names (for labels)
  const [playerName, setPlayerName] = useState('')
  const [opponentName, setOpponentName] = useState('')
  // Latest clock values from ControlPanel for snapshot and server persistence
  const [clockLatest, setClockLatest] = useState({ whiteMs: 0, blackMs: 0 })
  const [saveStatus, setSaveStatus] = useState({ state: 'idle', timestamp: null })
  const saveTimerRef = useRef(null)
  const clockLatestRef = useRef(clockLatest)
  const playerNameRef = useRef(playerName)
  const gameIdRef = useRef(gameId)
  const connectingRef = useRef(false)
  const [animatedPiece, setAnimatedPiece] = useState(null);
  useEffect(() => { clockLatestRef.current = clockLatest }, [clockLatest])
  useEffect(() => { playerNameRef.current = playerName }, [playerName])
  // Trigger piece hop-on animation on initial mount for HotSeat mode
  useEffect(() => {
    if (isHotSeatMode) {
      // Small delay to let board render first. 
      // check if we have a resumed game pending; if so, DON'T trigger animation yet (wait for dialog)
      const hasSaved = tryGetHotSeatSnapshot()
      if (!hasSaved) {
        const timer = setTimeout(() => setPieceAnimNonce((n) => n + 1), 100)
        return () => clearTimeout(timer)
      }
    }
  }, [isHotSeatMode])

  const tryGetHotSeatSnapshot = () => {
    try { 
      return !!localStorage.getItem('cv:hotseat-resume') 
    } catch { return false }
  }
  useEffect(() => { gameIdRef.current = gameId }, [gameId])
  // Emoji overlay bursts on/near the board
  const [emojiBursts, setEmojiBursts] = useState([])
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const sendEmoji = useCallback((src, label) => {
    // Add a transient emoji overlay inside the board area
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    // Random position within the board (10%..90%) to avoid edges
    const top = 10 + Math.random() * 80
    const left = 10 + Math.random() * 80
    setEmojiBursts((prev) => [...prev, { id, src, label: label || 'emoji', top, left }])
    // Auto-remove after 2.5s
    setTimeout(() => {
      setEmojiBursts((prev) => prev.filter((e) => e.id !== id))
    }, 2500)
  }, [])

  // Calculate captured pieces from history for PlayerBar display
  const { whiteCaptured, blackCaptured } = useMemo(() => {
    const white = [] // pieces captured BY white (black pieces taken)
    const black = [] // pieces captured BY black (white pieces taken)
    for (const move of history) {
      if (move.captured) {
        const capturedPiece = { type: move.captured, color: move.color === 'w' ? 'b' : 'w' }
        if (move.color === 'w') {
          white.push(capturedPiece)
        } else {
          black.push(capturedPiece)
        }
      }
    }
    return { whiteCaptured: white, blackCaptured: black }
  }, [history])


  const saveIndicator = useMemo(() => {
    const title = saveStatus.timestamp
      ? `Last saved ${new Date(saveStatus.timestamp).toLocaleTimeString()}`
      : 'No saved state yet'
    if (saveStatus.state === 'saving') {
      return (
        <span className='badge badge-warn animate-pulse w-16 justify-center' title={title}>
          Saving
        </span>
      )
    }
    if (saveStatus.state === 'idle' && !saveStatus.timestamp) return null
    return (
      <span className='badge w-16 justify-center border-emerald-500/30 bg-emerald-500/10 text-emerald-400' title={title}>
        Saved
      </span>
    )
  }, [saveStatus])

  const fetchHistoryGames = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await fetch(`http://${serverIp}:${serverPort}/games?status=all&limit=100`)
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setHistoryItems(Array.isArray(data.games) ? data.games : [])
    } catch (err) {
      setHistoryError(err.message || 'Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }, [serverIp, serverPort])
  useEffect(() => {
    if (!isContextMenuOpen) return
    const onClick = (e) => {
      const menu = document.querySelector('[data-context-menu="1"]')
      if (menu && !menu.contains(e.target)) {
        setIsContextMenuOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setIsContextMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('touchstart', onClick, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('touchstart', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [isContextMenuOpen])
  const performReset = () => {
    if (isHotSeatMode && hotSeatGame) {
      hotSeatGame.reset()
      updateHotSeatPosition()
      clearHotSeatSnapshot()
    } else if (socket) {
      socket.emit('reset', gameId)
    }
    setClockResetNonce((n) => n + 1)
    setResetConfirmOpen(false)
  }
  const performLeave = () => {
    if (isHotSeatMode) {
      if (hotSeatGame) {
        hotSeatGame.reset()
        updateHotSeatPosition()
        clearHotSeatSnapshot()
      }
    } else if (socket) {
      socket.emit('leave', gameId)
    }
    setClockResetNonce((n) => n + 1)
    setLeaveConfirmOpen(false)
  }

  // --- localStorage helpers for session and snapshots ---
  const readSession = useCallback(() => {
    try { const raw = localStorage.getItem('cv:session'); return raw ? JSON.parse(raw) : null } catch { return null }
  }, [])
  const writeSession = useCallback((s) => { try { localStorage.setItem('cv:session', JSON.stringify(s)) } catch {} }, [])
  const clearSession = useCallback(() => { try { localStorage.removeItem('cv:session') } catch {} }, [])
  const writeSnapshot = useCallback((id, snap) => { try { localStorage.setItem(`cv:snap:${id}`, JSON.stringify(snap)) } catch {} }, [])
  const clearSnapshot = useCallback((id) => { try { localStorage.removeItem(`cv:snap:${id}`) } catch {} }, [])
  const HOTSEAT_SERVER_KEY = 'cv:hotseat-server-id'
  const HOTSEAT_SNAPSHOT_KEY = 'cv:hotseat-resume'
  const readHotSeatSnapshot = useCallback(() => {
    try { const raw = localStorage.getItem(HOTSEAT_SNAPSHOT_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
  }, [])
  const writeHotSeatSnapshot = useCallback((payload) => {
    try { localStorage.setItem(HOTSEAT_SNAPSHOT_KEY, JSON.stringify(payload)) } catch {}
  }, [])
  const clearHotSeatSnapshot = useCallback(() => { try { localStorage.removeItem(HOTSEAT_SNAPSHOT_KEY) } catch {} }, [])
  const readHotSeatServerId = useCallback(() => {
    try { return localStorage.getItem(HOTSEAT_SERVER_KEY) || null } catch { return null }
  }, [])
  const writeHotSeatServerId = useCallback((id) => {
    try { localStorage.setItem(HOTSEAT_SERVER_KEY, id || '') } catch {}
  }, [])
  const persistHotSeatSnapshot = useCallback((gameInstance) => {
    const game = gameInstance || hotSeatGame
    if (!game) return
    const historyVerbose = game.history({ verbose: true })
    const historyData = historyVerbose.map((m) => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion || null,
      san: m.san,
      flags: m.flags,
      color: m.color,
      uci: `${m.from}${m.to}${m.promotion || ''}`
    }))
    const existing = readHotSeatSnapshot()
    const snapshot = {
      id: existing?.id || `hotseat-${Date.now()}`,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      moves: historyData.length,
      history: historyData,
      clocks: {
        whiteMs: Number.isFinite(clockLatest.whiteMs) ? clockLatest.whiteMs : 0,
        blackMs: Number.isFinite(clockLatest.blackMs) ? clockLatest.blackMs : 0
      },
      fen: game.fen(),
      pgn: game.pgn(),
      startFEN: 'startpos'
    }
    writeHotSeatSnapshot(snapshot)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus({ state: 'saved', timestamp: Date.now() })
      saveTimerRef.current = null
    }, 300)
  }, [hotSeatGame, clockLatest, readHotSeatSnapshot, writeHotSeatSnapshot])

  const pushSnapshotToServer = useCallback(async (gameInstance, overrideGameId) => {
    if (!gameInstance) return
    const movesCount = gameInstance.history().length
    const targetId = overrideGameId || gameIdRef.current
    if (!targetId && (!isHotSeatMode || movesCount < MIN_HISTORY_MOVES)) {
      return
    }
    let gid = targetId
    if (!gid && isHotSeatMode && movesCount >= MIN_HISTORY_MOVES) {
      try {
        const res = await fetch(`http://${serverIp}:${serverPort}/games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startFEN: 'startpos' })
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.game && data.game.id) {
            gid = data.game.id
            setGameId(gid)
            writeHotSeatServerId(gid)
          }
        }
      } catch (_) {}
    }
    if (!gid) return
    try {
      const historyVerbose = gameInstance.history({ verbose: true })
      const movesPayload = historyVerbose.map((m, idx) => ({
        ply: idx + 1,
        uci: `${m.from}${m.to}${m.promotion || ''}`,
        san: m.san || ''
      }))
      await fetch(`http://${serverIp}:${serverPort}/games/${gid}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: gameInstance.fen(),
          pgn: gameInstance.pgn({ maxWidth: 0, newline: '' }),
          clocks: { whiteMs: clockLatestRef.current.whiteMs || 0, blackMs: clockLatestRef.current.blackMs || 0 },
          moves: movesPayload
        })
      })
    } catch (_) {}
  }, [serverIp, serverPort, isHotSeatMode, setGameId, writeHotSeatServerId])
  const hydrateHotSeatGameFromSnapshot = useCallback((snapshot) => {
    if (!snapshot) return null
    const initialFen = snapshot.startFEN && snapshot.startFEN !== 'startpos' ? snapshot.startFEN : undefined
    const resumedGame = new Chess(initialFen)
    let loadedFromPgn = false
    if (snapshot.pgn) {
      try {
        loadedFromPgn = resumedGame.loadPgn(snapshot.pgn)
      } catch (_) {
        loadedFromPgn = false
      }
    }
    if (!loadedFromPgn && Array.isArray(snapshot.history)) {
      for (const step of snapshot.history) {
        const uci = step.uci || `${step.from}${step.to}${step.promotion || ''}`
        try { resumedGame.move(uci) } catch (_) {}
      }
    }
    return resumedGame
  }, [])

  const hydrateServerRecord = useCallback((record) => {
    if (!record) return null
    const startFENValue = record.startFEN && record.startFEN !== 'startpos' ? record.startFEN : undefined
    const chess = new Chess(startFENValue)
    const pgn = record.pgn
    if (pgn) {
      try {
        chess.loadPgn(pgn)
      } catch (_) {
        // fallback below
      }
    }
    if (!record.pgn || chess.history().length !== (Array.isArray(record.moves) ? record.moves.length : chess.history().length)) {
      if (Array.isArray(record.moves)) {
        chess.reset()
        if (startFENValue) chess.load(startFENValue)
        for (const mv of record.moves) {
          const uci = (mv && mv.uci) ? mv.uci : ''
          if (uci) {
            try { chess.move(uci) } catch (_) {}
          }
        }
      }
    }
    return chess
  }, [])

  useEffect(() => {
    if (!isHotSeatMode || hotSeatResumeChecked) return
    setHotSeatResumeChecked(true)
    const stored = readHotSeatSnapshot()
    if (stored) {
      setResumeModal({ open: true, game: stored })
    }
    const existing = readHotSeatServerId()
    if (existing) setGameId(existing)
  }, [isHotSeatMode, hotSeatResumeChecked, readHotSeatSnapshot, readHotSeatServerId])

  const getMoves = async (square) => {
    // Hot seat mode: use local chess.js for move validation
    if (isHotSeatMode) {
      if (hotSeatGame && hotSeatGame.turn() === hotSeatCurrentPlayer[0]) {
        const moves = hotSeatGame.moves({ square, verbose: true })
        setAvailableMoves(moves.map((move) => move.to))
      }
    }
    // Network mode: existing logic
    if (!isHotSeatMode && turn === color[0]) {
      let result = await fetch(`http://${serverIp}:${serverPort}/moves?square=${square}&gameId=${gameId}`)
      let data = await result.json()
      let moves = data.moves.map(move => move.to)
      setAvailableMoves(moves)
    }
  }

  

  useEffect(() => {
    if (history.length > 0) {
      let lastMove = history[history.length - 1]
      soundboard[lastMove.type]()
    }
    setSelectedSquare('')
    setAvailableMoves([])
  }, [history, soundboard])



  // Lock page scroll when lobby overlay is open (prevents iOS bounce showing content)
  useEffect(() => {
    const overlayOpen = !isHotSeatMode && (status === 'lobby' || status === 'fail')
    if (!overlayOpen) return
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverscroll = html.style.overscrollBehavior
    const prevBodyOverscroll = body.style.overscrollBehavior
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'contain'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      html.style.overscrollBehavior = prevHtmlOverscroll
      body.style.overscrollBehavior = prevBodyOverscroll
    }
  }, [status, isHotSeatMode])

  // Fetch server info (LAN IP) for display in lobby
  useEffect(() => {
    if (isHotSeatMode) return
    const controller = new AbortController()
    const fetchInfo = async () => {
      try {
        const res = await fetch(`http://${serverIp}:${serverPort}/server-info`, { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        setServerInfo(data)
      } catch (_) {
        // ignore
      }
    }
    fetchInfo()
    return () => controller.abort()
  }, [serverIp, serverPort, isHotSeatMode])

  const movePiece = (move) => {
    if (isHotSeatMode) {
      // Hot seat mode: handle moves locally
      if (hotSeatGame && hotSeatGame.turn() === hotSeatCurrentPlayer[0]) {
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const piece = hotSeatGame.get(from);
        setAnimatedPiece({ piece, from, to });
        setTimeout(() => {
          setSaveStatus({ state: 'saving', timestamp: Date.now() })
          try {
            let result = hotSeatGame.move(move)
            if (result) {
              // Check for pawn promotion
              if (result.flags && result.flags.includes('p')) {
                // Undo and prompt for promotion choice
                hotSeatGame.undo()
                setPromotionRequired(true)
                setPromotionData({
                  square: result.to,
                  color: result.color, // 'w' or 'b'
                  move: move,
                  from: result.from
                })
              } else {
                // Regular move - update position
                updateHotSeatPosition()
              }
            }
          } catch (error) {
            console.log('Invalid move:', error.message)
          }
          setAnimatedPiece(null);
        }, 200);
      }
    } else {
      // Network mode: existing logic
      if (turn === color[0]) {
        setSaveStatus({ state: 'saving', timestamp: Date.now() })
        const clocksPayload = { whiteMs: clockLatest.whiteMs || 0, blackMs: clockLatest.blackMs || 0 }
        socket.emit('move', { gameId: gameId, move: move, clocks: clocksPayload })
      }
    }
  }

  const updateHotSeatPositionRef = useRef(() => {})

  // Hot seat mode: update game position after move
  const updateHotSeatPosition = useCallback((gameInstance) => {
    const game = gameInstance || hotSeatGame
    if (!game) return
    
    console.log('updateHotSeatPosition called')
    console.log('Current board state:', game.board())
    
    let moveType = 'move'
    const history = game.history({verbose: true})
    
    if (history.length > 0) {
      let lastMove = history[history.length - 1]
      if (lastMove.flags.includes('k') || lastMove.flags.includes('q')) {
        moveType = 'castle'
      }
      if (lastMove.flags.includes('e') || lastMove.flags.includes('c')) {
        moveType = 'capture'
      }
      if (game.inCheck()) {
        moveType = 'check'
      }
      if (game.isGameOver()) {
        moveType = 'gameOver'
      }
    }

    const newBoard = game.board()
    const newTurn = game.turn()
    
    console.log('Setting board to:', newBoard)
    console.log('Setting turn to:', newTurn)
    
    setBoard(newBoard)
    setTurn(newTurn)
    setIsCheck(game.isCheck())
    setIsGameOver([game.isGameOver(), {
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
      isStalemate: game.isStalemate()
    }])
    setHistory(game.history({verbose: true}).map(move => ({
      from: move.from,
      to: move.to,
      type: moveType,
      san: move.san,
      captured: move.captured || null,
      color: move.color
    })))
    
    // Switch current player
    setHotSeatCurrentPlayer(game.turn())

    console.log('Board state updated successfully')
    persistHotSeatSnapshot(game)
    pushSnapshotToServer(game)
  }, [hotSeatGame, persistHotSeatSnapshot, pushSnapshotToServer])

  useEffect(() => {
    updateHotSeatPositionRef.current = updateHotSeatPosition
  }, [updateHotSeatPosition])

  const hotSeatGameOver = isGameOver[0]
  useEffect(() => {
    if (isHotSeatMode && hotSeatGameOver) {
      clearHotSeatSnapshot()
    }
  }, [isHotSeatMode, hotSeatGameOver, clearHotSeatSnapshot])

  useEffect(() => {
    if (!isHotSeatMode || !hotSeatGame) return
    console.log('Hot seat mode: Initializing game...')
    try {
      console.log('Initial board:', hotSeatGame.board())
      console.log('Initial turn:', hotSeatGame.turn())
      const storedSnapshot = readHotSeatSnapshot()
      if (!storedSnapshot) {
        updateHotSeatPositionRef.current()
      } else {
        console.log('Hot seat resume snapshot detected, waiting for user choice before updating board')
      }
    } catch (error) {
      console.error('Error initializing hot seat game:', error)
    }
  }, [isHotSeatMode, hotSeatGame, readHotSeatSnapshot])

  useEffect(() => {
    if (socket || connectingRef.current) return
    connectingRef.current = true
    let cancelled = false
    // Connect to socket server
    const connectSocket = async () => {
      const io = await import('socket.io-client')
      // Try env/default then a small range to handle occupied ports
      const base = (() => {
        const envPort = import.meta.env.VITE_SERVER_PORT
        const n = envPort ? parseInt(envPort) : 3001
        return Number.isFinite(n) ? n : 3001
      })()
      const candidates = Array.from({ length: 10 }, (_, i) => base + i)

      let connectedSocket = null
      console.log('[App] Attempting socket connection to', serverIp, 'on ports', candidates)
      for (const p of candidates) {
        try {
          console.log(`[App] Trying port ${p}...`)
          const s = io.connect(`http://${serverIp}:${p}`, { timeout: 1200, reconnection: false })
          const ok = await new Promise((resolve) => {
            const timer = setTimeout(() => { console.log(`[App] Port ${p} timeout`); resolve(false) }, 1200)
            s.on('connect', () => { clearTimeout(timer); console.log(`[App] Connected on port ${p}!`); resolve(true) })
            s.on('connect_error', (err) => { clearTimeout(timer); console.log(`[App] Port ${p} error:`, err.message); resolve(false) })
            s.on('error', (err) => { clearTimeout(timer); console.log(`[App] Port ${p} error:`, err); resolve(false) })
          })
          if (ok) {
            connectedSocket = s
            setServerPort(p)
            break
          } else {
            s.close()
          }
        } catch (e) {
          console.log(`[App] Port ${p} exception:`, e)
          // try next
        }
      }

      if (!connectedSocket) {
        console.error('[App] Failed to connect to server on any port')
        connectingRef.current = false
        return
      }
      const newSocket = connectedSocket
      console.log('[App] About to set socket, cancelled:', cancelled)
      // In React Strict Mode, cancelled might be true due to double-mounting
      // But if we have a valid connection, we should still set the socket
      if (cancelled && !newSocket.connected) {
        console.log('[App] Cancelled and socket not connected, aborting')
        newSocket.disconnect()
        connectingRef.current = false
        return
      }
      // If socket is still connected, use it even if cancelled flag is set
      console.log('[App] Setting socket, connected:', newSocket.connected)
      setSocket(newSocket)
      console.log('[App] Socket state updated, socket is now:', newSocket ? 'connected' : 'null')

      const handlePosition = (data) => {
        setBoard(data.position)
        setTurn(data.turn)
        setIsCheck(data.isCheck)
        setIsGameOver([data.isGameOver, {
          isCheckmate: data.isCheckmate,
          isDraw: data.isDraw,
          isStalemate: data.isStalemate
        }])
        setHistory(data.history)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          setSaveStatus({ state: 'saved', timestamp: Date.now() })
          saveTimerRef.current = null
        }, 300)
        // Tiny snapshot: fen/pgn/ply/updatedAt + last known clocks
        try {
          if (gameIdRef.current) {
            const snap = {
              id: gameIdRef.current,
              updatedAt: data.updatedAt || new Date().toISOString(),
              fen: data.fen || '',
              pgn: data.pgn || '',
              clocks: { whiteMs: clockLatestRef.current.whiteMs || 0, blackMs: clockLatestRef.current.blackMs || 0 },
              ply: typeof data.ply === 'number' ? data.ply : (Array.isArray(data.history) ? data.history.length : 0)
            }
            writeSnapshot(gameIdRef.current, snap)
          }
        } catch (_) {}
      }

      const handleTerminate = () => {
        setStatus('lobby')
        setGameId('')
        if (isHotSeatMode) writeHotSeatServerId('')
        setBoard(Array(8).fill([null, null, null, null, null, null, null, null]))
        setAvailableMoves([])
        setSelectedSquare('')
        setTurn('')
        setIsCheck(false)
        setIsGameOver([false, {
          isCheckmate: false,
          isDraw: false,
          isStalemate: false
        }])
        setHistory([])
        setColor('')
        setPromotionRequired(false)
        setPromotionData(null)
        setClockResetNonce((n) => n + 1)
      }

      const handlePromotionRequired = (data) => {
        setPromotionRequired(true)
        setPromotionData(data)
      }

      const handlePromotionComplete = () => {
        setPromotionRequired(false)
        setPromotionData(null)
        // Play promotion sound
        soundboard.move()
      }

      newSocket.on('position', handlePosition)
      newSocket.on('color', setColor)
      newSocket.on('status', (newStatus) => {
        setStatus(newStatus)
        // Trigger piece/tile animation when game starts or resumes (Online)
        if (newStatus === 'ready') {
          setPieceAnimNonce((n) => n + 1)
        }
      })
      newSocket.on('terminate', handleTerminate)
      newSocket.on('gameId', (gid) => {
        setGameId(gid)
        try {
          const currentName = playerNameRef.current
          if (currentName && typeof currentName === 'string' && currentName.trim()) {
            writeSession({ gameId: gid, playerName: currentName.trim() })
          }
        } catch (_) {}
      })
      newSocket.on('promotionRequired', handlePromotionRequired)
      newSocket.on('promotionComplete', handlePromotionComplete)
      // Persistence/resume events
      newSocket.on('unfinishedGames', ({ games }) => {
        try {
          if (readSession()) return
          if (Array.isArray(games) && games.length > 0) {
            // Show most recently updated unfinished game
            const g = games[games.length - 1]
            setResumeModal({ open: true, game: g })
          }
        } catch (_) {}
      })
      newSocket.on('resumed', ({ gameId: gid }) => {
        console.log('Game resumed', gid)
      })
      newSocket.on('resumeError', (e) => {
        console.warn('Resume error', e && e.error)
      })
      newSocket.on('gameFinished', ({ gameId: gid, result, finishedAt }) => {
        try {
          clearSession()
          clearSnapshot(gid)
          console.log(`Game ${gid} finished (${result}) at ${finishedAt}`)
        } catch (_) {}
      })
      newSocket.on('gameDiscarded', ({ gameId: gid }) => {
        setResumeModal((prev) => {
          if (prev.open && prev.game && prev.game.id === gid) {
            return { open: false, game: null }
          }
          return prev
        })
      })

      // Auto-resume if there is a saved session
      try {
        const sess = readSession()
        if (sess && sess.gameId) {
          newSocket.emit('resume', { gameId: sess.gameId, playerName: sess.playerName || '' })
        }
      } catch (_) {}
      newSocket.on('disconnect', () => {
        handleTerminate()
      })

      return () => {
        newSocket.off('position', handlePosition)
        newSocket.off('color', setColor)
        newSocket.off('status', setStatus)
        newSocket.off('terminate', handleTerminate)
        newSocket.off('promotionRequired', handlePromotionRequired)
        newSocket.off('promotionComplete', handlePromotionComplete)
        newSocket.off('disconnect')
        newSocket.disconnect()
      }
    }

    connectSocket().finally(() => {
      connectingRef.current = false
    })

    return () => {
      cancelled = true
    }
  }, [serverIp, serverPort, socket, readSession, writeSession, writeSnapshot, clearSession, clearSnapshot])

  // Hot seat mode: handle promotion
  const handlePromote = (piece) => {
    if (isHotSeatMode && promotionData) {
      try {
        let promotionMove = promotionData.move + piece
        let result = hotSeatGame.move(promotionMove)
        
        if (result) {
          setPromotionRequired(false)
          setPromotionData(null)
          updateHotSeatPosition()
          soundboard.move()
        }
      } catch (error) {
        console.log('Invalid promotion:', error.message)
      }
    } else if (!isHotSeatMode && socket) {
      // Network mode: existing logic
      socket.emit('promote', { gameId: gameId, piece: piece })
    }
  }

  //click
  const handleSquareClick = (e) => {
    // Click is bound to the square container; use currentTarget and data-square
    let square = e.currentTarget.getAttribute('data-square')

    if (selectedSquare !== square) {
      if (availableMoves.includes(square)) {
        movePiece(`${selectedSquare}${square}`)
      } else {
        setSelectedSquare(square)
        getMoves(square)
      }
    } else {
      setSelectedSquare('')
      setAvailableMoves([])
    }
  }

  const handleHotSeatResume = useCallback(() => {
    const snapshot = readHotSeatSnapshot()
    if (!snapshot) return
    const resumedGame = hydrateHotSeatGameFromSnapshot(snapshot)
    if (!resumedGame) return
    setHotSeatGame(resumedGame)
    setClockLatest({
      whiteMs: Number.isFinite(snapshot.clocks?.whiteMs) ? snapshot.clocks.whiteMs : 0,
      blackMs: Number.isFinite(snapshot.clocks?.blackMs) ? snapshot.clocks.blackMs : 0
    })
    setSaveStatus({ state: 'saving', timestamp: Date.now() })
    updateHotSeatPosition(resumedGame)
    setResumeModal({ open: false, game: null })
    // Trigger animation
    setTimeout(() => setPieceAnimNonce((n) => n + 1), 100)
  }, [hydrateHotSeatGameFromSnapshot, readHotSeatSnapshot, updateHotSeatPosition])

  const handleHotSeatDiscard = useCallback(() => {
    clearHotSeatSnapshot()
    setSaveStatus({ state: 'saving', timestamp: Date.now() })
    if (hotSeatGame) {
      hotSeatGame.reset()
      updateHotSeatPosition()
    }
    setResumeModal({ open: false, game: null })
    // Trigger animation
    setTimeout(() => setPieceAnimNonce((n) => n + 1), 100)
  }, [clearHotSeatSnapshot, hotSeatGame, updateHotSeatPosition])

  const handleHotSeatStartNew = useCallback(() => {
    clearHotSeatSnapshot()
    setSaveStatus({ state: 'saving', timestamp: Date.now() })
    if (hotSeatGame) {
      hotSeatGame.reset()
      updateHotSeatPosition()
    }
    setResumeModal({ open: false, game: null })
    // Trigger animation
    setTimeout(() => setPieceAnimNonce((n) => n + 1), 100)
  }, [clearHotSeatSnapshot, hotSeatGame, updateHotSeatPosition])

  const handleCopyBoard = useCallback(async () => {
    try {
      let finalPgn = ''
      let fenToSave = ''
      
      if (isHotSeatMode && hotSeatGame) {
        finalPgn = hotSeatGame.pgn()
        fenToSave = hotSeatGame.fen()
      } else if (!isHotSeatMode && history.length > 0) {
        // Replay history to generate PGN
        const tmp = new Chess()
        history.forEach(m => {
          try { tmp.move(m.san || m.uci) } catch (_) {}
        })
        finalPgn = tmp.pgn()
        fenToSave = tmp.fen()
      } else {
        // Fallback for empty/unknown
        finalPgn = ''
      }

      const payload = {
        type: 'chess-vermouth-snapshot',
        ver: '1.0',
        timestamp: Date.now(),
        pgn: finalPgn,
        clocks: clockLatestRef.current || { whiteMs: 300000, blackMs: 300000 },
        fen: fenToSave
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      alert('Chessboard state copied to clipboard.')
    } catch (e) {
      console.error('Copy failed', e)
      alert('Failed to copy to clipboard.')
    }
  }, [isHotSeatMode, hotSeatGame, history])

  const handlePasteBoard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const data = JSON.parse(text)
      if (data.type === 'chess-vermouth-snapshot' || data.pgn) {
        const snapshot = {
          id: `paste-${Date.now()}`,
          pgn: data.pgn || '',
          clocks: data.clocks || { whiteMs: 300000, blackMs: 300000 },
          history: [], // ResumeLogic will rebuild history from PGN
          fen: data.fen || 'startpos'
        }
        writeHotSeatSnapshot(snapshot)
        setResumeModal({ open: true, game: snapshot })
      } else {
        alert('Clipboard content is not a recognized game format.')
      }
    } catch (e) {
      console.error('Paste failed', e)
      alert('Failed to paste: ' + e.message)
    }
  }, [writeHotSeatSnapshot])

  const handleResumeDialogResume = useCallback(() => {
    if (isHotSeatMode) {
      handleHotSeatResume()
      return
    }
    try {
      const name = window.prompt('Enter your name (e.g., Gallant or Vermouth)') || ''
      if (socket && resumeModal.game) {
        socket.emit('resume', { gameId: resumeModal.game.id, playerName: name })
        writeSession({ gameId: resumeModal.game.id, playerName: name })
      }
      setResumeModal({ open: false, game: null })
    } catch (_) {}
  }, [isHotSeatMode, handleHotSeatResume, socket, resumeModal.game, writeSession])

  const handleResumeDialogDiscard = useCallback(() => {
    if (isHotSeatMode) {
      handleHotSeatDiscard()
      return
    }
    try {
      if (socket && resumeModal.game) socket.emit('discardGame', { gameId: resumeModal.game.id })
      setResumeModal({ open: false, game: null })
    } catch (_) {}
  }, [isHotSeatMode, socket, resumeModal.game, handleHotSeatDiscard])

  const handleResumeDialogStartNew = useCallback(() => {
    if (isHotSeatMode) {
      handleHotSeatStartNew()
      return
    }
    setResumeModal({ open: false, game: null })
  }, [isHotSeatMode, handleHotSeatStartNew])

  const handleHistoryContinue = useCallback(async (historyId) => {
    try {
      setHistoryLoading(true)
      const res = await fetch(`http://${serverIp}:${serverPort}/games/${historyId}`)
      if (!res.ok) throw new Error('Failed to load game')
      const data = await res.json()
      if (!data || !data.game) throw new Error('Game not found')
      const chess = hydrateServerRecord(data.game)
      if (!chess) throw new Error('Unable to load game state')
      setGameId(data.game.id)
      writeHotSeatServerId(data.game.id)
      setHotSeatGame(chess)
      setHotSeatCurrentPlayer(chess.turn())
      setIsHistoryOpen(false)
      setIsContextMenuOpen(false)
      setSaveStatus({ state: 'saving', timestamp: Date.now() })
      updateHotSeatPosition(chess)
      pushSnapshotToServer(chess, data.game.id)
      if (socket) {
        socket.emit('resume', { gameId: data.game.id, playerName: playerNameRef.current || '' })
      }
    } catch (err) {
      setHistoryError(err.message || 'Failed to continue game')
    } finally {
      setHistoryLoading(false)
    }
  }, [serverIp, serverPort, hydrateServerRecord, updateHotSeatPosition, pushSnapshotToServer, socket, writeHotSeatServerId])

  const handleHistoryDelete = useCallback(async (historyId) => {
    try {
      await fetch(`http://${serverIp}:${serverPort}/games/${historyId}`, { method: 'DELETE' })
      setHistoryItems((items) => items.filter((g) => g.id !== historyId))
      const stored = readHotSeatServerId()
      if (stored === historyId) {
        writeHotSeatServerId('')
        if (isHotSeatMode) setGameId('')
      }
    } catch (_) {}
  }, [serverIp, serverPort, readHotSeatServerId, writeHotSeatServerId, isHotSeatMode])
  //drag and drop
  const handleDragStart = async (e) => {
    // Drag starts on the piece image; it carries data-square
    dragged = e.target.getAttribute('data-square')

    let square = dragged
    if (selectedSquare !== square) {
      setSelectedSquare(square)
      getMoves(square)
    }
  }
  const handleDrop = (e) => {
    // Drop is handled on the square container
    let square = e.currentTarget.getAttribute('data-square')

    if (availableMoves.includes(square)) {
      movePiece(`${selectedSquare}${square}`)
    }
  }

  const handlePromotionCancel = () => {
    if (isHotSeatMode && promotionData) {
      // Default to queen on cancel in hot seat
      handlePromote('q')
    } else if (!isHotSeatMode && socket) {
      // Default to queen on cancel in network mode to avoid blocking the game
      socket.emit('promote', { gameId: gameId, piece: 'q' })
    }
  }

  return (
    <div className='min-h-[100svh] md:min-h-screen w-full text-zinc-100 select-none'>
      {/* Header */}
      <header className='sticky top-0 z-40'>
        <div className='mx-auto h-14 flex items-center justify-between' style={{ maxWidth: 'min(92vw, 500px)' }}>
          <div className='flex items-center gap-2'>
            <img src="/logo-text.png" alt="ChessVermouth" className='h-12' />
          </div>
          <div className='relative flex items-center gap-3 text-xs text-zinc-400'>
            {status === 'waiting' && <span className='badge-warn'>Waiting</span>}
            {saveIndicator}
            {isDevMode && <span className='badge badge-dev'>Dev</span>}
            <span className='badge'>{isHotSeatMode ? 'Hot Seat' : 'Online'}</span>
            {!isHotSeatMode && gameId && status === 'ready' && (
              <span>Session: <span className='font-mono text-rt-gold'>{gameId}</span></span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='mx-auto max-w-5xl w-full p-4 grid grid-cols-1 gap-4 items-start justify-items-center'>
        <div className='flex flex-col items-center justify-center gap-2 w-full' style={{ maxWidth: 'min(92vw, 500px)' }}>
          {/* Top PlayerBar (Opponent) */}
          {(() => {
            // Determine which color is on top (opponent) and bottom (player)
            const playerColor = isHotSeatMode ? (hotSeatCurrentPlayer === 'w' ? 'white' : 'black') : (color || 'white')
            const opponentColor = playerColor === 'white' ? 'black' : 'white'
            const topMs = opponentColor === 'white' ? clockLatest.whiteMs : clockLatest.blackMs
            const bottomMs = playerColor === 'white' ? clockLatest.whiteMs : clockLatest.blackMs
            const topParts = { m: Math.floor(Math.max(0, topMs || 0) / 60000), s: Math.floor((Math.max(0, topMs || 0) % 60000) / 1000) }
            const bottomParts = { m: Math.floor(Math.max(0, bottomMs || 0) / 60000), s: Math.floor((Math.max(0, bottomMs || 0) % 60000) / 1000) }
            const activeTurnColor = (isHotSeatMode ? hotSeatCurrentPlayer : turn) === 'w' ? 'white' : 'black'
            const isPlaying = status === 'ready' && !(isGameOver && isGameOver[0])
            const topActive = isPlaying && activeTurnColor === opponentColor
            const bottomActive = isPlaying && activeTurnColor === playerColor
            // Captured pieces: show what the player captured (opponent's pieces)
            // Captured pieces: show what THAT player captured
            // whiteCaptured = pieces captured BY white (black pieces taken)
            // blackCaptured = pieces captured BY black (white pieces taken)
            // Top bar (opponent): show what opponent captured
            // Bottom bar (player): show what player captured
            const topCaptured = opponentColor === 'white' ? whiteCaptured : blackCaptured
            const bottomCaptured = playerColor === 'white' ? whiteCaptured : blackCaptured

            return (
              <>
                <PlayerBar
                  name={opponentName || (isHotSeatMode ? (opponentColor === 'white' ? 'White' : 'Black') : 'Opponent')}
                  side={opponentColor}
                  minutes={topParts.m}
                  seconds={topParts.s}
                  active={topActive}
                  capturedPieces={topCaptured}
                  icons={icons}
                  isTop={true}
                />
                {chessBoard({ board: board, handleSquareClick: handleSquareClick, handleDragStart: handleDragStart, handleDrop: handleDrop, availableMoves: availableMoves, history: history, isCheck: isCheck, isGameOver: isGameOver, turn: turn, selectedSquare: selectedSquare, color: playerColor, emojiBursts, animatedPiece, bestMoveArrow, pieceAnimNonce })}
                {animatedPiece && (
                  <AnimatedPiece
                    piece={animatedPiece.piece}
                    from={animatedPiece.from}
                    to={animatedPiece.to}
                    icons={icons}
                  />
                )}
                <PlayerBar
                  name={playerName || (isHotSeatMode ? (playerColor === 'white' ? 'White' : 'Black') : 'You')}
                  side={playerColor}
                  minutes={bottomParts.m}
                  seconds={bottomParts.s}
                  active={bottomActive}
                  capturedPieces={bottomCaptured}
                  icons={icons}
                  isTop={false}
                />
              </>
            )
          })()}

        </div>

        {/* Game Lobby overlay (does not affect ControlPanel) */}
        {((status === 'lobby' || status === 'fail') && !isHotSeatMode) && (
          <div className='fixed inset-x-0 top-0 z-[1200] w-screen h-[100dvh] flex items-center justify-center'>
            <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' aria-hidden='true'></div>
            <div className='relative z-10 w-full max-w-sm mx-4' role='dialog' aria-modal='true' aria-label='Game Lobby'>
              <GameJoinPanel
                socket={socket}
                status={status}
                color={color}
                gameId={gameId}
                serverIp={serverIp}
                serverInfo={serverInfo}
                clientPort={clientPort}
                isQrOpen={isQrOpen}
                setIsQrOpen={setIsQrOpen}
                qrDataUrl={qrDataUrl}
                setQrDataUrl={setQrDataUrl}
                qrLoading={qrLoading}
                setQrLoading={setQrLoading}
                setPlayerName={setPlayerName}
              />
            </div>
          </div>
        )}

        <Panel
          history={history}
          tableEnd={tableEnd}
          socket={socket}
          status={status}
          color={color}
          turn={turn}
          isGameOver={isGameOver}
          gameId={gameId}
          clockResetNonce={clockResetNonce}
          playerName={playerName}
          opponentName={opponentName}
          isHotSeatMode={isHotSeatMode}
          hotSeatCurrentPlayer={hotSeatCurrentPlayer}
          hotSeatGame={hotSeatGame}
          updateHotSeatPosition={updateHotSeatPosition}
          serverIp={serverIp}
          serverPort={serverPort}
          serverInfo={serverInfo}
          clientPort={clientPort}
          enginePort={enginePort}
          isQrOpen={isQrOpen}
          setIsQrOpen={setIsQrOpen}
          qrDataUrl={qrDataUrl}
          setQrDataUrl={setQrDataUrl}
          qrLoading={qrLoading}
          setQrLoading={setQrLoading}
          onRequestReset={() => setResetConfirmOpen(true)}
          onRequestLeave={() => setLeaveConfirmOpen(true)}
          onSendEmoji={sendEmoji}
          onClockUpdate={setClockLatest}
          onBestMoveChange={setBestMoveArrow}
          onMenuClick={() => setIsContextMenuOpen((v) => !v)}
          isMenuOpen={isContextMenuOpen}
          onCopyBoard={handleCopyBoard}
          onPasteBoard={handlePasteBoard}
          onHistoryClick={() => {
            setIsContextMenuOpen(false)
            setIsHistoryOpen(true)
            fetchHistoryGames()
          }}
          onResetClick={() => {
            setIsContextMenuOpen(false)
            setResetConfirmOpen(true)
          }}
          onLeaveClick={() => {
            setIsContextMenuOpen(false)
            setLeaveConfirmOpen(true)
          }}
        />
      </main>

      {/* Promotion Dialog */}
      {promotionRequired && promotionData && (
        <PromotionDialog 
          square={promotionData.square}
          color={promotionData.color}
          onPromote={handlePromote}
          onCancel={handlePromotionCancel}
        />
      )}

      {/* Reset Confirmation Dialog */}
      {resetConfirmOpen && (
        <ConfirmDialog
          title="Reset Game"
          message={isHotSeatMode
            ? 'Reset the current game? All progress will be lost.'
            : 'Reset the current game for both players? All progress will be lost.'}
          confirmText="Reset"
          cancelText="Cancel"
          onConfirm={performReset}
          onCancel={() => setResetConfirmOpen(false)}
        />
      )}

      {/* Leave/New Game Confirmation Dialog */}
      {leaveConfirmOpen && (
        <ConfirmDialog
          title={isHotSeatMode ? 'New Game' : 'Leave Game'}
          message={isHotSeatMode
            ? 'Start a new game? Current progress will be lost.'
            : 'Leave the current session and end this game?'}
          confirmText={isHotSeatMode ? 'New Game' : 'Leave'}
          cancelText="Cancel"
          onConfirm={performLeave}
          onCancel={() => setLeaveConfirmOpen(false)}
        />
      )}

      {/* Resume/Discard Prompt for unfinished game */}
      {resumeModal.open && resumeModal.game && (
        <ResumeDialog
          game={resumeModal.game}
          onResume={handleResumeDialogResume}
          onDiscard={handleResumeDialogDiscard}
          onStartNew={handleResumeDialogStartNew}
        />
      )}

      {isHistoryOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center px-4'>
          <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={() => setIsHistoryOpen(false)}></div>
          <div className='relative z-10 w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-900/95 p-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col'>
            <div className='flex items-center justify-between border-b border-white/10 pb-2 mb-3'>
              <div>
                <h3 className='text-lg font-semibold text-white'>Game History</h3>
                <p className='text-xs text-zinc-400'>Resume or delete past games</p>
              </div>
              <button className='px-3 py-1.5 rounded-md bg-zinc-700 text-white text-sm font-medium hover:bg-zinc-600' onClick={() => setIsHistoryOpen(false)}>Close</button>
            </div>
            <div className='flex-1 overflow-y-auto space-y-2 pr-1'>
              {historyLoading && <div className='text-sm text-zinc-400'>Loading…</div>}
              {historyError && <div className='text-sm text-rose-400'>{historyError}</div>}
              {!historyLoading && historyItems.length === 0 && !historyError && (
                <div className='text-sm text-zinc-400'>No games recorded yet.</div>
              )}
              {historyItems.map((g) => (
                <div key={g.id} className='rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2'>
                  <div>
                    <div className='text-white font-medium'>{g.id}</div>
                    <div className='text-xs text-zinc-400'>Status: {g.status === 'finished' ? (g.result || 'Finished') : 'Unfinished'} · Moves: {g.moves}</div>
                    <div className='text-xs text-zinc-500'>Last updated: {g.updatedAt ? new Date(g.updatedAt).toLocaleString() : 'n/a'}</div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      className='px-3 py-1.5 rounded-md bg-rt-gold text-rt-bg text-sm font-semibold hover:brightness-110'
                      onClick={() => handleHistoryContinue(g.id)}
                    >
                      Continue
                    </button>
                    <button
                      type='button'
                      className='px-3 py-1.5 rounded-md bg-red-600/80 text-white text-xs font-medium hover:bg-red-600'
                      onClick={() => handleHistoryDelete(g.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function chessBoard({board, handleSquareClick, handleDragStart, handleDrop, availableMoves, history, isCheck, isGameOver, turn, selectedSquare, color, emojiBursts, animatedPiece, bestMoveArrow, pieceAnimNonce}) {
  const numToLetter = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  
  // Refined Tactility Colors - Slate/Stone inspired
  const COLORS = {
    darkSquare: '#5A6872',     // Cool Slate Gray
    lightSquare: '#E8E4DC',    // Warm Stone Cream
    gold: '#C9A227',           // Antique Gold
    surface: '#1A1A24',        // Slate Depth (frame)
    text: '#EAEAF0',           // Primary text
  }
  
  // SVG noise texture for matte stone effect - medium grain, natural variation
  const textureStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.45' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.12'/%3E%3C/svg%3E")`,
  }

  // Parse best move arrow (e.g., "e2e4" or "g1f3")
  const parseArrow = (move) => {
    if (!move || move.length < 4) return null
    const from = move.slice(0, 2)
    const to = move.slice(2, 4)
    return { from, to }
  }

  // Convert square name to board percentage (0-100)
  const squareToPercent = (sq) => {
    const file = sq.charCodeAt(0) - 97 // a=0, h=7
    const rank = parseInt(sq[1]) - 1   // 1=0, 8=7
    const fileIdx = color === 'white' ? file : 7 - file
    const rankIdx = color === 'white' ? 7 - rank : rank
    return {
      x: (fileIdx + 0.5) * 12.5, // center of square
      y: (rankIdx + 0.5) * 12.5
    }
  }

  const arrowData = parseArrow(bestMoveArrow)
  let arrowSvg = null
  if (arrowData) {
    const fromPos = squareToPercent(arrowData.from)
    const toPos = squareToPercent(arrowData.to)
    
    // Calculate arrow path
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const headLen = 3 // arrowhead length in %
    const headWidth = 2.5 // arrowhead width in %
    const lineWidth = 1.2 // line width in %
    
    // Shorten line to account for arrowhead
    const ratio = (len - headLen) / len
    const midX = fromPos.x + dx * ratio
    const midY = fromPos.y + dy * ratio
    
    // Unit direction
    const ux = dx / len
    const uy = dy / len
    
    // Perpendicular for arrowhead
    const px = -uy * headWidth / 2
    const py = ux * headWidth / 2
    
    // Gold arrow to match Refined Tactility
    arrowSvg = (
      <svg
        className='absolute inset-0 w-full h-full pointer-events-none z-[5]'
        viewBox='0 0 100 100'
        preserveAspectRatio='none'
      >
        {/* Arrow line */}
        <line
          x1={fromPos.x}
          y1={fromPos.y}
          x2={midX}
          y2={midY}
          stroke='rgba(201, 162, 39, 0.7)'
          strokeWidth={lineWidth}
          strokeLinecap='round'
        />
        {/* Arrowhead */}
        <polygon
          points={`
            ${toPos.x},${toPos.y}
            ${midX + px},${midY + py}
            ${midX - px},${midY - py}
          `}
          fill='rgba(201, 162, 39, 0.7)'
        />
      </svg>
    )
  }

  const boardArr = []

  for (let i = 0; i < board.length; i++) {
    const boardInd = color === 'white' ? i : 7 - i
    const row = board[boardInd]

    for (let j = 0; j < board.length; j++) {
      const rowInd = color === 'white' ? j : 7 - j
      let square = row[rowInd]
      const coord = `${numToLetter[rowInd]}${8 - boardInd}`
      if (animatedPiece && animatedPiece.from === coord) {
        square = null
      }

      // Refined Tactility: Warm Walnut & Cream
      const isDarkSquare = (rowInd + boardInd) % 2 === 1
      const squareStyle = {
        backgroundColor: isDarkSquare ? COLORS.darkSquare : COLORS.lightSquare,
      }
      const coordStyle = {
        color: isDarkSquare ? 'rgba(232, 228, 220, 0.5)' : 'rgba(90, 104, 114, 0.5)',
      }

      // Calculate tile animation delay (ripple from center)
      // Center is (3.5, 3.5). Distance formula: sqrt((r-3.5)^2 + (c-3.5)^2)
      // boardInd = column, rowInd = row
      const distFromCenter = Math.sqrt(Math.pow(rowInd - 3.5, 2) + Math.pow(boardInd - 3.5, 2))
      const tileDelay = pieceAnimNonce > 0 ? distFromCenter * 60 : 0

      boardArr.push(
        <div
          key={`${coord}-${pieceAnimNonce}`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`relative square flex flex-col overflow-hidden ${pieceAnimNonce > 0 ? 'animate-tile-ripple' : ''}`}
          style={{
            ...squareStyle,
            opacity: 0, // Start invisible, animation sets opacity: 1
            animationDelay: `${tileDelay}ms`,
            animationFillMode: 'forwards',
          }}
          data-square={coord}
          onClick={handleSquareClick}
        >
          {/* Texture Overlay - Matte grain effect (dark squares only) */}
          {isDarkSquare && (
            <div className="absolute inset-0 pointer-events-none z-0" style={textureStyle} />
          )}

          {/* Coordinates */}
          {rowInd === (color === 'white' ? 0 : 7) && (
            <div
              data-square={coord}
              className='absolute z-10 text-[10px] font-medium left-1 top-0.5'
              style={coordStyle}
            >
              {8 - boardInd}
            </div>
          )}
          {boardInd === (color === 'white' ? 7 : 0) && (
            <div
              data-square={coord}
              className='absolute z-10 text-[10px] font-medium right-1 bottom-0.5'
              style={coordStyle}
            >
              {numToLetter[rowInd]}
            </div>
          )}

          {/* Piece Image - 2.5D lift with drop-shadow, hop-on animation */}
          {square != null && (
            <img
              key={`${coord}-${pieceAnimNonce}`}
              src={icons[`${square.color}${square.type}`]}
              data-square={coord}
              className={`relative m-auto z-20 h-[85%] w-[85%] transition-transform hover:scale-105 active:scale-95 ${pieceAnimNonce > 0 ? 'animate-tile-ripple' : ''}`}
              style={{ 
                filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.3))',
                // Ripple from center delay (synchronized with tiles)
                animationDelay: pieceAnimNonce > 0 
                  ? `${Math.sqrt(Math.pow(rowInd - 3.5, 2) + Math.pow(boardInd - 3.5, 2)) * 60}ms` 
                  : '0ms',
                opacity: 0, // Start invisible, animation sets opacity: 1
                animationFillMode: 'forwards',
              }}
              onDragStart={handleDragStart}
              draggable="true"
              alt={`${square.color}${square.type}`}
            />
          )}

          {squareUnderlay({ square, coord, history, availableMoves, isCheck, turn, selectedSquare })}
        </div>
      )
    }
  }

  return (
    // FRAME WRAPPER: Dark bezel with "Floating High" shadow
    <div
      className="relative p-1 rounded-lg"
      style={{
        background: COLORS.surface,
        boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div
        id="board"
        className='relative grid grid-rows-8 grid-cols-8 w-full h-full rounded-md overflow-hidden grabbable text-black'
        style={{ background: COLORS.surface }}
      >
        {boardArr}
        {/* Best move arrow overlay */}
        {arrowSvg}
        {/* Emoji overlays (transient) */}
        {Array.isArray(emojiBursts) && emojiBursts.map((e) => (
          <img
            key={e.id}
            src={e.src}
            alt={e.label || 'emoji'}
            className='pointer-events-none select-none absolute z-40'
            style={{
              top: `${e.top}%`,
              left: `${e.left}%`,
              transform: 'translate(-50%, -50%)',
              width: '64px',
              height: '64px',
              opacity: 0.95,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))'
            }}
          />
        ))}
        {/* GLASSMORPHISM Game Over Overlay */}
        {isGameOver[0] && (
          <div className='absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/50'>
            <div
              className='p-8 rounded-2xl flex flex-col items-center'
              style={{
                background: 'rgba(26, 26, 36, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div className='font-bold text-3xl mb-2' style={{ color: COLORS.text }}>
                Game Over
              </div>
              <div
                className='font-medium text-xl uppercase tracking-widest'
                style={{ color: COLORS.gold }}
              >
                {isGameOver[1].isCheckmate
                  ? 'Checkmate'
                  : isGameOver[1].isDraw
                  ? 'Draw'
                  : isGameOver[1].isStalemate
                  ? 'Stalemate'
                  : ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// Highlights squares and displays moves on the board - Refined Tactility
function squareUnderlay({ square, coord, history, availableMoves, isCheck, turn, selectedSquare }) {
  let availableMove = null
  let bgStyle = {}

  // Available Moves - Guide Indicators
  if (availableMoves.includes(coord)) {
    if (square != null) {
      // Capture Target: Soft dark ring
      availableMove = (
        <div
          style={{
            border: '4px solid rgba(0,0,0,0.25)',
            borderRadius: '50%',
            height: '100%',
            width: '100%',
          }}
          data-square={coord}
        />
      )
    } else {
      // Move Target: Soft dark dot
      availableMove = (
        <div
          data-square={coord}
          className='rounded-full h-[35%] w-[35%]'
          style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
        />
      )
    }
  }

  // Last Move Highlight - Gold Glaze
  if (history.length > 0) {
    const lastMove = history[history.length - 1]
    if (coord === lastMove.from || coord === lastMove.to) {
      bgStyle = { backgroundColor: 'rgba(201, 162, 39, 0.4)' }
    }
  }

  // Selected Square - Stronger Gold
  if (selectedSquare === coord && square != null) {
    bgStyle = { backgroundColor: 'rgba(201, 162, 39, 0.6)' }
  }

  // King in Check - Burgundy Rose
  if (square != null && square.type === 'k' && isCheck && square.color === turn) {
    bgStyle = { backgroundColor: 'rgba(166, 61, 64, 0.8)' }
  }

  return (
    <div
      data-square={coord}
      className='absolute transition-colors duration-200 z-10 w-full h-full flex items-center justify-center'
      style={bgStyle}
    >
      {availableMove}
    </div>
  )
}

//render the correct panel based on the game status
function Panel({ history, tableEnd, socket, status, color, turn, isGameOver, gameId, clockResetNonce, playerName, opponentName, isHotSeatMode, hotSeatCurrentPlayer, hotSeatGame, updateHotSeatPosition, serverIp, serverPort, serverInfo, clientPort, enginePort, isQrOpen, setIsQrOpen, qrDataUrl, setQrDataUrl, qrLoading, setQrLoading, onRequestReset, onRequestLeave, onSendEmoji, onClockUpdate, onBestMoveChange, onMenuClick, isMenuOpen, onHistoryClick, onResetClick, onLeaveClick, onCopyBoard, onPasteBoard }) {
  // Always render ControlPanel here; GameJoinPanel is now an overlay above the board
  return (
    <ControlPanel
      history={history}
      tableEnd={tableEnd}
      socket={socket}
      status={status}
      turn={turn}
      color={color}
      isGameOver={isGameOver}
      gameId={gameId}
      clockResetNonce={clockResetNonce}
      playerName={playerName}
      opponentName={opponentName}
      isHotSeatMode={isHotSeatMode}
      hotSeatCurrentPlayer={hotSeatCurrentPlayer}
      hotSeatGame={hotSeatGame}
      updateHotSeatPosition={updateHotSeatPosition}
      onRequestReset={onRequestReset}
      onRequestLeave={onRequestLeave}
      serverIp={serverIp}
      serverPort={serverPort}
      enginePort={enginePort}
      onSendEmoji={onSendEmoji}
      onClockUpdate={onClockUpdate}
      onBestMoveChange={onBestMoveChange}
      onMenuClick={onMenuClick}
      isMenuOpen={isMenuOpen}
      onHistoryClick={onHistoryClick}
      onResetClick={onResetClick}
      onLeaveClick={onLeaveClick}
      onCopyBoard={onCopyBoard}
      onPasteBoard={onPasteBoard}
    />
  )
}


export default App
