import React from 'react'

// TEXTURE: Subtle SVG noise pattern for matte/grain effect
// Applied at low opacity to add tactile quality without performance hit
const textureStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`,
}

// Refined Tactility Board Colors
const COLORS = {
  darkSquare: '#5D4E3C',     // Warm Walnut
  lightSquare: '#F0E6D3',    // Warm Cream
  gold: '#C9A227',           // Antique Gold (accent)
  check: '#A63D40',          // Burgundy Rose (error)
  surface: '#1A1A24',        // Slate Depth (frame)
  text: '#EAEAF0',           // Primary text
}

// Highlights squares and displays moves on the board
function SquareUnderlay({ square, coord, history, availableMoves, isCheck, turn, selectedSquare }) {
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

export default function ChessBoard({
  board,
  handleSquareClick,
  handleDragStart,
  handleDrop,
  availableMoves,
  history,
  isCheck,
  isGameOver,
  turn,
  selectedSquare,
  color,
  emojiBursts,
  animatedPiece,
  icons,
}) {
  const numToLetter = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const boardArr = []

  for (let i = 0; i < board.length; i++) {
    const boardInd = color === 'white' ? i : 7 - i
    const row = board[boardInd]

    for (let j = 0; j < board.length; j++) {
      const rowInd = color === 'white' ? j : 7 - j
      const square = row[rowInd]
      const coord = `${numToLetter[rowInd]}${8 - boardInd}`
      
      // If piece is animating, hide it on the board
      const isAnimating = animatedPiece && animatedPiece.from === coord
      const squareToRender = isAnimating ? null : square

      // Refined Tactility: Warm Walnut & Cream
      const isDarkSquare = (rowInd + boardInd) % 2 === 1
      const squareStyle = {
        backgroundColor: isDarkSquare ? COLORS.darkSquare : COLORS.lightSquare,
      }
      const coordStyle = {
        color: isDarkSquare ? 'rgba(240, 230, 211, 0.6)' : 'rgba(93, 78, 60, 0.6)',
      }

      boardArr.push(
        <div
          key={coord}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className='relative square flex flex-col overflow-hidden'
          style={squareStyle}
          data-square={coord}
          onClick={handleSquareClick}
        >
          {/* Texture Overlay - Matte grain effect (dark squares only for performance) */}
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

          {/* Piece Image - 2.5D lift with drop-shadow */}
          {squareToRender != null && (
            <img
              src={icons[`${squareToRender.color}${squareToRender.type}`]}
              data-square={coord}
              className='relative m-auto z-20 h-[85%] w-[85%] transition-transform hover:scale-105 active:scale-95'
              style={{ filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.3))' }}
              onDragStart={handleDragStart}
              draggable="true"
              alt={`${squareToRender.color}${squareToRender.type}`}
            />
          )}

          <SquareUnderlay
            square={square}
            coord={coord}
            history={history}
            availableMoves={availableMoves}
            isCheck={isCheck}
            turn={turn}
            selectedSquare={selectedSquare}
          />
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
      {/* THE BOARD GRID */}
      <div
        id="board"
        className='relative grid grid-rows-8 grid-cols-8 w-full h-full rounded-md overflow-hidden grabbable text-black'
        style={{ background: COLORS.surface }}
      >
        {boardArr}

        {/* Emoji overlays (transient) */}
        {Array.isArray(emojiBursts) &&
          emojiBursts.map((e) => (
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
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
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
                animation: 'fadeInScale 0.3s ease-out',
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
