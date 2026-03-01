import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import GVImage from '../assets/images/G&V.webp'
import BoyImage from '../assets/images/boy.webp'
import GirlImage from '../assets/images/girl.webp'

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
  const [hovered, setHovered] = useState(null)
  const [pressed, setPressed] = useState(null)
  const pendingJoinRef = useRef(null) // Queued join name while waiting for socket

  // Execute pending join when socket becomes available
  useEffect(() => {
    console.log('[GameJoinPanel] Socket useEffect triggered, socket:', socket ? 'connected' : 'null', 'pending:', pendingJoinRef.current)
    if (socket && pendingJoinRef.current) {
      const name = pendingJoinRef.current
      pendingJoinRef.current = null
      console.log('[GameJoinPanel] Socket ready, executing pending join for:', name)
      // Execute the join
      if (setPlayerName) setPlayerName(name)
      setClaimed((prev) => ({ ...prev, [name]: true }))
      const onceGameId = (gid) => {
        console.log('[GameJoinPanel] Got gameId:', gid, 'emitting claimName:', name)
        try { socket.emit('claimName', name) } catch (_) {}
        socket.off('gameId', onceGameId)
      }
      socket.on('gameId', onceGameId)
      socket.emit('join')
      console.log('[GameJoinPanel] Emitted join event (from pending)')
    }
  }, [socket, setPlayerName])

  // Listen for name claim updates
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
    console.log('[GameJoinPanel] quickJoin called with:', name, 'socket:', socket ? 'connected' : 'null')
    if (!socket) {
      // Queue the join for when socket becomes available
      console.log('[GameJoinPanel] Socket not ready, queueing join for:', name)
      pendingJoinRef.current = name
      setClaimed((prev) => ({ ...prev, [name]: true })) // Optimistic UI update
      return
    }
    try {
      if (setPlayerName) setPlayerName(name)
      setClaimed((prev) => ({ ...prev, [name]: true }))
      const onceGameId = (gid) => {
        console.log('[GameJoinPanel] Got gameId:', gid, 'emitting claimName:', name)
        try { socket.emit('claimName', name) } catch (_) {}
        socket.off('gameId', onceGameId)
      }
      socket.on('gameId', onceGameId)
      socket.emit('join')
      console.log('[GameJoinPanel] Emitted join event')
    } catch (e) {
      console.error('[GameJoinPanel] quickJoin error:', e)
    }
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
        toast.className = 'ml-2 text-xs text-rt-gold transition-opacity duration-300'
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
          title: "ChessVermouth",
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
        if (qrAnchorRef.current) {
          const r = qrAnchorRef.current.getBoundingClientRect()
          const popupW = 200
          const popupH = 200
          let left = r.left + (r.width / 2) - r.width + 8
          let top = r.top + (r.height / 2) - popupH + 8
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
            dataUrl = await QRCode.toDataURL(url, {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 240,
              color: { dark: '#FFFFFF', light: '#0000' }
            })
          } catch (_) {
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
      } finally {
        setQrLoading(false)
      }
    } else {
      setIsQrOpen(false)
    }
  }

  // Redraw hit-test canvases
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
      if (!baseImgRef.current || !boyCanvasRef.current || !girlCanvasRef.current) return null
      const rect = baseImgRef.current.getBoundingClientRect()
      const x = Math.floor(clientX - rect.left)
      const y = Math.floor(clientY - rect.top)
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
      const bctx = boyCanvasRef.current.getContext('2d', { willReadFrequently: true })
      const gctx = girlCanvasRef.current.getContext('2d', { willReadFrequently: true })
      if (!bctx || !gctx) return null
      const b = bctx.getImageData(x, y, 1, 1).data[3]
      if (b > 8) return 'Gallant'
      const g = gctx.getImageData(x, y, 1, 1).data[3]
      if (g > 8) return 'Vermouth'
      return null
    } catch (_) {
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
    console.log('[GameJoinPanel] onPointerDown, isHome:', isHome)
    if (!isHome) return
    const side = hitTest(e.clientX, e.clientY)
    console.log('[GameJoinPanel] hitTest result:', side, 'claimed:', claimed)
    const isDisabled = side === 'Gallant' ? !!claimed.Gallant : side === 'Vermouth' ? !!claimed.Vermouth : false
    if (side && !isDisabled) setPressed(side)
  }
  const onPointerUp = (e) => {
    console.log('[GameJoinPanel] onPointerUp, isHome:', isHome, 'pressed:', pressed)
    if (!isHome) return
    const side = hitTest(e.clientX, e.clientY)
    console.log('[GameJoinPanel] hitTest result:', side, 'pressed:', pressed, 'isDisabled:', side === 'Gallant' ? !!claimed.Gallant : !!claimed.Vermouth)
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
        <p>Network: <span className='font-mono text-rt-gold'>{networkName}</span></p>
        )}
        <p className='flex items-center justify-center gap-2'>
          <span>Connect:</span>
          {url ? (
            <button
              type='button'
              onClick={handleShareClick}
              className='font-mono text-rt-gold underline underline-offset-2 hover:opacity-90 active:opacity-80 bg-transparent p-0 border-0 focus:outline-none focus:ring-0'
              aria-label='Share connect URL'
              title='Tap to share or copy'
            >
              {url}
            </button>
          ) : (
            <span className='font-mono text-rt-gold'>unknown</span>
          )}
          {url && (
            <span className='relative inline-flex items-center gap-1' ref={qrAnchorRef}>
              {/* QR Code button */}
              <button
                type='button'
                onClick={handleQrToggle}
                aria-label={isQrOpen ? 'Hide QR code' : 'Show QR code'}
                className='inline-flex items-center justify-center h-[1.1em] w-[1.1em] p-0 bg-transparent border-0 text-white/90 hover:opacity-90 active:opacity-80'
                title={isQrOpen ? 'Hide QR code' : 'Show QR code'}
              >
                <svg viewBox='0 0 24 24' width='1em' height='1em' fill='currentColor' aria-hidden='true'>
                  <rect x='3' y='3' width='7' height='7' rx='1'></rect>
                  <rect x='14' y='3' width='7' height='7' rx='1'></rect>
                  <rect x='3' y='14' width='7' height='7' rx='1'></rect>
                  <path d='M14 14h3v3h-3zM17 17h4v4h-4zM21 14h-2v-2h2zM14 21h-2v-2h2z'></path>
                </svg>
              </button>
              {/* Share button */}
              <button
                type='button'
                onClick={handleShareClick}
                aria-label='Share game link'
                className='inline-flex items-center justify-center h-[1.1em] w-[1.1em] p-0 bg-transparent border-0 text-white/90 hover:opacity-90 active:opacity-80'
                title='Share game link'
              >
                <svg viewBox='0 0 24 24' width='1em' height='1em' fill='currentColor' aria-hidden='true'>
                  <path d='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z'/>
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
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            style={{
              cursor: hovered ? ((hovered === 'Gallant' && claimed.Gallant) || (hovered === 'Vermouth' && claimed.Vermouth) ? 'not-allowed' : 'pointer') : 'default'
            }}
          >
            <img
              ref={baseImgRef}
              src={GVImage}
              alt='Choose player'
              className='block w-full h-auto select-none'
              onLoad={() => setBaseLoaded(true)}
              draggable='false'
            />
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
              onLoad={() => setBoyLoaded(true)}
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
              onLoad={() => setGirlLoaded(true)}
              draggable='false'
            />

            {/* Connecting overlay - shown when user clicked but socket not ready */}
            {!socket && (claimed.Gallant || claimed.Vermouth) && (
              <div className='absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg'>
                <div className='flex flex-col items-center gap-2 text-white'>
                  <div className='w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
                  <span className='text-sm font-medium'>Connecting...</span>
                </div>
              </div>
            )}

            {/* Hidden accessible buttons */}
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
