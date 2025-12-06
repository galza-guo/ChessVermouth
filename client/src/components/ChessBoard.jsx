import React from 'react'

// Highlights squares and displays moves on the board
function SquareUnderlay({ square, coord, history, availableMoves, isCheck, turn, selectedSquare }) {
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

export default function ChessBoard({ board, handleSquareClick, handleDragStart, handleDrop, availableMoves, history, isCheck, isGameOver, turn, selectedSquare, color, emojiBursts, animatedPiece, icons }) {
  let numToLetter = ["a", "b", "c", "d", "e", "f", "g", "h"]

  let boardArr = []

  for(let i = 0; i < board.length; i++) {
    let boardInd = (color === 'white' ? i : 7 - i)
    let row = board[boardInd]

    for(let j = 0; j < board.length; j++) {
      let rowInd = (color === 'white' ? j : 7 - j)
      let square = row[rowInd]
      const coord = `${numToLetter[rowInd]}${8 - boardInd}`
      // If piece is animating, hide it on the board
      const isAnimating = animatedPiece && animatedPiece.from === coord
      const squareToRender = isAnimating ? null : square

      let bgColor = (rowInd + boardInd) % 2 === 1 ? 'bg-[#739552]' : 'bg-[#EBECD0]'
      let textColor = (rowInd + boardInd) % 2 === 0 ? 'text-[#739552]' : 'text-[#EBECD0]'
      boardArr.push(
        <div key={coord} onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); }} className={`relative square flex flex-col ${bgColor} ${textColor}`} data-square={coord} onClick={handleSquareClick}>
          {rowInd === (color === 'white' ? 0 : 7) && <div data-square={coord} className='absolute text-xs font-semibold left-[3%]'>{8 - boardInd}</div>}
          {boardInd === (color === 'white' ? 7 : 0) && <div data-square={coord} className='absolute text-xs font-semibold self-end right-[5%] top-[69%]'>{numToLetter[rowInd]}</div>}
          {squareToRender != null ?
            <img
              src={icons[`${squareToRender.color}${squareToRender.type}`]}
              data-square={coord}
              className='m-auto z-20 h-[90%] w-[90%]'
              onDragStart={handleDragStart}
              draggable="true"
              alt={`${squareToRender.color}${squareToRender.type}`}
            /> : ""
          }
          <SquareUnderlay square={square} coord={coord} history={history} availableMoves={availableMoves} isCheck={isCheck} turn={turn} selectedSquare={selectedSquare} />
        </div>
      )
    }
  }

  return (
    <div id="board" className='relative grid-rows-8 grid-cols-8 grid grabbable text-black'>
      {boardArr}
      {/* Emoji overlays (transient). Positioned in board-relative percentages. */}
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
      {isGameOver[0] && <div className='absolute bg-zinc-800 bg-opacity-80 h-full w-full flex items-center justify-center z-40'>
        <div className='font-light text-white text-center text-4xl'>
          Game Over: <br/>
          {isGameOver[1].isCheckmate ? 'Checkmate' : isGameOver[1].isDraw ? 'Draw' : isGameOver[1].isStalemate ? 'Stalemate' : ''}
        </div>
      </div>}
    </div>
  )
}
