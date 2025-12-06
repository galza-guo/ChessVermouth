import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import GVImage from '../assets/images/G&V.webp'
import BoyImage from '../assets/images/boy.webp'
import GirlImage from '../assets/images/girl.webp'

// We need to import config or pass props for environment variables if needed
// For now assuming passed as props or using import.meta.env directly

export default function GameJoinPanel({ socket, status, color, gameId, serverIp, serverInfo, clientPort, isQrOpen, setIsQrOpen, qrDataUrl, setQrDataUrl, qrLoading, setQrLoading, setPlayerName }) {
  const ip = (serverInfo && serverInfo.lanIp) ? serverInfo.lanIp : serverIp
  const protocol = (typeof window !== 'undefined' && window.location && window.location.protocol) || 'http:'
  const networkName = serverInfo && serverInfo.networkName ? serverInfo.networkName : null
  const url = ip ? `${protocol}//${ip}:${clientPort}` : null
  const qrAnchorRef = useRef(null)
  const [qrPos, setQrPos] = useState({ top: 0, left: 0 })
  const isHome = ((import.meta.env.VITE_HOME || '').trim() === 'G&V')
  const [claimed, setClaimed] = useState({ Gallant: false, Vermouth: false })
  const containerRef = useRef(null)
  const baseImgRef = useRef(null)
  const boyOverlayRef = useRef(null)
  const girlOverlayRef = useRef(null)
  const boyCanvasRef = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null)
  const girlCanvasRef = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null)
  const [baseLoaded, setBaseLoaded] = useState(false)
  const [boyLoaded, setBoyLoaded] = useState(false)
  const [girlLoaded, setGirlLoaded] = useState(false)
  const [hovered, setHovered] = useState(null) // 'Gallant' | 'Vermouth' | null
  const [pressed, setPressed] = useState(null)
  
  // Debug mount
  useEffect(() => {
    console.log('[GameJoinPanel] MOUNTED. isHome?', isHome, 'Socket?', !!socket)
  }, [])

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
    console.log('[GameJoinPanel] quickJoin called for:', name, 'Socket present?', !!socket)
    if (!socket) {
       console.error('[GameJoinPanel] Socket not available for join')
       return
    }
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

  // Redraw hit-test canvases to match displayed size
  useEffect(() => {
    const redraw = () => {
      try {
        if (!baseImgRef.current || !boyOverlayRef.current || !girlOverlayRef.current) return
        const rect = baseImgRef.current.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width))
        const h = Math.max(1, Math.floor(rect.height))
        if (!boyCanvasRef.current || !girlCanvasRef.current) return
        const bcv = boyCanvasRef.current
        const gcv = girlCanvasRef.current
        if (bcv.width !== w) bcv.width = w
        if (bcv.height !== h) bcv.height = h
        if (gcv.width !== w) gcv.width = w
        if (gcv.height !== h) gcv.height = h
        const bctx = bcv.getContext('2d', { willReadFrequently: true })
        const gctx = gcv.getContext('2d', { willReadFrequently: true })
        if (!bctx || !gctx) return
        bctx.clearRect(0, 0, w, h)
        gctx.clearRect(0, 0, w, h)
        // Draw overlays scaled to fit exactly the displayed area
        bctx.drawImage(boyOverlayRef.current, 0, 0, w, h)
        gctx.drawImage(girlOverlayRef.current, 0, 0, w, h)
      } catch (_) {}
    }
    if (baseLoaded && boyLoaded && girlLoaded) {
      redraw()
      window.addEventListener('resize', redraw)
      return () => window.removeEventListener('resize', redraw)
    }
  }, [baseLoaded, boyLoaded, girlLoaded])

  const hitTest = useCallback((clientX, clientY) => {
    try {
      if (!baseImgRef.current || !boyCanvasRef.current || !girlCanvasRef.current) {
        console.warn('[GameJoinPanel] Refs missing for hitTest')
        return null
      }
      const rect = baseImgRef.current.getBoundingClientRect()
      const x = Math.floor(clientX - rect.left)
      const y = Math.floor(clientY - rect.top)
      // console.log('[GameJoinPanel] HitTest coords:', x, y, 'Rect:', rect.width, rect.height)
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
      const bctx = boyCanvasRef.current.getContext('2d', { willReadFrequently: true })
      const gctx = girlCanvasRef.current.getContext('2d', { willReadFrequently: true })
      if (!bctx || !gctx) return null
      const b = bctx.getImageData(x, y, 1, 1).data[3]
      if (b > 8) return 'Gallant'
      const g = gctx.getImageData(x, y, 1, 1).data[3]
      if (g > 8) return 'Vermouth'
      return null
    } catch (e) {
      console.error('[GameJoinPanel] HitTest error', e)
      return null
    }
  }, [])

  const onPointerMove = (e) => {
    if (!isHome) return
    const side = hitTest(e.clientX, e.clientY)
    setHovered(side)
  }
  const onPointerLeave = () => {
    setHovered(null)
    setPressed(null)
  }
  const onPointerDown = (e) => {
    if (!isHome) return
    const side = hitTest(e.clientX, e.clientY)
    const isDisabled = side === 'Gallant' ? !!claimed.Gallant : side === 'Vermouth' ? !!claimed.Vermouth : false
    if (side && !isDisabled) setPressed(side)
  }
  const onPointerUp = (e) => {
    if (!isHome) return
    const side = hitTest(e.clientX, e.clientY)
    console.log('[GameJoinPanel] PointerUp side:', side, 'Pressed:', pressed)
    const isDisabled = side === 'Gallant' ? !!claimed.Gallant : side === 'Vermouth' ? !!claimed.Vermouth : false
    if (side && pressed === side && !isDisabled) {
      quickJoin(side)
    }
    setPressed(null)
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
          <div
            ref={containerRef}
            className='relative w-full overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-inner'
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerDown={(e) => {
              console.log('[GameJoinPanel] Container PointerDown')
              onPointerDown(e)
            }}
            onPointerUp={(e) => {
              console.log('[GameJoinPanel] Container PointerUp')
              onPointerUp(e)
            }}
            onClick={() => console.log('[GameJoinPanel] Container Click')}
            style={{
              cursor: hovered ? ((hovered === 'Gallant' && claimed.Gallant) || (hovered === 'Vermouth' && claimed.Vermouth) ? 'not-allowed' : 'pointer') : 'default'
            }}
          >
            {/* Base composite image */}
            <img
              ref={baseImgRef}
              src={GVImage}
              alt='Choose player'
              className='block w-full h-auto select-none'
              onLoad={() => {
                console.log('[GameJoinPanel] Base image loaded')
                setBaseLoaded(true)
              }}
              onError={(e) => console.error('[GameJoinPanel] Base image failed', e)}
              draggable='false'
            />
            {/* Overlays for hover/active/disabled visuals */}
            <img
              ref={boyOverlayRef}
              src={BoyImage}
              alt='Gallant overlay'
              className={`pointer-events-none select-none absolute inset-0 w-full h-full object-contain transition-all duration-150 ease-out ${claimed.Gallant ? 'opacity-30' : (hovered === 'Gallant' ? 'opacity-70' : 'opacity-0')} ${pressed === 'Gallant' ? 'scale-[0.99]' : ''}`}
              style={{
                filter: claimed.Gallant
                  ? 'grayscale(1)'
                  : (hovered === 'Gallant' ? 'drop-shadow(0 0 12px rgba(0,200,255,0.6)) drop-shadow(0 0 24px rgba(0,200,255,0.35))' : 'none')
              }}
              onLoad={() => {
                console.log('[GameJoinPanel] Boy overlay loaded')
                setBoyLoaded(true)
              }}
              onError={(e) => console.error('[GameJoinPanel] Boy overlay failed', e)}
              draggable='false'
            />
            <img
              ref={girlOverlayRef}
              src={GirlImage}
              alt='Vermouth overlay'
              className={`pointer-events-none select-none absolute inset-0 w-full h-full object-contain transition-all duration-150 ease-out ${claimed.Vermouth ? 'opacity-30' : (hovered === 'Vermouth' ? 'opacity-70' : 'opacity-0')} ${pressed === 'Vermouth' ? 'scale-[0.99]' : ''}`}
              style={{
                filter: claimed.Vermouth
                  ? 'grayscale(1)'
                  : (hovered === 'Vermouth' ? 'drop-shadow(0 0 12px rgba(255,80,160,0.65)) drop-shadow(0 0 24px rgba(255,80,160,0.4))' : 'none')
              }}
              onLoad={() => {
                console.log('[GameJoinPanel] Girl overlay loaded')
                setGirlLoaded(true)
              }}
              onError={(e) => console.error('[GameJoinPanel] Girl overlay failed', e)}
              draggable='false'
            />

            {/* Hidden accessible buttons for keyboard users */}
            <button
              type='button'
              className='sr-only'
              disabled={!!claimed.Gallant}
              onClick={() => quickJoin('Gallant')}
            >
              Join as Gallant
            </button>
            <button
              type='button'
              className='sr-only'
              disabled={!!claimed.Vermouth}
              onClick={() => quickJoin('Vermouth')}
            >
              Join as Vermouth
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
                    if (val) {
                      const onceGameId = (gid) => {
                        try { socket.emit('setName', { gameId: gid, name: val }) } catch (_) {}
                        socket.off('gameId', onceGameId)
                      }
                      socket.on('gameId', onceGameId)
                    }
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
