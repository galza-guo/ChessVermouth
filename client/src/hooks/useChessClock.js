import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

/**
 * useChessClock - Tracks elapsed time for both players
 * @param {boolean} isPlaying - Game running (status ready, not game over)
 * @param {string} activeTurn - 'w' | 'b' | '' — whose turn from game state
 * @param {string|number} resetKey - Changes when a new game starts
 * @returns {{ whiteMs: number, blackMs: number, clickSwitchTo: function }}
 */
export function useChessClock({
  isPlaying,
  activeTurn,
  resetKey,
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

  // Tick at ~4Hz for smooth-enough updates without cost
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

export default useChessClock
