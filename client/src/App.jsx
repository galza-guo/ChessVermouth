import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSound from 'use-sound'

import { Chess } from 'chess.js'

import { bb, bk, bn, bp, bq, br, wb, wk, wn, wp, wq, wr, move, check, capture, castle, gameOver } from './assets'
import PromotionDialog from './components/PromotionDialog'

const icons = { bb, bk, bn, bp, bq, br, wb, wk, wn, wp, wq, wr }
const sounds = { move, check, capture, castle, gameOver }

// Detect hot seat mode from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const isHotSeatMode = urlParams.get('mode') === 'hotseat';

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
        const serverPort = import.meta.env.VITE_SERVER_PORT || '3001'
      let result = await fetch(`http://localhost:${serverPort}/moves?square=${square}&gameId=${gameId}`)
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
      // Use dynamic server port from environment variable or default
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3001'
      const newSocket = io.connect(`http://localhost:${serverPort}`)
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

  const movePiece = (move) => {
    if (isHotSeatMode) {
      // Hot seat mode: handle moves locally
      if (hotSeatGame && hotSeatGame.turn() === hotSeatCurrentPlayer[0]) {
        try {
          let result = hotSeatGame.move(move)
          if (result) {
            // Check for pawn promotion
            if (result.flags && result.flags.includes('p')) {
              setPromotionRequired(true)
              setPromotionData({
                square: result.to,
                color: result.color === 'w' ? 'white' : 'black',
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
    let square = e.target.getAttribute('square')

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
    dragged = e.target.getAttribute('square')

    let square = dragged
    if (selectedSquare !== square) {
      setSelectedSquare(square)
      getMoves(square)
    }
  }
  const handleDrop = (e) => {
    let square = e.target.getAttribute('square')

    if (availableMoves.includes(square)) {
      movePiece(`${selectedSquare}${square}`)
    }
  }

  const handlePromotionCancel = () => {
    setPromotionRequired(false)
    setPromotionData(null)
  }

  return (
    <div className='absolute flex flex-wrap gap-3 items-center justify-center h-full w-full select-none'>
      <div className='absolute text-white top-0 left-0 bg-black bg-opacity-50 p-2 rounded z-50'>
        <div>status: {status}</div>
        <div>color: {color}</div>
        <div>gameId: {gameId}</div>
        <div>turn: {turn}</div>
        <div>mode: {isHotSeatMode ? 'hotseat' : 'network'}</div>
        <div>hotSeatGame: {hotSeatGame ? 'yes' : 'no'}</div>
        <div>board: {board ? 'loaded' : 'empty'}</div>
      </div>
      {chessBoard({ board: board, handleSquareClick: handleSquareClick, handleDragStart: handleDragStart, handleDrop: handleDrop, availableMoves: availableMoves, history: history, isCheck: isCheck, isGameOver: isGameOver, turn: turn, selectedSquare: selectedSquare, color: isHotSeatMode ? (hotSeatCurrentPlayer === 'w' ? 'white' : 'black') : color})}
      {panel({ 
        history: history, 
        tableEnd: tableEnd, 
        socket: socket, 
        status: status, 
        color: color, 
        gameId: gameId,
        isHotSeatMode: isHotSeatMode,
        hotSeatCurrentPlayer: hotSeatCurrentPlayer,
        hotSeatGame: hotSeatGame,
        updateHotSeatPosition: updateHotSeatPosition
      })}
      
      {/* Promotion Dialog */}
      {promotionRequired && promotionData && (
        <PromotionDialog 
          square={promotionData.square}
          color={promotionData.color}
          onPromote={handlePromote}
          onCancel={handlePromotionCancel}
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
        <div onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); }} className={`relative square flex flex-col ${bgColor} ${textColor}`} data-square={coord} onClick={handleSquareClick}>
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
    <div id="board" className='relative grid-rows-8 grid-cols-8 grid grabbable text-black h-[500px] w-[500px]'>
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

function controlPanel({ history, tableEnd, socket, status, gameId, isHotSeatMode, hotSeatCurrentPlayer, hotSeatGame, updateHotSeatPosition }) {
  const handleUndo = () => {
    if (isHotSeatMode && hotSeatGame) {
      hotSeatGame.undo()
      updateHotSeatPosition()
    } else if (socket) {
      socket.emit('undo', gameId)
    }
  }

  const handleReset = () => {
    if (isHotSeatMode && hotSeatGame) {
      hotSeatGame.reset()
      updateHotSeatPosition()
    } else if (socket) {
      socket.emit('reset', gameId)
    }
  }

  const handleLeave = () => {
    if (isHotSeatMode) {
      // Reset hot seat game
      if (hotSeatGame) {
        hotSeatGame.reset()
        updateHotSeatPosition()
      }
    } else if (socket) {
      socket.emit('leave', gameId)
    }
  }

  const currentPlayerText = isHotSeatMode ? 
    (hotSeatCurrentPlayer === 'w' ? 'White to move' : 'Black to move') : 
    'Opponent'

  const youText = isHotSeatMode ? 
    (hotSeatCurrentPlayer === 'w' ? 'White' : 'Black') : 
    'You'

  return (
    <div className='h-[500px] gap-3 w-96 bg-zinc-700 bg-opacity-90 rounded-xl p-3 flex flex-col'>
      <div>
        <p>{currentPlayerText}</p>
      </div>
      <div className='flex flex-col gap-3 grow justify-center'>
        <div ref={tableEnd} className='h-40 overflow-auto bg-zinc-900 bg-opacity-35 rounded-xl p-2 select-text'>
          <table className='w-3/5 table-auto'>
            {history.map((move, i) => {
              if (i % 2 === 0) {
                return (
                  <tr key={i} className='text-center  font-semibold text-sm'>
                    <td className='font-normal text-gray-400'>{i / 2 + 1}.</td>
                    <td>{move.san}</td>
                    <td>{history[i + 1]?.san}</td>
                  </tr>
                )
              } else {
                return
              }
            })}
          </table>
        </div>
        <div className='grid grid-cols-2 gap-2'>
          <button className='' onClick={handleUndo}>
            Undo
          </button>
          <button
            className='px-2'
            onClick={handleReset}
          >Reset Game</button>
        </div>
        <button
          className='px-2'
          onClick={handleLeave}>
          {isHotSeatMode ? 'New Game' : 'Leave'}
        </button>
        {status === 'waiting' && <div>
          <p>Waiting for opponent to connect...</p>
        </div>}
        {status === 'ready' && !isHotSeatMode && <div className='text-xs text-gray-500'>
          <p>Connected to Room: <em className='text-emerald-700'>{gameId}</em></p>
        </div>}
        {isHotSeatMode && <div className='text-xs text-gray-500'>
          <p>Hot Seat Mode - Two players on same device</p>
        </div>}
      </div>
      <div>
        <p>{youText}</p>
      </div>
    </div>
  )
}

function gameJoinPanel({ socket, status, color, gameId }) {

  return (
    <div className='h-[500px] gap-3 w-96 bg-zinc-700 bg-opacity-90 rounded-xl p-3 flex flex-col'>
      <div>
        <p className='text-center text-white text-2xl font-bold'>Game Lobby</p>
      </div>
      <div className='flex gap-2 text-sm'>
        <input required id="roomInput" className='grow py-1 px-2 rounded-lg' type='text' placeholder='Join or create a room by entering a code' />
        <button
          className='px-2'
          onClick={() => {
            if(!document.getElementById('roomInput').reportValidity()) {
              return
            }
            socket.emit('join', document.getElementById('roomInput').value)
          }}>
          Join
        </button>
        <button
          className='px-2 hidden'
          onClick={() => {
            socket.emit('leave', gameId)
          }}>
          Leave
        </button>
      </div>
      <div className='hidden'>
        <p>Color: {color}</p>
        <p>Status: {status}</p>
        <p>Game: {gameId}</p>
      </div>
    </div>
  )
}

//render the correct panel based on the game status
function panel({ history, tableEnd, socket, status, color, gameId, isHotSeatMode, hotSeatCurrentPlayer, hotSeatGame, updateHotSeatPosition }) {
  //note tableEnd is a ref, i didnt want to rename it cuz id have to refactor :)
  if ((status === 'lobby' || status === 'fail') && !isHotSeatMode) {
    return (gameJoinPanel({ socket: socket, status: status, color: color, gameId: gameId }))
  } else {
    return (controlPanel({ 
      history: history, 
      tableEnd: tableEnd, 
      socket: socket, 
      status: status, 
      gameId: gameId,
      isHotSeatMode: isHotSeatMode,
      hotSeatCurrentPlayer: hotSeatCurrentPlayer,
      hotSeatGame: hotSeatGame,
      updateHotSeatPosition: updateHotSeatPosition
    }))
  }
}

export default App
