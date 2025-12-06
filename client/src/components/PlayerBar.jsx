import React from 'react'
import PropTypes from 'prop-types'

/**
 * PlayerBar - Glassy timer bar above/below the chessboard
 * Shows player name, captured pieces, and clock
 */
export default function PlayerBar({
  name,
  side, // 'white' | 'black'
  minutes,
  seconds,
  active,
  capturedPieces, // array of piece objects { type, color }
  icons, // piece icon map
  isTop, // whether this is the top bar (opponent) or bottom (player)
  easterEgg,
  onClick,
}) {
  const isWhite = side === 'white'
  
  // Color theming based on side
  const bgGradient = isWhite
    ? 'linear-gradient(135deg, rgba(245,245,245,0.95) 0%, rgba(230,230,230,0.92) 100%)'
    : 'linear-gradient(135deg, rgba(30,30,30,0.92) 0%, rgba(18,18,20,0.95) 100%)'
  
  const borderColor = isWhite
    ? 'rgba(255,255,255,0.25)'
    : 'rgba(80,80,80,0.4)'
  
  const textColor = isWhite ? 'text-zinc-900' : 'text-white'
  const subTextColor = isWhite ? 'text-zinc-600' : 'text-zinc-400'
  
  // Active glow effect - Refined Tactility Gold
  const activeRing = active
    ? isWhite
      ? 'ring-2 ring-rt-gold/60 shadow-[0_0_20px_rgba(201,162,39,0.3)]'
      : 'ring-2 ring-rt-gold/50 shadow-[0_0_20px_rgba(201,162,39,0.25)]'
    : ''

  // Captured pieces display
  const renderCapturedPieces = () => {
    if (!capturedPieces || capturedPieces.length === 0 || !icons) {
      return <span className={`text-xs ${subTextColor} opacity-50`}>—</span>
    }
    return (
      <div className='flex items-center gap-0.5 flex-wrap'>
        {capturedPieces.map((piece, idx) => {
          const iconKey = `${piece.color}${piece.type}`
          const iconSrc = icons[iconKey]
          if (!iconSrc) return null
          return (
            <img
              key={idx}
              src={iconSrc}
              alt={`${piece.color}${piece.type}`}
              className='h-4 w-4 opacity-70'
              style={{ filter: isWhite ? 'none' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
            />
          )
        })}
      </div>
    )
  }

  const displayName = name && name.trim() ? name.trim() : (isTop ? 'Opponent' : 'You')

  return (
    <button
      type='button'
      onClick={onClick}
      className={`
        w-full rounded-xl border backdrop-blur-md
        px-4 py-2.5
        flex items-center justify-between gap-3
        transition-all duration-200 ease-out
        ${activeRing}
        ${textColor}
      `}
      style={{
        background: bgGradient,
        borderColor: borderColor,
        boxShadow: active
          ? undefined
          : isWhite
            ? '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)'
            : '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      aria-pressed={active}
    >
      {/* Left: Name + Captured Pieces */}
      <div className='flex flex-col items-start gap-0.5 min-w-0 flex-1'>
        <span className={`text-sm font-semibold truncate max-w-[120px] ${textColor}`}>
          {displayName}
        </span>
        <div className='flex items-center gap-1'>
          {renderCapturedPieces()}
        </div>
      </div>

      {/* Right: Clock */}
      <div 
        className={`
          flex items-center justify-center
          rounded-lg px-3 py-1.5
          font-mono font-bold text-lg
          ${active 
            ? isWhite 
              ? 'bg-rt-gold text-rt-bg' 
              : 'bg-rt-gold text-rt-bg'
            : isWhite
              ? 'bg-zinc-200/80 text-zinc-800'
              : 'bg-zinc-800/80 text-zinc-200'
          }
          transition-colors duration-200
        `}
        style={{ 
          fontVariantNumeric: 'tabular-nums',
          minWidth: '72px',
          textShadow: active ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {easterEgg ? (
          <span className='text-sm'>長考之王</span>
        ) : (
          <>
            <span>{minutes}</span>
            <span className={`mx-0.5 ${active ? 'animate-pulse' : ''}`}>:</span>
            <span>{String(seconds).padStart(2, '0')}</span>
          </>
        )}
      </div>
    </button>
  )
}

PlayerBar.propTypes = {
  name: PropTypes.string,
  side: PropTypes.oneOf(['white', 'black']).isRequired,
  minutes: PropTypes.number.isRequired,
  seconds: PropTypes.number.isRequired,
  active: PropTypes.bool,
  capturedPieces: PropTypes.arrayOf(PropTypes.shape({
    type: PropTypes.string,
    color: PropTypes.string,
  })),
  icons: PropTypes.object,
  isTop: PropTypes.bool,
  easterEgg: PropTypes.bool,
  onClick: PropTypes.func,
}
