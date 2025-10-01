import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useSound from 'use-sound'

import { Chess } from 'chess.js'
import QRCode from 'qrcode'

import { bb, bk, bn, bp, bq, br, wb, wk, wn, wp, wq, wr, move, check, capture, castle, gameOver } from './assets'
import PromotionDialog from './components/PromotionDialog'
import ConfirmDialog from './components/ConfirmDialog'

const icons = { bb, bk, bn, bp, bq, br, wb, wk, wn, wp, wq, wr }
const sounds = { move, check, capture, castle, gameOver }

// Detect hot seat mode from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const isHotSeatMode = urlParams.get('mode') === 'hotseat';
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
    const n = envPort ? parseInt(envPort) : 5173
    return Number.isFinite(n) ? n : 5173
  }, [])

  // Hot seat mode game state
  const [hotSeatGame, setHotSeatGame] = useState(null)
  const [hotSeatCurrentPlayer, setHotSeatCurrentPlayer] = useState('w')

  // Initialize hot seat game on mount if in hot seat mode
  useEffect(() => {
    if (isHotSeatMode) {
      console.log('Initializing hot seat game...')
      try {
        const game = new Chess()
        setHotSeatGame(game)
        setHotSeatCurrentPlayer(game.turn())
        console.log('Hot seat game initialized successfully')
      } catch (error) {
        console.error('Failed to initialize hot seat game:', error)
      }
    }
  }, []) // Only run once on mount

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
  const [status, setStatus] = useState(isHotSeatMode ? 'ready' : 'lobby')
  const [promotionRequired, setPromotionRequired] = useState(false)
  const [promotionData, setPromotionData] = useState(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [serverInfo, setServerInfo] = useState(null)
  // QR code state (shared to lobby renderer)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  // Reset confirmation dialog
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  // Leave/New Game confirmation dialog
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  // Clock reset signal (increments on new game/reset)
  const [clockResetNonce, setClockResetNonce] = useState(0)
  // Optional player names (for labels)
  const [playerName, setPlayerName] = useState('')
  const [opponentName, setOpponentName] = useState('')
  // When a confirmation dialog opens, collapse the floating control panel
  useEffect(() => {
    if (resetConfirmOpen || leaveConfirmOpen) {
      setIsPanelOpen(false)
    }
  }, [resetConfirmOpen, leaveConfirmOpen])
  const performReset = () => {
    if (isHotSeatMode && hotSeatGame) {
      hotSeatGame.reset()
      updateHotSeatPosition()
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
      }
    } else if (socket) {
      socket.emit('leave', gameId)
    }
    setClockResetNonce((n) => n + 1)
    setLeaveConfirmOpen(false)
  }

  const getMoves = async (square) => {
    if (isHotSeatMode) {
      // Hot seat mode: use local chess.js for move validation
      if (hotSeatGame && hotSeatGame.turn() === hotSeatCurrentPlayer[0]) {
        let moves = hotSeatGame.moves({square: square, verbose: true})
        setAvailableMoves(moves.map(move => move.to))
      }
    } else {
      // Network mode: existing logic
      if (turn === color[0]) {
        let result = await fetch(`http://${serverIp}:${serverPort}/moves?square=${square}&gameId=${gameId}`)
        let data = await result.json()
        let moves = data.moves.map(move => move.to)
        setAvailableMoves(moves)
      }
    }
  }

  useEffect(() => {
    if (isHotSeatMode && hotSeatGame) {
      // Hot seat mode: initialize game when hotSeatGame is ready
      console.log('Hot seat mode: Initializing game...')
      console.log('Chess game instance:', hotSeatGame)
      try {
        console.log('Initial board:', hotSeatGame.board())
        console.log('Initial turn:', hotSeatGame.turn())
        updateHotSeatPosition()
      } catch (error) {
        console.error('Error initializing hot seat game:', error)
      }
      return
    }

    // Network mode: connect to socket server
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
      for (const p of candidates) {
        try {
          const s = io.connect(`http://${serverIp}:${p}`, { timeout: 1200, reconnection: false })
          const ok = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), 1200)
            s.on('connect', () => { clearTimeout(timer); resolve(true) })
            s.on('connect_error', () => { clearTimeout(timer); resolve(false) })
            s.on('error', () => { clearTimeout(timer); resolve(false) })
          })
          if (ok) {
            connectedSocket = s
            setServerPort(p)
            break
          } else {
            s.close()
          }
        } catch (_) {
          // try next
        }
      }

      if (!connectedSocket) return
      const newSocket = connectedSocket
      setSocket(newSocket)

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
      }

      const handleTerminate = () => {
        setStatus('lobby')
        setGameId('')
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
      newSocket.on('status', setStatus)
      newSocket.on('terminate', handleTerminate)
      newSocket.on('gameId', setGameId)
      newSocket.on('promotionRequired', handlePromotionRequired)
      newSocket.on('promotionComplete', handlePromotionComplete)
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

    if (!isHotSeatMode) {
      connectSocket()
    }
  }, [hotSeatGame])

  useEffect(() => {
    if (history.length > 0) {
      let lastMove = history[history.length - 1]
      soundboard[lastMove.type]()
    }
    setSelectedSquare('')
    setAvailableMoves([])
  }, [history, soundboard])

  // Keep control panel collapsed by default and whenever lobby overlay is shown
  useEffect(() => {
    if (isHotSeatMode) return
    if (status === 'ready' || status === 'lobby' || status === 'fail') {
      setIsPanelOpen(false)
    }
    // For other statuses (e.g., waiting), do not auto-open; respect user toggle
  }, [status, isHotSeatMode])

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
      }
    } else {
      // Network mode: existing logic
      if (turn === color[0]) {
        socket.emit('move', { gameId: gameId, move: move })
      }
    }
  }

  // Hot seat mode: update game position after move
  const updateHotSeatPosition = useCallback(() => {
    if (!hotSeatGame) return
    
    console.log('updateHotSeatPosition called')
    console.log('Current board state:', hotSeatGame.board())
    
    let moveType = 'move'
    const history = hotSeatGame.history({verbose: true})
    
    if (history.length > 0) {
      let lastMove = history[history.length - 1]
      if (lastMove.flags.includes('k') || lastMove.flags.includes('q')) {
        moveType = 'castle'
      }
      if (lastMove.flags.includes('e') || lastMove.flags.includes('c')) {
        moveType = 'capture'
      }
      if (hotSeatGame.inCheck()) {
        moveType = 'check'
      }
      if (hotSeatGame.isGameOver()) {
        moveType = 'gameOver'
      }
    }

    const newBoard = hotSeatGame.board()
    const newTurn = hotSeatGame.turn()
    
    console.log('Setting board to:', newBoard)
    console.log('Setting turn to:', newTurn)
    
    setBoard(newBoard)
    setTurn(newTurn)
    setIsCheck(hotSeatGame.isCheck())
    setIsGameOver([hotSeatGame.isGameOver(), {
      isCheckmate: hotSeatGame.isCheckmate(),
      isDraw: hotSeatGame.isDraw(),
      isStalemate: hotSeatGame.isStalemate()
    }])
    setHistory(hotSeatGame.history({verbose: true}).map(move => ({
      from: move.from,
      to: move.to,
      type: moveType,
      san: move.san
    })))
    
    // Switch current player
    setHotSeatCurrentPlayer(hotSeatGame.turn())
    
    console.log('Board state updated successfully')
  }, [hotSeatGame])

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
      <header className='sticky top-0 z-40 border-b border-white/10 bg-zinc-900/70 backdrop-blur'>
        <div className='mx-auto max-w-5xl px-4 h-14 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <img src="/Vermouth's Gambit (logo only).png" alt="Vermouth's Gambit logo" className='h-6 w-6 rounded' />
            <span className='text-lg font-semibold tracking-tight'>Vermouth's Gambit</span>
            <span className='badge'>{isHotSeatMode ? 'Hot Seat' : 'Online'}</span>
            {status === 'waiting' && <span className='badge-warn'>Waiting</span>}
          </div>
          <div className='flex items-center gap-3 text-xs text-zinc-400'>
            {turn && <span>Turn: <span className='text-emerald-400 font-medium'>{turn === 'w' ? 'White' : 'Black'}</span></span>}
            {!isHotSeatMode && gameId && status === 'ready' && (
              <span>Session: <span className='font-mono text-emerald-400'>{gameId}</span></span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='mx-auto max-w-3xl p-4 grid grid-cols-1 gap-4 items-start justify-items-center'>
        <div className='flex items-center justify-center'>
          {chessBoard({ board: board, handleSquareClick: handleSquareClick, handleDragStart: handleDragStart, handleDrop: handleDrop, availableMoves: availableMoves, history: history, isCheck: isCheck, isGameOver: isGameOver, turn: turn, selectedSquare: selectedSquare, color: isHotSeatMode ? (hotSeatCurrentPlayer === 'w' ? 'white' : 'black') : color})}
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

        {/* Round context menu button (FAB on mobile) */}
        <div className='-mt-2 flex items-center justify-center w-full'>
          <button
            aria-label={isPanelOpen ? 'Close panel' : 'Open panel'}
            aria-expanded={isPanelOpen}
            className={`btn-secondary rounded-full w-14 h-14 p-0 flex items-center justify-center shadow-lg shadow-black/30 fixed fab z-[1300] md:static md:z-auto md:shadow-none transition-colors ${isPanelOpen ? 'ring-2 ring-emerald-500/40' : ''}`}
            onClick={() => setIsPanelOpen((v) => !v)}
          >
            {/* simple dots icon */}
            <svg width='22' height='22' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg' className={`transition-transform ${isPanelOpen ? 'rotate-90' : ''}`}>
              <circle cx='4' cy='10' r='2' fill='currentColor'/>
              <circle cx='10' cy='10' r='2' fill='currentColor'/>
              <circle cx='16' cy='10' r='2' fill='currentColor'/>
            </svg>
          </button>
        </div>

        {/* Floating Control Panel (animated) */}
        <div
          aria-hidden={!isPanelOpen}
          className={`z-[1200] transition-all duration-300 ease-out ${isPanelOpen ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-2'} fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] right-[calc(1.25rem+env(safe-area-inset-right,0px))] w-[min(92vw,520px)] md:static md:w-full md:max-w-[500px]`}
        >
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
            isQrOpen={isQrOpen}
            setIsQrOpen={setIsQrOpen}
            qrDataUrl={qrDataUrl}
            setQrDataUrl={setQrDataUrl}
            qrLoading={qrLoading}
            setQrLoading={setQrLoading}
            onRequestReset={() => setResetConfirmOpen(true)}
            onRequestLeave={() => setLeaveConfirmOpen(true)}
          />
        </div>
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
    </div>
  )
}

