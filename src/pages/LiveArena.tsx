import { useEffect, useState } from 'react'
import type { LiveState, LiveTeam } from './live/types'
import './live/live-arena.css'

const TOP_N = 6

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

export function LiveArena() {
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState('')
  const [logoOk, setLogoOk] = useState(true)
  const [logoSrc, setLogoSrc] = useState('/matrix-logo.png')

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/live/state')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed')
        if (alive) {
          setState(data)
          setError('')
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Offline')
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen()
    else void document.exitFullscreen()
  }

  const teams = state?.teams || []
  const topTeams = teams.slice(0, TOP_N)
  const numRounds = state?.event.numRounds || 3
  const revealed = state?.event.revealedRound || 0
  const podium = topTeams.slice(0, 3)
  const lobbyNames = state?.progress.lobbyNames || []
  const progressPct =
    state && state.progress.total > 0
      ? Math.round((state.progress.submitted / state.progress.total) * 100)
      : 0

  const noTeams = !state || lobbyNames.length === 0
  const preReveal = !!state && revealed === 0 && lobbyNames.length > 0
  const showBoard = !!state && revealed > 0 && topTeams.length > 0

  return (
    <div className="live-root">
      <div className="live-stage live-stage-top6">
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
            <span className="live-chip live-status-chip">
              {state?.event.statusLabel || 'Connecting…'}
            </span>
            <button type="button" className="live-btn" onClick={toggleFullscreen}>
              Fullscreen
            </button>
          </div>
        </header>

        {showBoard && (
          <div className="live-podium live-podium-compact">
            {[1, 0, 2].map((idx) => {
              const t = podium[idx]
              const place = idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'
              const label = idx === 0 ? '1ST' : idx === 1 ? '2ND' : '3RD'
              if (!t) return <div key={place} className={`live-podium-card ${place}`} />
              return (
                <div key={`${t.id}-${place}`} className={`live-podium-card ${place}`}>
                  {idx === 0 && <div className="crown">★</div>}
                  <div className="place">{label}</div>
                  <div className="name">{t.companyName}</div>
                  <div className={`profit ${profitClass(t.totalProfit)}`}>
                    {formatProfit(t.totalProfit)} M
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="live-main live-main-simple">
          <div className="live-board live-board-top6">
            {noTeams && (
              <div className="live-empty-panel">
                <h2>Waiting for teams…</h2>
                <p>Team names appear as they join.</p>
              </div>
            )}

            {preReveal && (
              <div className="live-empty-panel">
                <h2>{lobbyNames.length} teams ready</h2>
                <p>Ranks show after Round 1 is revealed.</p>
                <div className="live-lobby-chips">
                  {lobbyNames.map((n, i) => (
                    <span key={`${n}-${i}`}>{n}</span>
                  ))}
                </div>
              </div>
            )}

            {showBoard && (
              <table className="live-table live-table-top6">
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
                  {topTeams.map((t) => {
                    const delta = rankDelta(t)
                    return (
                      <tr key={t.id || t.companyName} className={t.rank === 1 ? 'rank-1' : ''}>
                        <td className="mono">#{t.rank}</td>
                        <td className="company">{t.companyName}</td>
                        {Array.from({ length: numRounds }, (_, i) => {
                          const show = i + 1 <= revealed
                          const v = t.roundProfits[i]
                          return (
                            <td key={i} className={`mono ${show ? profitClass(v) : 'dim'}`}>
                              {show ? formatProfit(v) : '—'}
                            </td>
                          )
                        })}
                        <td className={`mono total-col ${profitClass(t.totalProfit)}`}>
                          {formatProfit(t.totalProfit)}
                          {state?.event.budgetMode === 'B' && t.poolM != null && (
                            <span className="pool-line">Pool ${t.poolM.toFixed(2)} M</span>
                          )}
                        </td>
                        <td className={`mono ${delta.cls}`}>{delta.text}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <footer className="live-footer">
          <div className="live-progress-label">
            <span>
              Round {state?.progress.round ?? '—'} · {state?.progress.submitted ?? 0} /{' '}
              {state?.progress.total ?? 0} teams submitted
              {showBoard && teams.length > TOP_N ? ` · Top ${TOP_N}` : ''}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="live-progress-track">
            <div className="live-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>}
        </footer>
      </div>
    </div>
  )
}
