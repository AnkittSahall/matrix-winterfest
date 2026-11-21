import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type RunView } from '../api'
import { CountryInfoTab } from './play/CountryInfoTab'
import { NewsTab } from './play/NewsTab'
import { DecisionTab } from './play/DecisionTab'
import { ResultTab } from './play/ResultTab'
import { GlossaryPage } from './GlossaryPage'

type Tab = 'country' | 'news' | 'decision' | 'result' | 'glossary'

function money(n: number) {
  return `$${n.toFixed(2)} M`
}

function useCountdown(deadline: string | null, enabled: boolean) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled || !deadline) {
      setLeft(null)
      return
    }
    const tick = () => {
      const ms = new Date(deadline).getTime() - Date.now()
      setLeft(Math.max(0, Math.ceil(ms / 1000)))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline, enabled])
  return left
}

export function Play() {
  const { runId = '' } = useParams()
  const [run, setRun] = useState<RunView | null>(null)
  const [tab, setTab] = useState<Tab>('country')
  const [error, setError] = useState('')
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertBusy, setAlertBusy] = useState(false)
  const [startBusy, setStartBusy] = useState(false)
  const alertedDeadline = useRef<string | null>(null)
  const dismissingAlert = useRef(false)

  const refresh = useCallback(async () => {
    const r = await api.getRun(runId)
    setRun(r)
    return r
  }, [runId])

  useEffect(() => {
    refresh().catch((e) => setError(e.message))
  }, [refresh])

  useEffect(() => {
    if (!run) return
    if (run.status === 'BRIEFING') setTab('country')
    else if (run.phase === 'NEWS') setTab('news')
    else if (run.phase === 'DECISION') setTab('decision')
    else if (run.phase === 'RESULT') setTab('result')
  }, [run?.status, run?.phase, run?.currentRound])

  // Drop stale popup when a new round / deadline starts
  useEffect(() => {
    setAlertOpen(false)
    dismissingAlert.current = false
  }, [run?.currentRound, run?.roundDeadlineAt])

  const seconds = useCountdown(run?.roundDeadlineAt ?? null, !!run?.timerEnabled && run.phase !== 'RESULT')

  useEffect(() => {
    if (!run?.timerEnabled || !run.roundDeadlineAt || run.phase === 'RESULT') return
    if (run.alertShown || dismissingAlert.current) return
    if (alertedDeadline.current === run.roundDeadlineAt) return
    const threshold = Math.round((run.alertMinutes || 1) * 60)
    if (seconds == null || seconds <= 0 || seconds > threshold) return
    alertedDeadline.current = run.roundDeadlineAt
    setAlertOpen(true)
  }, [seconds, run])

  useEffect(() => {
    if (seconds !== 0 || !run || run.phase === 'RESULT') return
    // soft refresh to pick up auto-lock
    const t = setTimeout(() => {
      void refresh()
    }, 400)
    return () => clearTimeout(t)
  }, [seconds, run, refresh])

  if (error) {
    return (
      <div className="shell">
        <div className="empty">{error}. Is the API running on port 3001?</div>
        <Link to="/">Back home</Link>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="shell">
        <div className="empty">Loading…</div>
      </div>
    )
  }

  const started = run.status !== 'BRIEFING'
  const lockedHint = 'Press Start to begin Round 1'
  const mm = seconds == null ? null : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const timerRed =
    seconds != null && seconds <= Math.round((run.alertMinutes || 1) * 60)

  const go = (t: Tab) => {
    if (!started && (t === 'news' || t === 'decision' || t === 'result')) return
    if (started && t === 'result' && run.phase !== 'RESULT' && run.phase !== 'DECISION' && run.phase !== 'NEWS') return
    if (t === 'result' && run.phase !== 'RESULT') return
    if (t === 'decision' && run.phase === 'RESULT') {
      setTab('decision')
      return
    }
    setTab(t)
  }

  const start = async () => {
    if (startBusy) return
    setStartBusy(true)
    try {
      const r = await api.start(runId)
      setRun(r)
      setTab('news')
    } finally {
      setStartBusy(false)
    }
  }

  return (
    <div className="shell shell-play">
      <div className="play-sticky-top">
        <header className="sim-header">
          <div className="brand">
            <img src="/matrix-logo.jfif" alt="MatriX" />
            <div className="brand-copy">
              <strong>
                Matri<span>X</span>
              </strong>
              <small>{run.companyName} · Home: USA</small>
            </div>
          </div>
          <div className="status-line">
            <span className="status-chip">
              Budget <b>{money(run.currentPoolM)}</b>
            </span>
            <span className="status-chip">
              Round{' '}
              <b>{started ? `${run.currentRound}/${run.numRounds}` : '—'}</b>
            </span>
            <span className="status-chip">
              Profit <b>{money(run.cumulativeProfitM)}</b>
            </span>
            {mm && (
              <span className={`status-chip${timerRed ? ' status-chip-timer' : ''}`}>
                Time <b>{mm}</b>
              </span>
            )}
            {!started && (
              <button
                className={`btn btn-primary${startBusy ? ' is-busy' : ''}`}
                disabled={startBusy}
                onClick={() => void start()}
              >
                {startBusy ? 'Starting…' : 'Start'}
              </button>
            )}
          </div>
        </header>

        <nav className="tabs" aria-label="Play">
          {(
            [
              ['country', 'Country Info'],
              ['news', 'News'],
              ['decision', 'Decision'],
              ['result', 'Result'],
              ['glossary', 'Glossary'],
            ] as const
          ).map(([id, label]) => {
            const disabled =
              (!started && id !== 'country' && id !== 'glossary') ||
              (id === 'result' && started && run.phase !== 'RESULT')
            return (
              <button
                key={id}
                type="button"
                className={`tab ${tab === id ? 'active' : ''}`}
                disabled={disabled}
                title={disabled && !started ? lockedHint : undefined}
                onClick={() => go(id)}
              >
                {label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="play-body">
        {tab === 'country' && (
          <CountryInfoTab onStart={!started ? () => void start() : undefined} />
        )}
        {tab === 'news' && (
          <NewsTab
            runId={runId}
            round={run.currentRound}
            onGoDecision={async () => {
              const r = await api.toDecision(runId)
              setRun(r)
              setTab('decision')
            }}
          />
        )}
        {tab === 'decision' && (
          <DecisionTab
            run={run}
            readOnly={run.phase === 'RESULT'}
            onLocked={async (r) => {
              setRun(r)
              setTab('result')
            }}
          />
        )}
        {tab === 'result' && run.phase === 'RESULT' && (
          <ResultTab
            run={run}
            onNext={async () => {
              const r = await api.next(runId)
              setRun(r)
              if (r.finished || r.status === 'COMPLETED') {
                window.location.href = `/play/${runId}/final`
                return
              }
              setTab('news')
            }}
          />
        )}
        {tab === 'glossary' && <GlossaryPage />}
      </div>

      {alertOpen && run.timerEnabled && run.phase !== 'RESULT' && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{run.alertMinutes || 1} minute(s) left!</h3>
            <p>
              Start allocating your money now. If time runs out, whatever you have allocated at
              that moment will be submitted automatically.
            </p>
            <div className="footer-actions">
              <button
                className={`btn btn-primary${alertBusy ? ' is-busy' : ''}`}
                disabled={alertBusy}
                onClick={() => {
                  if (alertBusy) return
                  setAlertBusy(true)
                  void (async () => {
                    dismissingAlert.current = true
                    if (run.roundDeadlineAt) alertedDeadline.current = run.roundDeadlineAt
                    setRun((prev) => (prev ? { ...prev, alertShown: true } : prev))
                    void api.alertShown(runId).then(() => refresh())
                    if (tab === 'decision') {
                      setAlertOpen(false)
                      setAlertBusy(false)
                      return
                    }
                    try {
                      if (run.phase === 'NEWS') {
                        const r = await api.toDecision(runId)
                        setRun(r)
                      }
                    } catch {
                      /* still jump to Decision UI */
                    }
                    setTab('decision')
                    setAlertOpen(false)
                    setAlertBusy(false)
                  })()
                }}
              >
                {alertBusy
                  ? 'Opening…'
                  : tab === 'decision'
                    ? 'OK, continue'
                    : 'Go to Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