function chessBoard({board, handleSquareClick, handleDragStart, handleDrop, availableMoves, history, isCheck, isGameOver, turn, selectedSquare, color}) {
  let numToLetter = ["a", "b", "c", "d", "e", "f", "g", "h"]

  let boardArr = []

  for(let i = 0; i < board.length; i++) {
    let boardInd = (color === 'white' ? i : 7 - i)
    let row = board[boardInd]

    for(let j = 0; j < board.length; j++) {
      let rowInd = (color === 'white' ? j : 7 - j)
      let square = row[rowInd]

      let bgColor = (rowInd + boardInd) % 2 === 1 ? 'bg-[#739552]' : 'bg-[#EBECD0]'
      let textColor = (rowInd + boardInd) % 2 === 0 ? 'text-[#739552]' : 'text-[#EBECD0]'
      let coord = `${numToLetter[rowInd]}${8 - boardInd}`
      boardArr.push(
        <div key={coord} onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); }} className={`relative square flex flex-col ${bgColor} ${textColor}`} data-square={coord} onClick={handleSquareClick}>
          {rowInd === (color === 'white' ? 0 : 7) && <div data-square={coord} className='absolute text-xs font-semibold left-[3%]'>{8 - boardInd}</div>}
          {boardInd === (color === 'white' ? 7 : 0) && <div data-square={coord} className='absolute text-xs font-semibold self-end right-[5%] top-[69%]'>{numToLetter[rowInd]}</div>}
          {square != null ?
            <img
              src={icons[`${square.color}${square.type}`]}
              data-square={coord}
              className='m-auto z-20 h-[90%] w-[90%]'
              onDragStart={handleDragStart}
              draggable="true"
            /> : ""
          }
          {squareUnderlay({ square: square, coord: coord, history: history, availableMoves: availableMoves, isCheck: isCheck, turn: turn, selectedSquare: selectedSquare })}
        </div>
      )
    }
  }

  return (
    <div id="board" className='relative grid-rows-8 grid-cols-8 grid grabbable text-black'>
      {boardArr}
      {isGameOver[0] && <div className='absolute bg-zinc-800 bg-opacity-80 h-full w-full flex items-center justify-center z-40'>
        <div className='font-light text-white text-center text-4xl'>
          Game Over: <br/>
          {isGameOver[1].isCheckmate ? 'Checkmate' : isGameOver[1].isDraw ? 'Draw' : isGameOver[1].isStalemate ? 'Stalemate' : ''}
        </div>
      </div>}
    </div>
  )
}

