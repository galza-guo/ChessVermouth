import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useChessClock } from '../hooks/useChessClock'

// Import icons
import IconEmoji from '../assets/icons/Emoji.png'
import IconEmojiOn from '../assets/icons/Emoji-on.png'
import IconUndo from '../assets/icons/Undo.png'
import IconAI from '../assets/icons/AI.png'
import IconAnalyseOn from '../assets/icons/Analyse-on.png'

function TimerDisplay({ label, minutes, seconds, active, onClick, easterEgg }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`group w-full rounded-lg border border-white/10 backdrop-blur px-3 py-2 text-sm text-white/90 transition-all ${active ? 'bg-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-2 ring-rt-gold/40' : 'bg-white/5 shadow-inner'}`}
      aria-pressed={active}
    >
      <div className='flex flex-col items-start gap-1'>
        <span className={`text-[10px] uppercase tracking-wide ${active ? 'text-rt-gold' : 'text-zinc-300'}`}>{label}</span>
        <div style={{ fontVariantNumeric: 'tabular-nums' }} className='font-semibold text-base'>
          {easterEgg ? (
            <span className='text-rt-gold'>長考之王</span>
          ) : (
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

function formatScore(score) {
  if (!score || typeof score !== 'object') return '-'
  if (score.type === 'mate') return `#${score.value}`
  if (score.type === 'cp') return `${score.value >= 0 ? '+' : ''}${score.value}`
  return '-'
}

export default function ControlPanel({ 
  history, 
  tableEnd, 
  socket, 
  status, 
  gameId, 
  clockResetNonce, 
  isHotSeatMode, 
  hotSeatCurrentPlayer, 
  hotSeatGame, 
  updateHotSeatPosition, 
  onRequestReset, 
  onRequestLeave, 
  turn, 
  color, 
  isGameOver, 
  playerName, 
  opponentName, 
  serverIp, 
  serverPort, 
  enginePort, 
  onSendEmoji, 
  onClockUpdate, 
  onBestMoveChange, 
  onMenuClick, 
  isMenuOpen, 
  onHistoryClick, 
  onResetClick, 
  onLeaveClick, 
  onCopyBoard, 
  onPasteBoard 
}) {
  // ViewWindow: versatile middle panel (MoveListView | AnalysisView | EmojiView)
  const [panelView, setPanelView] = useState('MoveListView')
  
  // Auto-scroll the move list to the latest move
  useEffect(() => {
    const el = tableEnd && tableEnd.current
    if (el && panelView === 'MoveListView') {
      el.scrollTop = el.scrollHeight
    }
  }, [history, tableEnd, panelView])

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

  // Clock logic
  const playing = status === 'ready' && !(isGameOver && isGameOver[0])
  const activeTurn = isHotSeatMode ? (hotSeatCurrentPlayer || '') : (turn || '')
  const resetKey = isHotSeatMode ? `hs-${clockResetNonce}` : `net-${gameId || 'none'}-${clockResetNonce}`

  const { whiteMs, blackMs, clickSwitchTo } = useChessClock({
    isPlaying: playing,
    activeTurn,
    resetKey,
  })

  // Expose latest clocks to parent
  useEffect(() => {
    try { if (typeof onClockUpdate === 'function') onClockUpdate({ whiteMs, blackMs }) } catch (_) {}
  }, [whiteMs, blackMs, onClockUpdate])

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

  const activeColor = playing
    ? ((activeTurn === 'w') ? 'white' : (activeTurn === 'b' ? 'black' : null))
    : null

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

  // --- AI integration (Stockfish over LAN engine server) ---
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiBest, setAiBest] = useState(null)
  const [aiLines, setAiLines] = useState([])
  const [aiExplanation, setAiExplanation] = useState(null)
  const [aiLlmFailed, setAiLlmFailed] = useState(false)
  const [aiTypedText, setAiTypedText] = useState('')
  const aiWsRef = useRef(null)

  // Update best move arrow when analysis is active
  useEffect(() => {
    if (onBestMoveChange) {
      onBestMoveChange(panelView === 'AnalysisView' && aiBest ? aiBest : null)
    }
  }, [panelView, aiBest, onBestMoveChange])

  // --- Emoji assets (thumbnails) ---
  const emojiImages = useMemo(() => {
    try {
      const modules = import.meta.glob('../assets/emojis/*', { eager: true })
      const list = Object.keys(modules).map((k) => {
        const mod = modules[k]
        const src = mod && (mod.default || mod)
        const name = k.split('/').pop()
        return { src, name }
      }).filter((e) => !!e.src)
      list.sort((a, b) => a.name.localeCompare(b.name))
      return list
    } catch (_) {
      return []
    }
  }, [])

  const uciFromHistory = useCallback((hist) => {
    if (!Array.isArray(hist)) return []
    return hist.map((m) => {
      let promo = ''
      if (m && typeof m.san === 'string') {
        const mm = m.san.match(/=([QRBN])/)
        if (mm && mm[1]) promo = mm[1].toLowerCase()
      }
      return `${m.from}${m.to}${promo}`
    })
  }, [])

  const closeAiWs = useCallback(() => {
    try { if (aiWsRef.current) aiWsRef.current.close() } catch (_) {}
    aiWsRef.current = null
  }, [])

  const startAi = useCallback(() => {
    if (aiBusy) return
    setAiError(null)
    setAiBest(null)
    setAiLines([])
    setAiExplanation(null)
    setAiLlmFailed(false)
    setAiTypedText('')
    setAiBusy(true)
    const movesArr = uciFromHistory(history)
    const wsProto = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') ? 'wss' : 'ws'
    const host = serverIp
    const port = (enginePort && Number.isFinite(enginePort)) ? enginePort : 8080
    const q = new URLSearchParams({
      multipv: '2',
      movetime: '300',
      moves: movesArr.join(' '),
    })
    const url = `${wsProto}://${host}:${port}/ws/analyze?${q.toString()}`
    try {
      const ws = new WebSocket(url)
      aiWsRef.current = ws
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'info') {
            setAiLines((prev) => {
              const next = [...prev]
              const line = { multipv: msg.multipv, depth: msg.depth, pv: msg.pv, score: msg.score, wdl: msg.wdl }
              const idx = next.findIndex((l) => l.multipv === line.multipv)
              if (idx >= 0) next[idx] = line
              else next.push(line)
              next.sort((a, b) => a.multipv - b.multipv)
              return next
            })
          } else if (msg.type === 'result') {
            setAiBest(msg.bestmove)
            if (msg.explanation) {
              setAiExplanation(msg.explanation)
              setAiLlmFailed(false)
            } else {
              setAiLlmFailed(true)
            }
            if (Array.isArray(msg.lines)) {
              const mapped = msg.lines.map((l, i) => ({ multipv: i + 1, depth: l.depth, pv: l.pv, score: l.score, wdl: l.wdl }))
              setAiLines(mapped)
            }
            setAiBusy(false)
          } else if (msg.type === 'error') {
            const m = (msg.message || '').toString()
            if (m.includes('Missing gameId') || m.includes('Game not found')) {
              // Fallback: mirror current game into engine server via REST
              (async () => {
                try {
                  const engineGameId = `eng-${gameId || 'session'}-${Date.now()}`
                  const proxyBase = `http://${serverIp}:${serverPort}/engine`
                  await fetch(`${proxyBase}/game/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId: engineGameId })
                  })
                  for (const mv of movesArr) {
                    await fetch(`${proxyBase}/game/move`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ gameId: engineGameId, uci: mv })
                    })
                  }
                  try { ws.close() } catch (_) {}
                  const q2 = new URLSearchParams({ multipv: '2', movetime: '300', gameId: engineGameId })
                  const url2 = `${wsProto}://${host}:${port}/ws/analyze?${q2.toString()}`
                  const ws2 = new WebSocket(url2)
                  aiWsRef.current = ws2
                  ws2.onmessage = ws.onmessage
                  ws2.onerror = () => { setAiError('Connection error'); setAiBusy(false) }
                  ws2.onclose = () => { setAiBusy(false) }
                } catch (e) {
                  setAiError(m || 'Engine error')
                  setAiBusy(false)
                }
              })()
            } else {
              setAiError(m || 'Engine error')
              setAiBusy(false)
            }
          }
        } catch (e) {
          // ignore
        }
      }
      ws.onerror = () => {
        setAiError('Connection error')
        setAiBusy(false)
      }
      ws.onclose = () => {
        setAiBusy(false)
      }
    } catch (e) {
      setAiError('Failed to connect')
      setAiBusy(false)
    }
  }, [aiBusy, history, serverIp, serverPort, enginePort, gameId, uciFromHistory])

  const toggleAi = () => {
    if (aiBusy) {
      closeAiWs()
      setAiBusy(false)
      setPanelView('MoveListView')
      return
    }
    if (panelView !== 'AnalysisView') {
      setPanelView('AnalysisView')
      startAi()
    } else {
      setPanelView('MoveListView')
      closeAiWs()
    }
  }

  // Auto-update analysis when history changes while AnalysisView is open
  useEffect(() => {
    if (panelView === 'AnalysisView' && !aiBusy) {
      startAi()
    }
  }, [history.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle EmojiView
  const toggleEmoji = () => {
    if (panelView !== 'EmojiView') {
      if (aiBusy) {
        closeAiWs()
        setAiBusy(false)
      }
      setPanelView('EmojiView')
    } else {
      setPanelView('MoveListView')
    }
  }

  useEffect(() => () => closeAiWs(), [closeAiWs])

  // Typewriter effect for LLM explanation
  useEffect(() => {
    if (!aiExplanation) {
      setAiTypedText('')
      return
    }
    let index = 0
    setAiTypedText('')
    const interval = setInterval(() => {
      if (index < aiExplanation.length) {
        setAiTypedText(aiExplanation.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [aiExplanation])

  // Determine player color for theming
  const playerColor = isHotSeatMode ? (hotSeatCurrentPlayer === 'w' ? 'white' : 'black') : (color || 'white')
  const isWhitePlayer = playerColor === 'white'

  // Panel theming based on player color
  const panelBg = isWhitePlayer
    ? 'linear-gradient(135deg, rgba(245,245,245,0.92) 0%, rgba(230,230,230,0.88) 100%)'
    : 'linear-gradient(135deg, rgba(30,30,30,0.92) 0%, rgba(18,18,20,0.95) 100%)'
  const panelBorder = isWhitePlayer ? 'rgba(200,200,200,0.4)' : 'rgba(80,80,80,0.4)'
  const textColorClass = isWhitePlayer ? 'text-zinc-900' : 'text-white'

  return (
    <div 
      className={`w-full p-4 flex flex-col gap-4 rounded-xl border backdrop-blur-md ${textColorClass}`}
      style={{ 
        maxWidth: 'min(92vw, 500px)',
        background: panelBg,
        borderColor: panelBorder,
        boxShadow: isWhitePlayer 
          ? '0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)' 
          : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className='flex flex-row flex-nowrap gap-4 items-stretch w-full flex-1'>
        {/* Left: vertical icon-only actions */}
        <div className='flex flex-col items-start gap-2 shrink-0 p-2 -m-2'>
          {/* Emoji (ViewWindow toggle) */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Emoji'
              className={`neo-btn neo-btn-toggle ${panelView === 'EmojiView' ? 'emoji-active' : ''} ${isWhitePlayer ? 'neo-btn-light' : ''}`}
              aria-pressed={panelView === 'EmojiView'}
              onClick={toggleEmoji}
            >
              <img
                src={panelView === 'EmojiView' ? IconEmojiOn : IconEmoji}
                alt='' aria-hidden='true'
                className={`h-5 w-auto object-contain ${panelView === 'EmojiView' ? '' : (isWhitePlayer ? 'brightness-0' : 'brightness-0 invert')}`}
              />
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Emoji</span>
          </div>

          {/* AI (ViewWindow toggle) */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Analyse'
              className={`neo-btn neo-btn-toggle ${panelView === 'AnalysisView' ? 'analyze-active' : ''} ${isWhitePlayer ? 'neo-btn-light' : ''}`}
              aria-pressed={panelView === 'AnalysisView'}
              onClick={toggleAi}
            >
              <img
                src={panelView === 'AnalysisView' ? IconAnalyseOn : IconAI}
                alt='' aria-hidden='true'
                className={`h-5 w-auto object-contain ${panelView === 'AnalysisView' ? '' : (isWhitePlayer ? 'brightness-0' : 'brightness-0 invert')}`}
              />
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Analyse</span>
          </div>

          {/* Undo */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Undo'
              className={`neo-btn ${isWhitePlayer ? 'neo-btn-light' : ''}`}
              onClick={handleUndo}
            >
              <img src={IconUndo} alt='' aria-hidden='true' className={`h-5 w-auto object-contain ${isWhitePlayer ? 'brightness-0' : 'brightness-0 invert'}`} />
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Undo</span>
          </div>

          {/* Menu */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Menu'
              className={`neo-btn ${isWhitePlayer ? 'neo-btn-light' : ''}`}
              onClick={onMenuClick}
            >
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className={isWhitePlayer ? 'brightness-0' : 'brightness-0 invert'}>
                <circle cx='12' cy='12' r='1'/>
                <circle cx='12' cy='5' r='1'/>
                <circle cx='12' cy='19' r='1'/>
              </svg>
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Menu</span>
            {/* Context Menu Dropdown */}
            {isMenuOpen && (
              <div 
                data-context-menu='1' 
                className='absolute left-full top-0 ml-2 z-50 w-40 rounded-lg border border-zinc-300 bg-zinc-100 shadow-xl'
              >
                <button
                  type='button'
                  className='w-full px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-200 rounded-t-lg'
                  onClick={() => { onMenuClick && onMenuClick(); onHistoryClick && onHistoryClick() }}
                >
                  History
                </button>
                <hr className='border-zinc-300 mx-2' />
                <button
                  type='button'
                  className='w-full px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-200'
                  onClick={() => { onMenuClick && onMenuClick(); onCopyBoard && onCopyBoard() }}
                >
                  Copy Chessboard
                </button>
                <button
                  type='button'
                  className='w-full px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-200'
                  onClick={() => { onMenuClick && onMenuClick(); onPasteBoard && onPasteBoard() }}
                >
                  Paste Chessboard
                </button>
                <hr className='border-zinc-300 mx-2' />
                <button
                  type='button'
                  className='w-full px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-200'
                  onClick={onResetClick}
                >
                  Reset Game
                </button>
                <button
                  type='button'
                  className='w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-zinc-200 rounded-b-lg'
                  onClick={onLeaveClick}
                >
                  {isHotSeatMode ? 'New Game' : 'Leave Game'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Middle: versatile panel (ViewWindow) */}
        <div className='flex flex-col gap-3 min-w-0 basis-1/2 grow'>
          <div
            ref={tableEnd}
            role='region'
            aria-label={panelView === 'AnalysisView' ? 'AI Analysis' : (panelView === 'EmojiView' ? 'Emoji' : 'Move List')}
            className={`relative flex-1 min-h-[12rem] overflow-auto rounded-lg border p-2 select-text ${isWhitePlayer ? 'border-zinc-300/50 bg-white/50' : 'border-white/10 bg-white/5'}`}
          >
            {/* MoveListView */}
            {panelView === 'MoveListView' && (
              <>
                {history.length === 0 ? (
                  <div className={`text-xs ${isWhitePlayer ? 'text-zinc-500' : 'text-zinc-400'}`}>No moves yet</div>
                ) : (
                  <div className='grid grid-cols-2 gap-x-4 gap-y-0.5 content-start'>
                    {Array.from({ length: Math.ceil(history.length / 2) }).map((_, k) => {
                      const i = k * 2
                      const moveWhite = history[i]
                      const moveBlack = history[i + 1]
                      return (
                        <div key={k} className={`flex items-center text-sm ${isWhitePlayer ? 'text-zinc-900' : 'text-white/90'}`}>
                          <span className={`w-8 text-right font-mono text-xs mr-2 opacity-50`}>{k + 1}</span>
                          <span className='flex-1 font-medium truncate ml-1'>{moveWhite.san}</span>
                          <span className='flex-1 font-medium truncate ml-1'>{moveBlack?.san || ''}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* AnalysisView */}
            {panelView === 'AnalysisView' && (
              <div className='space-y-2 text-sm'>
                <div className='flex items-center gap-2 mb-1'>
                  <span className={`text-xs ${isWhitePlayer ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {turn === 'w' ? '白方' : '黑方'}参考：
                  </span>
                  {aiBest && (
                    <span className={`font-mono font-medium ${isWhitePlayer ? 'text-zinc-900' : 'text-white'}`}>{aiBest}</span>
                  )}
                </div>
                {aiError && <div className='text-red-400 mb-2'>Error: {aiError}</div>}
                
                {/* Pulsing dot while waiting */}
                {aiBusy && (
                  <div className='flex items-center gap-2'>
                    <span className={`inline-block w-2 h-2 rounded-full animate-pulse ${isWhitePlayer ? 'bg-amber-500' : 'bg-amber-400'}`} />
                    <span className={isWhitePlayer ? 'text-zinc-600' : 'text-zinc-400'}>分析中...</span>
                  </div>
                )}
                
                {/* LLM Explanation with typewriter effect */}
                {!aiBusy && aiExplanation && (
                  <div className={`leading-relaxed ${isWhitePlayer ? 'text-zinc-800' : 'text-zinc-100'}`}>
                    {aiTypedText}
                    {aiTypedText.length < aiExplanation.length && (
                      <span className={`inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle ${isWhitePlayer ? 'bg-zinc-600' : 'bg-zinc-300'}`} />
                    )}
                  </div>
                )}
                
                {/* Fallback: Raw Stockfish data - ONLY if LLM failed */}
                {!aiBusy && aiLlmFailed && (
                  <div className='space-y-1'>
                    {aiLines.length === 0 && !aiError && (
                      <div className={isWhitePlayer ? 'text-zinc-500' : 'text-zinc-400'}>No analysis available</div>
                    )}
                    {aiLines.map((l) => (
                      <div key={l.multipv} className='space-y-0.5'>
                        <div className='flex items-center justify-between'>
                          <div className={isWhitePlayer ? 'text-zinc-700' : 'text-zinc-300'}>#{l.multipv} d{l.depth ?? '-'} — <span className='font-mono'>{formatScore(l.score)}</span></div>
                          <div className={`truncate font-mono ml-2 ${isWhitePlayer ? 'text-zinc-900' : 'text-white/90'}`} title={l.pv}>{l.pv}</div>
                        </div>
                        {l.wdl && (
                          <div className='flex items-center gap-2'>
                            <div className='flex-1 h-2 rounded overflow-hidden flex'>
                              <div className='bg-white' style={{ width: `${l.wdl.win / 10}%` }} title={`Win: ${(l.wdl.win / 10).toFixed(1)}%`} />
                              <div className='bg-zinc-500' style={{ width: `${l.wdl.draw / 10}%` }} title={`Draw: ${(l.wdl.draw / 10).toFixed(1)}%`} />
                              <div className='bg-zinc-900' style={{ width: `${l.wdl.loss / 10}%` }} title={`Loss: ${(l.wdl.loss / 10).toFixed(1)}%`} />
                            </div>
                            <div className={`text-[10px] font-mono whitespace-nowrap ${isWhitePlayer ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              {(l.wdl.win / 10).toFixed(0)}% / {(l.wdl.draw / 10).toFixed(0)}% / {(l.wdl.loss / 10).toFixed(0)}%
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* EmojiView */}
            {panelView === 'EmojiView' && (
              <div className='h-full'>
                {emojiImages.length === 0 ? (
                  <div className='text-xs text-zinc-400'>No emojis found.</div>
                ) : (
                  <div className='grid grid-cols-4 sm:grid-cols-6 gap-0'>
                    {emojiImages.map((e) => (
                      <button
                        key={e.src}
                        type='button'
                        className='relative m-0 p-0 w-full aspect-square rounded-none border-0 bg-transparent'
                        title={e.name}
                        onClick={() => onSendEmoji && onSendEmoji(e.src, e.name)}
                      >
                        <img src={e.src} alt={e.name} className='absolute inset-0 h-full w-full object-contain' />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
