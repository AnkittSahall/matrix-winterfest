import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveState, LiveTeam } from './live/types'
import './live/live-arena.css'

function formatProfit(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

function profitClass(n: number | null | undefined) {
  if (n == null) return 'dim'
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return ''
}

function rankDelta(team: LiveTeam) {
  if (team.prevRank == null) return { text: '–', cls: '' }
  const d = team.prevRank - team.rank
  if (d > 0) return { text: `▲${d}`, cls: 'arrow-up' }
  if (d < 0) return { text: `▼${Math.abs(d)}`, cls: 'arrow-down' }
  return { text: '–', cls: '' }
}

function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
    const fontSize = 14
    let drops: number[] = []

    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
      const cols = Math.floor(w / fontSize)
      drops = Array.from({ length: cols }, () => Math.random() * -40)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.fillStyle = 'rgba(7, 10, 18, 0.12)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(200, 16, 46, 0.55)'
      ctx.font = `${fontSize}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize)
        if (drops[i] * fontSize > h && Math.random() > 0.975) drops[i] = 0
        drops[i] += 0.65
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [reduce])

  return <canvas ref={ref} className="live-canvas" aria-hidden />
}

function useLiveState() {
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    let es: EventSource | null = null
    let pollId = 0
    let retryId = 0

    const apply = (data: LiveState) => {
      if (!alive || !data?.event) return
      setState(data)
      setError('')
    }

    const poll = async () => {
      try {
        const res = await fetch('/api/live/state')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed')
        apply(data)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Offline')
      }
    }

    const connect = () => {
      if (es) es.close()
      es = new EventSource('/api/live/stream')
      es.onmessage = (ev) => {
        try {
          apply(JSON.parse(ev.data))
        } catch {
          /* ignore */
        }
      }
      es.onerror = () => {
        es?.close()
        es = null
        void poll()
        retryId = window.setTimeout(connect, 4000)
      }
    }

    void poll()
    connect()
    pollId = window.setInterval(() => void poll(), 3000)

    return () => {
      alive = false
      es?.close()
      window.clearInterval(pollId)
      window.clearTimeout(retryId)
    }
  }, [])

  return { state, error }
}

function CountUp({ value, active }: { value: number; active: boolean }) {
  const [n, setN] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!active) {
      setN(value)
      return
    }
    if (reduce) {
      setN(value)
      return
    }
    const start = performance.now()
    const from = 0
    const dur = 550
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - (1 - p) ** 3
      setN(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, active, reduce])

  return <>{formatProfit(n)}</>
}

export function LiveArena() {
  const { state, error } = useLiveState()
  const reduce = useReducedMotion()
  const [muted, setMuted] = useState(true)
  const [soundReady, setSoundReady] = useState(false)
  const [logoOk, setLogoOk] = useState(true)
  const [logoSrc, setLogoSrc] = useState('/matrix-logo.png')
  const [revealPhase, setRevealPhase] = useState<'idle' | 'countdown' | 'filling' | 'done'>('idle')
  const [countdown, setCountdown] = useState(3)
  const [filledRound, setFilledRound] = useState(0)
  const [visibleFromBottom, setVisibleFromBottom] = useState(0)
  const [showChampion, setShowChampion] = useState(false)
  const prevRevealed = useRef(0)
  const lastChamp = useRef(false)

  const unlockSound = useCallback(() => {
    setSoundReady(true)
  }, [])

  useEffect(() => {
    const onClick = () => unlockSound()
    window.addEventListener('click', onClick, { once: true })
    return () => window.removeEventListener('click', onClick)
  }, [unlockSound])

  useEffect(() => {
    if (!state) return
    if (state.event.soundOn && soundReady) setMuted(false)
  }, [state?.event.soundOn, soundReady])

  const playTone = useCallback(
    (freq: number, ms = 180) => {
      if (muted || !soundReady || reduce) return
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.value = 0.04
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        setTimeout(() => {
          osc.stop()
          void ctx.close()
        }, ms)
      } catch {
        /* ignore */
      }
    },
    [muted, soundReady, reduce],
  )

  const fireConfetti = useCallback(() => {
    if (reduce) return
    void confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.35 },
      colors: ['#C8102E', '#22D3EE', '#F5C542', '#ffffff'],
    })
  }, [reduce])

  // Reveal sequence when revealedRound increases
  useEffect(() => {
    if (!state) return
    const r = state.event.revealedRound
    if (r <= prevRevealed.current) {
      if (r > 0) setFilledRound(r)
      return
    }
    const prev = prevRevealed.current
    prevRevealed.current = r

    if (reduce) {
      setFilledRound(r)
      setRevealPhase('done')
      if (r >= state.event.numRounds || state.event.championShown) {
        setShowChampion(true)
        fireConfetti()
      }
      return
    }

    setRevealPhase('countdown')
    setCountdown(3)
    setVisibleFromBottom(0)
    playTone(220, 120)

    let step = 3
    const id = window.setInterval(() => {
      step -= 1
      setCountdown(step)
      playTone(280 + (3 - step) * 40, 100)
      if (step <= 0) {
        window.clearInterval(id)
        setRevealPhase('filling')
        const n = state.teams.length || 1
        let i = 0
        const fill = window.setInterval(() => {
          i += 1
          setVisibleFromBottom(i)
          playTone(420, 80)
          if (i >= n) {
            window.clearInterval(fill)
            setFilledRound(r)
            setRevealPhase('done')
            const top = state.teams[0]
            const wasTop = prev > 0
            if (top && (!wasTop || top.prevRank !== 1)) fireConfetti()
            playTone(660, 220)
            if (r >= state.event.numRounds || state.event.championShown) {
              window.setTimeout(() => {
                setShowChampion(true)
                fireConfetti()
                playTone(880, 400)
              }, 700)
            }
          }
        }, 250)
      }
    }, 700)

    return () => window.clearInterval(id)
  }, [state?.event.revealedRound, state?.event.numRounds, state?.event.championShown, state?.teams, reduce, fireConfetti, playTone])

  useEffect(() => {
    if (!state) return
    if (state.event.championShown && !lastChamp.current && state.event.revealedRound >= state.event.numRounds) {
      lastChamp.current = true
      setShowChampion(true)
      fireConfetti()
    }
  }, [state?.event.championShown, state?.event.revealedRound, state?.event.numRounds, fireConfetti])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen()
    else void document.exitFullscreen()
  }

  const teams = state?.teams || []
  const numRounds = state?.event.numRounds || 3
  const revealed = filledRound
  const scroll = teams.length > 20

  const displayTeams = useMemo(() => {
    if (revealPhase !== 'filling') return teams
    // During fill: show sorted by OLD order (prevRank) or reverse current for dramatic last-to-first
    const sorted = [...teams].sort((a, b) => b.rank - a.rank)
    return sorted
  }, [teams, revealPhase])

  const podium = teams.slice(0, 3)
  const progressPct =
    state && state.progress.total > 0
      ? Math.round((state.progress.submitted / state.progress.total) * 100)
      : 0

  const waiting = !state || (state.progress.total === 0 && (state.progress.lobbyNames?.length || 0) === 0)
  const lobbyOnly =
    state && state.progress.total === 0 && (state.progress.lobbyNames?.length || 0) > 0 && revealed === 0

  return (
    <div className="live-root" onClick={unlockSound}>
      <MatrixRain />
      <div className="live-stage">
        <header className="live-header">
          <div className="live-brand">
            {logoOk ? (
              <img
                src={logoSrc}
                alt="MatriX"
                onError={() => {
                  if (logoSrc.endsWith('.png')) {
                    setLogoSrc('/matrix-logo.jfif')
                    return
                  }
                  setLogoOk(false)
                }}
              />
            ) : (
              <div className="live-wordmark">
                Matri<span>X</span>
              </div>
            )}
          </div>
          <div className="live-titles">
            <h1>
              <span className="live-live-dot">
                <i /> LIVE
              </span>
              MatriX Simulation: Live Rounds Result
            </h1>
            <p>Every decision counts. Every round shifts the board.</p>
          </div>
          <div className="live-controls">
            <span className="live-chip live-status-chip">{state?.event.statusLabel || 'Connecting…'}</span>
            <button type="button" className="live-btn" onClick={toggleFullscreen}>
              Fullscreen
            </button>
            <button
              type="button"
              className="live-btn"
              onClick={() => {
                setSoundReady(true)
                setMuted((m) => !m)
              }}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </header>

        {!waiting && !lobbyOnly && revealed > 0 && (
          <div className="live-podium">
            {[1, 0, 2].map((idx) => {
              const t = podium[idx]
              const place = idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'
              const label = idx === 0 ? '1ST' : idx === 1 ? '2ND' : '3RD'
              if (!t) {
                return <div key={place} className={`live-podium-card ${place}`} />
              }
              return (
                <motion.div layout key={t.companyName} className={`live-podium-card ${place}`}>
                  {idx === 0 && <div className="crown">👑</div>}
                  <div className="place">{label}</div>
                  <div className="name">{t.companyName}</div>
                  <div className={`profit ${profitClass(t.totalProfit)}`}>{formatProfit(t.totalProfit)} M</div>
                </motion.div>
              )
            })}
          </div>
        )}

        <div className="live-main">
          <div className={`live-board${scroll ? ' scrollable' : ''}`}>
            {!waiting && !lobbyOnly && (
              <LayoutGroup>
                <table className="live-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Company</th>
                      {Array.from({ length: numRounds }, (_, i) => (
                        <th key={i}>R{i + 1}</th>
                      ))}
                      <th>Total</th>
                      <th>±</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {(revealPhase === 'filling' ? displayTeams : teams).map((t, rowIdx) => {
                        const fromBottomIndex =
                          revealPhase === 'filling'
                            ? displayTeams.length - 1 - rowIdx
                            : 0
                        const revealCell =
                          revealPhase !== 'filling' || fromBottomIndex < visibleFromBottom
                        const delta = rankDelta(t)
                        return (
                          <motion.tr
                            layout
                            key={t.companyName}
                            className={t.rank === 1 ? 'rank-1' : ''}
                            initial={false}
                            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                          >
                            <td className="mono">#{t.rank}</td>
                            <td className="company">{t.companyName}</td>
                            {Array.from({ length: numRounds }, (_, i) => {
                              const round = i + 1
                              const v = t.roundProfits[i]
                              const show =
                                round <= revealed ||
                                (revealPhase === 'filling' &&
                                  round === state?.event.revealedRound &&
                                  revealCell)
                              return (
                                <td key={i} className={`mono ${show ? profitClass(v) : 'dim'}`}>
                                  {show && typeof v === 'number' ? (
                                    <CountUp value={v} active={revealPhase === 'filling' && revealCell} />
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              )
                            })}
                            <td className={`mono total-col ${profitClass(t.totalProfit)}`}>
                              {revealed > 0 ? formatProfit(t.totalProfit) : '—'}
                              {state?.event.budgetMode === 'B' && t.poolM != null && revealed > 0 && (
                                <span className="pool-line">Pool ${t.poolM.toFixed(2)} M</span>
                              )}
                            </td>
                            <td className={`mono ${delta.cls}`}>{revealed > 0 ? delta.text : '–'}</td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </LayoutGroup>
            )}
          </div>

          <aside className="live-side">
            {(
              [
                ['Biggest mover', state?.highlights.biggestMover],
                ['Biggest drop', state?.highlights.biggestDrop],
                ['Best round', state?.highlights.bestRound],
                ['Worst round', state?.highlights.worstRound],
              ] as const
            ).map(([label, h]) => (
              <motion.div
                key={label}
                className="live-side-card"
                initial={reduce ? false : { x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <h4>{label}</h4>
                {h ? (
                  <>
                    <strong>{h.companyName}</strong>
                    <span>
                      {h.delta != null
                        ? h.delta > 0
                          ? `▲${h.delta}`
                          : `▼${Math.abs(h.delta)}`
                        : h.profit != null
                          ? formatProfit(h.profit)
                          : '—'}
                    </span>
                  </>
                ) : (
                  <strong style={{ opacity: 0.4 }}>—</strong>
                )}
              </motion.div>
            ))}
          </aside>
        </div>

        <footer className="live-footer">
          <div className="live-progress-label">
            <span>
              Round {state?.progress.round ?? '—'} · {state?.progress.submitted ?? 0} /{' '}
              {state?.progress.total ?? 0} teams submitted
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="live-progress-track">
            <div className="live-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {state?.event.showTicker && (
            <div className="live-ticker">
              <AnimatePresence>
                {(state.progress.recentSubmitters || []).map((name) => (
                  <motion.span
                    key={name}
                    className="live-ticker-item"
                    initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    ✓ {name}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          )}
          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>}
        </footer>
      </div>

      {waiting && (
        <div className="live-waiting">
          <h2>Waiting for teams…</h2>
          <p>MatriX Arena will light up as soon as companies join.</p>
        </div>
      )}

      {lobbyOnly && (
        <div className="live-lobby">
          <h2>{state!.progress.lobbyNames.length} teams ready</h2>
          <p>Names pop in as teams join. Round results appear after reveal.</p>
          <div className="live-lobby-chips">
            <AnimatePresence>
              {state!.progress.lobbyNames.map((n) => (
                <motion.span
                  key={n}
                  initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  {n}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {revealPhase === 'countdown' && (
        <div className="live-overlay">
          <div>
            <h2>ROUND {state?.event.revealedRound} RESULTS</h2>
            <div className="count">{countdown > 0 ? countdown : 'GO'}</div>
          </div>
        </div>
      )}

      {showChampion && teams[0] && (
        <div className="live-champion">
          <div className="live-champion-card">
            <h2>CHAMPION</h2>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>👑</div>
            <div style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800 }}>
              {teams[0].companyName}
            </div>
            <div className={`mono ${profitClass(teams[0].totalProfit)}`} style={{ fontSize: '1.6rem' }}>
              {formatProfit(teams[0].totalProfit)} M
            </div>
            <button type="button" className="live-btn" style={{ marginTop: '1rem' }} onClick={() => setShowChampion(false)}>
              Back to board
            </button>
          </div>
        </div>
      )}

      {!soundReady && (
        <div className="live-sound-tip">Click anywhere once to enable sound</div>
      )}
    </div>
  )
}