//highights squares and displays moves on the board
function squareUnderlay({ square, coord, history, availableMoves, isCheck, turn, selectedSquare }) {
  let availableMove = null
  let bg = ''
  if (availableMoves.includes(coord)) {
    if (square != null) {
      availableMove = <div style={{
        border: '4px solid black',
        borderRadius: '50%',
        height: '100%',
        width: '100%',
        opacity: '0.2'
      }}
        data-square={coord}
      />
    } else {
      availableMove = <div data-square={coord} className='rounded-full bg-black bg-opacity-20 h-[40%] w-[40%]' />
    }
  }

  if (history.length > 0) {
    let lastMove = history[history.length - 1]
    if (coord === lastMove.from || coord === lastMove.to) {
      bg = 'bg-yellow-300 bg-opacity-65'
    }
  }

  if (selectedSquare === coord && square != null) {
    bg = 'bg-yellow-300 bg-opacity-65'
  }

  if (square != null && square.type === 'k' && isCheck && square.color === turn) {
    bg = 'bg-red-600 bg-opacity-70'
  }

  return (
    <div data-square={coord} className={`absolute ${bg} z-10 w-full h-full flex items-center justify-center`}>
      {availableMove}
    </div>
  )
}

// Chess clock hook (count-up, switch on turn change)
function useChessClock({
  isPlaying,           // boolean: game running (status ready, not game over)
  activeTurn,          // 'w' | 'b' | '' — whose turn from game state
  resetKey,            // string/number changes when a new game starts
}) {
  const [whiteMsBase, setWhiteMsBase] = useState(0)
  const [blackMsBase, setBlackMsBase] = useState(0)
  const runningRef = useRef(null) // 'w' | 'b' | null
  const lastStartRef = useRef(null) // timestamp in ms
  const [now, setNow] = useState(() => Date.now())

  // Reset when a new session starts
  useEffect(() => {
    setWhiteMsBase(0)
    setBlackMsBase(0)
    runningRef.current = null
    lastStartRef.current = null
  }, [resetKey])

  // Start/stop/switch on activeTurn or play state changes
  useEffect(() => {
    const current = runningRef.current
    const t = (activeTurn === 'w' || activeTurn === 'b') ? activeTurn : null

    if (!isPlaying || t == null) {
      // Stop if not playing
      if (current && lastStartRef.current != null) {
        const elapsed = Date.now() - lastStartRef.current
        if (current === 'w') setWhiteMsBase((v) => v + elapsed)
        if (current === 'b') setBlackMsBase((v) => v + elapsed)
      }
      runningRef.current = null
      lastStartRef.current = null
      return
    }

    // If switching sides, commit elapsed and flip
    if (current !== t) {
      const nowTs = Date.now()
      if (current && lastStartRef.current != null) {
        const elapsed = nowTs - lastStartRef.current
        if (current === 'w') setWhiteMsBase((v) => v + elapsed)
        if (current === 'b') setBlackMsBase((v) => v + elapsed)
      }
      runningRef.current = t
      lastStartRef.current = nowTs
    }
  }, [isPlaying, activeTurn])

  // Tick at ~4Hz for smooth-enough updates without cost, derive display from base + delta
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const whiteMs = useMemo(() => {
    if (runningRef.current === 'w' && lastStartRef.current != null) {
      return whiteMsBase + (now - lastStartRef.current)
    }
    return whiteMsBase
  }, [whiteMsBase, now])
  const blackMs = useMemo(() => {
    if (runningRef.current === 'b' && lastStartRef.current != null) {
      return blackMsBase + (now - lastStartRef.current)
    }
    return blackMsBase
  }, [blackMsBase, now])

  // Manual click switch for dev/testing
  const clickSwitchTo = useCallback((side) => {
    if (side !== 'w' && side !== 'b') return
    if (!isPlaying) return
    const current = runningRef.current
    const nowTs = Date.now()
    if (current && lastStartRef.current != null) {
      const elapsed = nowTs - lastStartRef.current
      if (current === 'w') setWhiteMsBase((v) => v + elapsed)
      if (current === 'b') setBlackMsBase((v) => v + elapsed)
    }
    runningRef.current = side
    lastStartRef.current = nowTs
  }, [isPlaying])

  return { whiteMs, blackMs, clickSwitchTo }
}

