import { useState, useEffect, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import {
  readHotSeatSnapshot,
  writeHotSeatSnapshot,
  clearHotSeatSnapshot,
  readHotSeatServerId,
  writeHotSeatServerId,
} from '../utils/storage'

const MIN_HISTORY_MOVES = 6

export function useHotSeatGame({ isHotSeatMode, serverIp, serverPort, setGameId, clockLatest, onSaveStatus }) {
  const [hotSeatGame, setHotSeatGame] = useState(null)
  const [hotSeatCurrentPlayer, setHotSeatCurrentPlayer] = useState('w')
  // We need to mirror checks/gameover for UI
  const [localBoard, setLocalBoard] = useState(Array(8).fill([null, null, null, null, null, null, null, null]))
  const [localTurn, setLocalTurn] = useState('')
  const [localIsCheck, setLocalIsCheck] = useState(false)
  const [localIsGameOver, setLocalIsGameOver] = useState([false, { isCheckmate: false, isDraw: false, isStalemate: false }])
  const [localHistory, setLocalHistory] = useState([])
  
  const saveTimerRef = useRef(null)

  // Initialize
  useEffect(() => {
    if (!isHotSeatMode) return
    console.log('Initializing hot seat game…')
    try {
      const game = new Chess()
      setHotSeatGame(game)
      setHotSeatCurrentPlayer(game.turn()) // 'w'
      console.log('Hot seat game initialized successfully')
    } catch (error) {
      console.error('Failed to initialize hot seat game:', error)
    }
  }, [isHotSeatMode])

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
      onSaveStatus && onSaveStatus({ state: 'saved', timestamp: Date.now() })
      saveTimerRef.current = null
    }, 300)
  }, [hotSeatGame, clockLatest, onSaveStatus])

  const pushSnapshotToServer = useCallback(async (gameInstance, overrideGameId, gameIdCurrent) => {
    if (!gameInstance) return
    const movesCount = gameInstance.history().length
    const targetId = overrideGameId || gameIdCurrent
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
            if (setGameId) setGameId(gid)
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
          clocks: { whiteMs: clockLatest.whiteMs || 0, blackMs: clockLatest.blackMs || 0 },
          moves: movesPayload
        })
      })
    } catch (_) {}
  }, [serverIp, serverPort, isHotSeatMode, setGameId, clockLatest])

  // Update game position after move
  const updateHotSeatPosition = useCallback((gameInstance, gameIdCurrent) => {
    const game = gameInstance || hotSeatGame
    if (!game) return
    
    console.log('updateHotSeatPosition called')
    
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

    setLocalBoard(game.board())
    setLocalTurn(game.turn())
    setLocalIsCheck(game.isCheck())
    setLocalIsGameOver([game.isGameOver(), {
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
      isStalemate: game.isStalemate()
    }])
    setLocalHistory(game.history({verbose: true}).map(move => ({
      from: move.from,
      to: move.to,
      type: moveType,
      san: move.san
    })))
    
    // Switch current player
    setHotSeatCurrentPlayer(game.turn())

    persistHotSeatSnapshot(game)
    pushSnapshotToServer(game, null, gameIdCurrent)
  }, [hotSeatGame, persistHotSeatSnapshot, pushSnapshotToServer])

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

  return {
    hotSeatGame,
    setHotSeatGame,
    hotSeatCurrentPlayer,
    setHotSeatCurrentPlayer,
    localBoard,
    localTurn,
    localIsCheck,
    localIsGameOver,
    localHistory,
    updateHotSeatPosition,
    hydrateHotSeatGameFromSnapshot,
    pushSnapshotToServer, // exposed for resume flow
  }
}
