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
      className={`group w-full rounded-lg border border-white/10 backdrop-blur px-3 py-2 text-sm text-white/90 transition-all ${active ? 'bg-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-2 ring-emerald-400/40' : 'bg-white/5 shadow-inner'}`}
      aria-pressed={active}
    >
      <div className='flex flex-col items-start gap-1'>
        <span className={`text-[10px] uppercase tracking-wide ${active ? 'text-emerald-300' : 'text-zinc-300'}`}>{label}</span>
        <div style={{ fontVariantNumeric: 'tabular-nums' }} className='font-semibold text-base'>
          {easterEgg ? (
            <span className='text-emerald-300'>長考之王</span>
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

export default function ControlPanel({ history, tableEnd, socket, status, gameId, clockResetNonce, isHotSeatMode, hotSeatCurrentPlayer, hotSeatGame, updateHotSeatPosition, onRequestReset, onRequestLeave, turn, color, isGameOver, playerName, opponentName, serverIp, serverPort, enginePort, onSendEmoji, onClockUpdate }) {
  // ViewWindow: versatile middle panel (MoveListView | AnalysisView | EmojiView)
  const [panelView, setPanelView] = useState('MoveListView')
  // Auto-scroll the move list to the latest move
  useEffect(() => {
    const el = tableEnd && tableEnd.current
    // ViewWindow: only auto-scroll when showing MoveListView
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



  // Clock logic
  const playing = status === 'ready' && !(isGameOver && isGameOver[0])
  const activeTurn = isHotSeatMode ? (hotSeatCurrentPlayer || '') : (turn || '')
  const resetKey = isHotSeatMode ? `hs-${clockResetNonce}` : `net-${gameId || 'none'}-${clockResetNonce}`

  const { whiteMs, blackMs, clickSwitchTo } = useChessClock({
    isPlaying: playing,
    activeTurn,
    resetKey,
  })
  // Expose latest clocks to parent for snapshot/server persistence
  useEffect(() => {
    try { if (typeof window !== 'undefined' && window.dispatchEvent) {} } catch (_) {}
    try { if (typeof onClockUpdate === 'function') onClockUpdate({ whiteMs, blackMs }) } catch (_) {}
  }, [whiteMs, blackMs]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // --- AI integration (Stockfish over LAN engine server) ---
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiBest, setAiBest] = useState(null)
  const [aiLines, setAiLines] = useState([])
  const aiWsRef = useRef(null)

  // --- Emoji assets (thumbnails) ---
  const emojiImages = useMemo(() => {
    try {
      // NOTE: Glob import in Vite
      const modules = import.meta.glob('../assets/emojis/*', { eager: true })
      const list = Object.keys(modules).map((k) => {
        const mod = modules[k]
        const src = mod && (mod.default || mod)
        const name = k.split('/').pop()
        return { src, name }
      }).filter((e) => !!e.src)
      // Stable sort by name
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
              const line = { multipv: msg.multipv, depth: msg.depth, pv: msg.pv, score: msg.score }
              const idx = next.findIndex((l) => l.multipv === line.multipv)
              if (idx >= 0) next[idx] = line
              else next.push(line)
              next.sort((a, b) => a.multipv - b.multipv)
              return next
            })
          } else if (msg.type === 'result') {
            setAiBest(msg.bestmove)
            if (Array.isArray(msg.lines)) {
              const mapped = msg.lines.map((l, i) => ({ multipv: i + 1, depth: l.depth, pv: l.pv, score: l.score }))
              setAiLines(mapped)
            }
            setAiBusy(false)
          } else if (msg.type === 'error') {
            const m = (msg.message || '').toString()
            if (m.includes('Missing gameId') || m.includes('Game not found')) {
              // Fallback: mirror current game into engine server via REST, then use stateful WS
              (async () => {
                try {
                  const engineGameId = `eng-${gameId || 'session'}-${Date.now()}`
                  // Proxy via the socket server to avoid CORS
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
                  // Switch to stateful stream
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
  }, [aiBusy, history, serverIp, enginePort, uciFromHistory, gameId, serverPort])

  const toggleAi = () => {
    // ViewWindow: toggle between MoveListView and AnalysisView
    if (aiBusy) {
      // If thinking, stop and return to MoveListView
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

  // Toggle EmojiView similar to AI button
  const toggleEmoji = () => {
    if (panelView !== 'EmojiView') {
      // If AI is running, stop it when switching to emojis
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

  return (
    <div className='glass-panel w-full p-4 flex flex-col gap-4'>
      <div className='flex flex-row flex-nowrap gap-4 items-start w-full overflow-hidden'>
        {/* Left: vertical icon-only actions */}
        <div className='flex flex-col items-start gap-2 shrink-0'>
          {/* Emoji (ViewWindow toggle) */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Emoji'
              className={`neo-btn neo-btn-toggle ${panelView === 'EmojiView' ? 'emoji-active' : ''}`}
              aria-pressed={panelView === 'EmojiView'}
              onClick={toggleEmoji}
            >
              <img
                src={panelView === 'EmojiView' ? IconEmojiOn : IconEmoji}
                alt='' aria-hidden='true'
                className={`h-5 w-auto object-contain ${panelView === 'EmojiView' ? '' : 'brightness-0 invert'}`}
              />
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Emoji</span>
          </div>

          {/* AI (ViewWindow toggle) - moved above Undo for prominence */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Analyse'
              className={`neo-btn neo-btn-toggle ${panelView === 'AnalysisView' ? 'analyze-active' : ''}`}
              aria-pressed={panelView === 'AnalysisView'}
              onClick={toggleAi}
            >
              <img
                src={panelView === 'AnalysisView' ? IconAnalyseOn : IconAI}
                alt='' aria-hidden='true'
                className={`h-5 w-auto object-contain ${panelView === 'AnalysisView' ? '' : 'brightness-0 invert'}`}
              />
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Analyse</span>
          </div>

          {/* Undo */}
          <div className='relative group'>
            <button
              type='button'
              aria-label='Undo'
              className='neo-btn'
              onClick={handleUndo}
            >
              <img src={IconUndo} alt='' aria-hidden='true' className='h-5 w-auto brightness-0 invert object-contain' />
            </button>
            <span
              role='tooltip'
              aria-hidden='true'
              className='pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition text-xs px-2 py-1 rounded-md border border-white/10 bg-zinc-900/90 text-white/90 shadow-lg shadow-black/30'
            >Undo</span>
          </div>



          {/* Reserve space for ~3 future buttons */}
          <div className='h-16 md:h-24' aria-hidden='true'></div>
        </div>

        {/* Middle: versatile panel (ViewWindow) */}
        <div className='flex flex-col gap-3 min-w-0 basis-1/2 grow'>
          <div
            ref={tableEnd}
            role='region'
            aria-label={panelView === 'AnalysisView' ? 'AI Analysis' : (panelView === 'EmojiView' ? 'Emoji' : 'Move List')}
            className='relative h-44 overflow-auto rounded-lg border border-white/10 bg-white/5 p-2 select-text'
          >
            {/* MoveListView */}
            {panelView === 'MoveListView' && (
              <>
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
              </>
            )}

            {/* AnalysisView */}
            {panelView === 'AnalysisView' && (
              <div className='space-y-2 text-sm'>
                <div className='flex items-center justify-end gap-2 mb-1'>
                  {aiBusy && <span className='text-amber-300'>Thinking…</span>}
                  {aiBest && <span className='text-emerald-300 font-mono'>best: {aiBest}</span>}
                </div>
                {aiError && <div className='text-red-400 mb-2'>Error: {aiError}</div>}
                <div className='space-y-1'>
                  {aiLines.length === 0 && !aiError && (
                    <div className='text-zinc-400'>Waiting for lines…</div>
                  )}
                  {aiLines.map((l) => (
                    <div key={l.multipv} className='flex items-center justify-between'>
                      <div className='text-zinc-300'>#{l.multipv} d{l.depth ?? '-'} — <span className='font-mono'>{formatScore(l.score)}</span></div>
                      <div className='truncate font-mono text-white/90 ml-2' title={l.pv}>{l.pv}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EmojiView (placeholder) */}
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