function TimerDisplay({ label, minutes, seconds, active, onClick, easterEgg }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`group w-full rounded-lg border border-white/10 backdrop-blur px-3 py-2 text-sm text-white/90 transition-all ${active ? 'bg-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-2 ring-emerald-400/40' : 'bg-white/5 shadow-inner'}`}
      aria-pressed={active}
    >
      <div className='flex items-center justify-between'>
        <span className={`text-[11px] uppercase tracking-wide ${active ? 'text-emerald-300' : 'text-zinc-300'}`}>{label}</span>
        <div style={{ fontVariantNumeric: 'tabular-nums' }} className='font-semibold'>
          {easterEgg ? (
            <span className='text-emerald-300'>長考之王</span>
          ) : (
            // Fixed-width grid: 2ch for minutes, 1ch for colon, 2ch for seconds (no zero-pad)
            <span className='inline-grid' style={{ gridTemplateColumns: '2ch 1ch 2ch' }}>
              <span className='justify-self-end'>{minutes}</span>
              <span className='px-0.5'>:</span>
              <span className='justify-self-start'>{String(seconds).padStart(2, '0')}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function ControlPanel({ history, tableEnd, socket, status, gameId, clockResetNonce, isHotSeatMode, hotSeatCurrentPlayer, hotSeatGame, updateHotSeatPosition, onRequestReset, onRequestLeave, turn, color, isGameOver, playerName, opponentName }) {
  // Auto-scroll the move list to the latest move
  useEffect(() => {
    const el = tableEnd && tableEnd.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [history, tableEnd])
  const handleUndo = () => {
    if (isHotSeatMode && hotSeatGame) {
      hotSeatGame.undo()
      updateHotSeatPosition()
    } else if (socket) {
      socket.emit('undo', gameId)
    }
  }

  const handleReset = () => {
    if (onRequestReset) onRequestReset()
  }

  const handleLeave = () => {
    if (onRequestLeave) onRequestLeave()
  }

  const currentPlayerText = isHotSeatMode ? 
    (hotSeatCurrentPlayer === 'w' ? 'White to move' : 'Black to move') : 
    null

  // Clock logic
  const playing = status === 'ready' && !(isGameOver && isGameOver[0])
  const activeTurn = isHotSeatMode ? (hotSeatCurrentPlayer || '') : (turn || '')
  const resetKey = isHotSeatMode ? `hs-${clockResetNonce}` : `net-${gameId || 'none'}-${clockResetNonce}`

  const { whiteMs, blackMs, clickSwitchTo } = useChessClock({
    isPlaying: playing,
    activeTurn,
    resetKey,
  })

  const msToParts = useCallback((ms) => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    const s = total % 60
    return { m, s }
  }, [])

  // Determine which color is bottom (player) and top (opponent)
  const bottomColor = isHotSeatMode
    ? (hotSeatCurrentPlayer === 'w' ? 'white' : 'black')
    : (color || 'white')
  const topColor = bottomColor === 'white' ? 'black' : 'white'

  const whiteParts = msToParts(whiteMs)
  const blackParts = msToParts(blackMs)
  const limitExceeded = (p) => (p.m > 99 || (p.m === 99 && p.s > 59))
  const whiteEgg = limitExceeded(whiteParts)
  const blackEgg = limitExceeded(blackParts)

  // Active highlighting by current turn if playing
  const activeColor = playing
    ? ((activeTurn === 'w') ? 'white' : (activeTurn === 'b' ? 'black' : null))
    : null

  // Click handlers to allow manual switching (dev/testing)
  const handleClickTop = () => {
    clickSwitchTo(topColor === 'white' ? 'w' : 'b')
  }
  const handleClickBottom = () => {
    clickSwitchTo(bottomColor === 'white' ? 'w' : 'b')
  }

  const renderTimer = (which) => {
    const isWhite = which === 'white'
    const parts = isWhite ? whiteParts : blackParts
    const egg = isWhite ? whiteEgg : blackEgg
    const topLabel = (opponentName && opponentName.trim()) ? opponentName.trim() : 'Opp'
    const bottomLabel = (playerName && playerName.trim()) ? playerName.trim() : 'You'
    return (
      <TimerDisplay
        label={which === topColor ? topLabel : bottomLabel}
        minutes={parts.m}
        seconds={parts.s}
        active={activeColor === which}
        onClick={which === topColor ? handleClickTop : handleClickBottom}
        easterEgg={egg}
      />
    )
  }

  return (
    <div className='glass-panel p-4 flex flex-col gap-4 md:h-[500px]'>
      <div className='flex items-center justify-between'>
        {currentPlayerText && <p className='text-sm text-zinc-300'>{currentPlayerText}</p>}
      </div>

      <div className='flex gap-4 grow items-stretch'>
        {/* Left: vertical icon-only actions */}
        <div className='flex flex-col items-center gap-2 pr-1 flex-shrink-0'>
          {/* Emoji (placeholder) */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Emoji'
              className='neo-btn'
              onClick={() => console.log('Emoji button clicked')}
            >
              <span role='img' aria-hidden='true' className='text-lg'>😊</span>
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Emoji</span>
          </div>

          {/* Undo */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Undo'
              className='neo-btn'
              onClick={handleUndo}
            >
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <path d='M9 14L4 9l5-5' />
                <path d='M20 20a8 8 0 0 0-8-8H4' />
              </svg>
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Undo</span>
          </div>

          {/* AI (placeholder) */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='AI'
              className='neo-btn'
              onClick={() => console.log('AI button clicked')}
            >
              <span role='img' aria-hidden='true' className='text-base'>🤖</span>
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >AI</span>
          </div>

          {/* Reset */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Reset Game'
              className='neo-btn'
              onClick={handleReset}
            >
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <path d='M21 12a9 9 0 1 1-9-9' />
                <path d='M3 3v6h6' />
              </svg>
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Reset</span>
          </div>

          {/* Leave/New Game */}
          <div className='relative group'>
            <button
              type='button'
              aria-label={isHotSeatMode ? 'New Game' : 'Leave Game'}
              className='neo-btn'
              onClick={handleLeave}
            >
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
                <path d='M16 17l5-5-5-5' />
                <path d='M21 12H9' />
              </svg>
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >{isHotSeatMode ? 'New Game' : 'Leave'}</span>
          </div>

          {/* Reserve space for ~3 future buttons */}
          <div className='h-16 md:h-24' aria-hidden='true'></div>
        </div>

        {/* Middle: Move List */}
        <div className='flex flex-col gap-3 grow min-w-0'>
          <div
            ref={tableEnd}
            role='region'
            aria-label='Move List'
            className='relative h-44 overflow-auto rounded-lg border border-white/10 bg-white/5 p-2 select-text'
          >
            {history.length === 0 ? (
              <div className='text-xs text-zinc-400'>No moves yet</div>
            ) : (
              <table className='w-full table-fixed'>
                <tbody>
                {history.map((move, i) => {
                  if (i % 2 === 0) {
                    return (
                      <tr key={i} className='text-center font-semibold text-sm text-white/90'>
                        <td className='w-10 font-normal text-gray-400'>{i / 2 + 1}.</td>
                        <td className='px-2'>{move.san}</td>
                        <td className='px-2'>{history[i + 1]?.san}</td>
                      </tr>
                    )
                  } else {
                    return null
                  }
                })}
                </tbody>
              </table>
            )}
            {/* Expandable button (placeholder) */}
            <button
              type='button'
              aria-label='Expand move list'
              onClick={() => console.log('Expand move list clicked')}
              className='absolute bottom-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-md bg-zinc-900/80 border border-white/10 text-white/90 shadow-md backdrop-blur hover:bg-zinc-800/80 active:scale-[0.98]'
            >
              <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <path d='M12 8l-4 4 4 4' />
              </svg>
            </button>
          </div>
          {status === 'ready' && !isHotSeatMode && (
            <div className='text-xs text-zinc-400'>
              <p>Connected to Session: <span className='text-emerald-400 font-mono'>{gameId}</span></p>
            </div>
          )}
          {isHotSeatMode && (
            <div className='text-xs text-zinc-400'>
              <p>Hot Seat Mode — Two players on same device</p>
            </div>
          )}
        </div>

        {/* Right: clocks (top = opponent, bottom = you) */}
        <div className='flex flex-col gap-3 w-44 md:w-56 shrink-0'>
          {renderTimer(topColor)}
          {renderTimer(bottomColor)}
        </div>

        

        
        {isHotSeatMode && (
          <div className='hidden text-xs text-zinc-400'>
            <p>Hot Seat Mode — Two players on same device</p>
          </div>
        )}
      </div>

      {/* bottom section removed per request */}
    </div>
  )
}

function GameJoinPanel({ socket, status, color, gameId, serverIp, serverInfo, clientPort, isQrOpen, setIsQrOpen, qrDataUrl, setQrDataUrl, qrLoading, setQrLoading, setPlayerName }) {
  const ip = (serverInfo && serverInfo.lanIp) ? serverInfo.lanIp : serverIp
  const protocol = (typeof window !== 'undefined' && window.location && window.location.protocol) || 'http:'
  const networkName = serverInfo && serverInfo.networkName ? serverInfo.networkName : null
  const url = ip ? `${protocol}//${ip}:${clientPort}` : null
  const qrAnchorRef = useRef(null)
  const [qrPos, setQrPos] = useState({ top: 0, left: 0 })
  const isHome = ((import.meta.env.VITE_HOME || '').trim() === 'G&V')
  const [claimed, setClaimed] = useState({ Gallant: false, Vermouth: false })

  // Listen for name claim updates from server to disable taken quick-join buttons
  useEffect(() => {
    if (!socket) return
    const onClaims = (payload) => {
      try {
        if (payload && payload.claimed) {
          setClaimed((prev) => ({ ...prev, ...payload.claimed }))
        }
      } catch (_) {}
    }
    socket.on('nameClaims', onClaims)
    return () => {
      socket.off('nameClaims', onClaims)
    }
  }, [socket])

  const quickJoin = (name) => {
    if (!socket) return
    try {
      if (setPlayerName) setPlayerName(name)
      // Optimistically mark as claimed locally
      setClaimed((prev) => ({ ...prev, [name]: true }))
      // Wait for server to assign a game and then claim the name server-side
      const onceGameId = (gid) => {
        try { socket.emit('claimName', name) } catch (_) {}
        socket.off('gameId', onceGameId)
      }
      socket.on('gameId', onceGameId)
      socket.emit('join')
    } catch (_) {}
  }

  // Close QR on outside click or Escape
  useEffect(() => {
    if (!isQrOpen) return
    const onPointer = (e) => {
      const anchor = qrAnchorRef.current
      const pop = document.querySelector('[data-qr-popover="1"]')
      if (anchor && anchor.contains(e.target)) return
      if (pop && pop.contains(e.target)) return
      setIsQrOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setIsQrOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [isQrOpen, setIsQrOpen])

  const handleShareClick = async (e) => {
    e.preventDefault()
    if (!url) return
    const showToast = (msg) => {
      try {
        const btn = e.currentTarget
        const existing = btn.parentElement?.querySelector('[data-temp-toast]')
        if (existing) existing.remove()
        const toast = document.createElement('span')
        toast.setAttribute('data-temp-toast', '1')
        toast.className = 'ml-2 text-xs text-emerald-300 transition-opacity duration-300'
        toast.style.opacity = '1'
        toast.textContent = msg
        btn.insertAdjacentElement('afterend', toast)
        setTimeout(() => {
          toast.style.opacity = '0'
          setTimeout(() => toast.remove(), 300)
        }, 1300)
      } catch (_) {}
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Vermouth's Gambit",
          text: 'Join my game',
          url: url
        })
        showToast('Shared!')
        return
      }
    } catch (_) {}
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        showToast('Copied!')
        return
      }
    } catch (_) {}
    try {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showToast('Copied!')
    } catch (_) {}
  }

  const handleQrToggle = async (e) => {
    e.preventDefault()
    if (!url) return
    if (!isQrOpen) {
      try {
        // Compute portal position relative to viewport (fixed)
        if (qrAnchorRef.current) {
          const r = qrAnchorRef.current.getBoundingClientRect()
          const popupW = 200 // approx container width
          const popupH = 200 // approx container height
          // Place so the QR's bottom-left corner overlaps near the icon,
          // then shift left by one icon width to better cover the icon
          let left = r.left + (r.width / 2) - r.width + 8
          let top = r.top + (r.height / 2) - popupH + 8
          // Clamp to viewport
          if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8
          if (left < 8) left = 8
          if (top + popupH > window.innerHeight - 8) top = window.innerHeight - popupH - 8
          if (top < 8) top = 8
          setQrPos({ top, left })
        }
        setIsQrOpen(true)
        setQrLoading(true)
        if (!qrDataUrl) {
          let dataUrl = null
          try {
            // Generate QR with transparent background and white modules
            dataUrl = await QRCode.toDataURL(url, {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 240,
              color: { dark: '#FFFFFF', light: '#0000' }
            })
          } catch (_) {
            // Fallback: white modules on black background (non-transparent)
            dataUrl = await QRCode.toDataURL(url, {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 240,
              color: { dark: '#FFFFFF', light: '#000000' }
            })
          }
          setQrDataUrl(dataUrl)
        }
      } catch (_) {
        // leave silently
      } finally {
        setQrLoading(false)
      }
    } else {
      setIsQrOpen(false)
    }
  }

  return (
    <div className='card p-4 flex flex-col gap-4 md:h-[500px]'>
      <div className='text-center'>
        <p className='text-white text-xl font-semibold'>Game Lobby</p>
      </div>
      <div className='text-xs text-zinc-300 -mt-2 flex flex-col items-center text-center gap-1'>
        {networkName && (
        <p>Network: <span className='font-mono text-emerald-400'>{networkName}</span></p>
        )}
        <p className='flex items-center justify-center gap-2'>
          <span>Connect:</span>
          {url ? (
            <button
              type='button'
              onClick={handleShareClick}
              className='font-mono text-emerald-400 underline underline-offset-2 hover:opacity-90 active:opacity-80 bg-transparent p-0 border-0 focus:outline-none focus:ring-0'
              aria-label='Share connect URL'
              title='Tap to share or copy'
            >
              {url}
            </button>
          ) : (
            <span className='font-mono text-emerald-400'>unknown</span>
          )}
          {url && (
            <span className='relative inline-flex items-center' ref={qrAnchorRef}>
              <button
                type='button'
                onClick={handleQrToggle}
                aria-label={isQrOpen ? 'Hide QR code' : 'Show QR code'}
                className='inline-flex items-center justify-center ml-1 h-[1.1em] w-[1.1em] p-0 bg-transparent border-0 text-white/90 hover:opacity-90 active:opacity-80'
                title={isQrOpen ? 'Hide QR code' : 'Show QR code'}
              >
                {/* Tiny QR icon */}
                <svg viewBox='0 0 24 24' width='1em' height='1em' fill='currentColor' aria-hidden='true'>
                  <rect x='3' y='3' width='7' height='7' rx='1'></rect>
                  <rect x='14' y='3' width='7' height='7' rx='1'></rect>
                  <rect x='3' y='14' width='7' height='7' rx='1'></rect>
                  <path d='M14 14h3v3h-3zM17 17h4v4h-4zM21 14h-2v-2h2zM14 21h-2v-2h2z'></path>
                </svg>
              </button>
              {isQrOpen && createPortal(
                <div
                  className='fixed z-[2000]'
                  style={{ top: qrPos.top, left: qrPos.left }}
                >
                  <div
                    className='rounded-lg border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur'
                    data-qr-popover='1'
                    role='dialog'
                    aria-label='Connect QR code'
                    onClick={() => setIsQrOpen(false)}
                  >
                    {qrLoading ? (
                      <span className='text-xs text-zinc-200'>Generating…</span>
                    ) : (
                      <img src={qrDataUrl || ''} alt='Connect QR code' className='w-48 h-48' />
                    )}
                  </div>
                </div>,
                document.body
              )}
            </span>
          )}
        </p>
      </div>
      <div className='flex flex-col gap-2 text-sm'>
        {isHome ? (
          <div className='flex gap-2'>
            <button
              className='btn-primary grow disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={!!claimed.Gallant}
              onClick={() => quickJoin('Gallant')}
            >
              I'm G
            </button>
            <button
              className='btn-primary grow disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={!!claimed.Vermouth}
              onClick={() => quickJoin('Vermouth')}
            >
              I'm V
            </button>
          </div>
        ) : (
          <>
            <input id="playerNameInput" className='input' type='text' inputMode='text' placeholder="Player name (optional)" />
            <div className='flex gap-2'>
              <button
                className='btn-primary grow'
                onClick={() => {
                  if (!socket) return
                  try {
                    const nameEl = document.getElementById('playerNameInput')
                    const val = nameEl && typeof nameEl.value === 'string' ? nameEl.value.trim() : ''
                    if (val && setPlayerName) setPlayerName(val)
                  } catch (_) {}
                  socket.emit('join')
                }}>
                Join
              </button>
              <button
                className='btn-danger hidden'
                onClick={() => {
                  socket.emit('leave', gameId)
                }}>
                Leave
              </button>
            </div>
          </>
        )}
      </div>
      <div className='hidden text-xs text-zinc-400'>
        <p>Color: {color}</p>
        <p>Status: {status}</p>
        <p>Game: {gameId}</p>
      </div>
    </div>
  )
}

//render the correct panel based on the game status
function Panel({ history, tableEnd, socket, status, color, turn, isGameOver, gameId, clockResetNonce, playerName, opponentName, isHotSeatMode, hotSeatCurrentPlayer, hotSeatGame, updateHotSeatPosition, serverIp, serverPort, serverInfo, clientPort, isQrOpen, setIsQrOpen, qrDataUrl, setQrDataUrl, qrLoading, setQrLoading, onRequestReset, onRequestLeave }) {
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
    />
  )
}

export default App
