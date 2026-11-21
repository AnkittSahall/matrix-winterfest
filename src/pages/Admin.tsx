import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  type AdminConfig,
  type AdminResultRow,
  type LiveBoardSettings,
} from '../api'

function downloadExcel(results: AdminResultRow[]) {
  const headers = [
    'Rank',
    'Company / Team',
    'Total Profit ($M)',
    'Final Pool ($M)',
    'Rounds',
    'Budget Mode',
    'Start Budget ($M)',
    'Completed At',
    'Run ID',
  ]
  const lines = results.map((r) =>
    [
      r.rank,
      `"${String(r.companyName).replace(/"/g, '""')}"`,
      r.totalProfitM.toFixed(2),
      r.finalPoolM.toFixed(2),
      r.roundsPlayed,
      r.budgetMode,
      r.startBudgetM,
      r.completedAt ? new Date(r.completedAt).toISOString() : '',
      r.runId,
    ].join(','),
  )
  const csv = `\uFEFF${headers.join(',')}\n${lines.join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `MatriX_Results_${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [cfg, setCfg] = useState<AdminConfig | null>(null)
  const [results, setResults] = useState<AdminResultRow[]>([])
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [liveBoard, setLiveBoard] = useState<LiveBoardSettings | null>(null)
  const [liveRounds, setLiveRounds] = useState<
    { round: number; status: string; submitted: number; total: number; revealed: boolean }[]
  >([])

  const loadResults = async () => {
    const data = await api.adminResults()
    setResults(data.results)
  }

  const loadLive = async () => {
    const data = await api.adminLive()
    setLiveBoard(data.board)
    setLiveRounds(data.rounds)
  }

  const load = async () => {
    const c = await api.adminConfig()
    setCfg(c)
    setAuthed(true)
    await loadResults()
    await loadLive().catch(() => undefined)
  }

  useEffect(() => {
    void load().catch(() => setAuthed(false))
  }, [])

  if (!authed || !cfg) {
    return (
      <div className="shell">
        <h2 className="page-title">Facilitator back office</h2>
        <p className="page-help">Not linked from player screens. Enter the admin passcode.</p>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="pass">Passcode</label>
          <input
            id="pass"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void api
                  .adminLogin(pass)
                  .then(load)
                  .catch((err) => setError(err.message))
              }
            }}
          />
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="actions-row">
          <button
            className="btn btn-primary"
            onClick={() =>
              void api
                .adminLogin(pass)
                .then(load)
                .catch((err) => setError(err.message))
            }
          >
            Log in
          </button>
          <Link className="btn btn-secondary" to="/">
            Home
          </Link>
        </div>
      </div>
    )
  }

  const setSeq = (i: number, v: number) => {
    const sequence = [...cfg.sequence]
    sequence[i] = v
    setCfg({ ...cfg, sequence })
  }

  const setRounds = (n: number) => {
    const sequence = Array.from({ length: n }, (_, i) => cfg.sequence[i] || i + 1)
    setCfg({ ...cfg, numRounds: n, sequence })
  }

  const save = async () => {
    setError('')
    try {
      const res = await api.saveAdminConfig({
        numRounds: cfg.numRounds,
        sequence: cfg.sequence,
        startBudgetM: cfg.startBudgetM,
        budgetMode: cfg.budgetMode,
        timerEnabled: cfg.timerEnabled,
        timerMinutes: cfg.timerMinutes,
        alertMinutes: cfg.alertMinutes,
      })
      setCfg({ ...res.config, scenarios: cfg.scenarios })
      setSummary(res.summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <div className="shell">
      <h2 className="page-title">Facilitator back office</h2>
      <p className="page-help">
        Configure the game, watch live team results, and download Excel for announcements.
      </p>

      <h3 className="section-label">Competition control</h3>
      <p className="page-help">
        Teams stay locked on Continue until you activate. Lock anytime to stop new joins.
      </p>
      <div className="banner">
        <strong style={{ color: cfg.lobbyOpen ? 'var(--good)' : 'var(--bad)' }}>
          {cfg.lobbyOpen ? 'OPEN — teams can Continue' : 'LOCKED — waiting to activate'}
        </strong>
      </div>
      <div className="actions-row">
        {cfg.lobbyOpen ? (
          <button
            className="btn btn-secondary"
            onClick={() =>
              void api
                .setLobby(false)
                .then(async () => {
                  setSummary('Locked. New teams cannot Continue.')
                  await load()
                })
                .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Lock
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() =>
              void api
                .setLobby(true)
                .then(async () => {
                  setSummary('Activated. Teams can enter company name and Continue.')
                  await load()
                })
                .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Activate
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (
              !window.confirm(
                'Reset competition? Leaderboard clears for a new heat, and join stays locked until you Activate.',
              )
            ) {
              return
            }
            void api
              .resetCompetition()
              .then(async () => {
                setResults([])
                setSummary('Reset done. Activate when the next heat is ready.')
                await load()
              })
              .catch((e) => setError(e instanceof Error ? e.message : 'Reset failed'))
          }}
        >
          Reset competition
        </button>
      </div>

      <h3 className="section-label">Live Result Screen</h3>
      <p className="page-help">
        Projector leaderboard. Open it, then reveal each round when teams are done. Press F11 for
        fullscreen.
      </p>
      <div className="actions-row">
        <a className="btn btn-primary" href="/live" target="_blank" rel="noreferrer">
          Open Live Screen
        </a>
        <button
          className="btn btn-secondary"
          onClick={() => void loadLive().catch((e) => setError(e.message))}
        >
          Refresh
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (
              !window.confirm(
                'Clear the live leaderboard for this heat? Team runs stay saved.',
              )
            ) {
              return
            }
            void api
              .adminLiveReset()
              .then(async () => {
                setSummary('Live board cleared.')
                await loadLive()
              })
              .catch((e) => setError(e instanceof Error ? e.message : 'Reset failed'))
          }}
        >
          Reset live board
        </button>
      </div>

      {liveBoard && (
        <label
          style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}
        >
          <input
            type="checkbox"
            checked={liveBoard.registrationLocked}
            onChange={(e) =>
              void api
                .adminLiveSettings({ registrationLocked: e.target.checked })
                .then(async (r) => {
                  setLiveBoard(r.board)
                  setSummary(e.target.checked ? 'New teams locked.' : 'New teams unlocked.')
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
            }
          />
          Lock new teams
        </label>
      )}

      <div className="table-wrap" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {liveRounds.map((r) => {
              const canReveal =
                !r.revealed &&
                liveBoard != null &&
                r.round === (liveBoard.revealedRound || 0) + 1
              return (
                <tr key={r.round}>
                  <td>
                    <strong>Round {r.round}</strong>
                  </td>
                  <td>
                    {r.revealed
                      ? 'Revealed'
                      : `${r.submitted} / ${r.total} teams`}
                  </td>
                  <td>
                    {r.revealed ? (
                      <span style={{ color: 'var(--muted)' }}>Done</span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        disabled={!canReveal}
                        onClick={() =>
                          void api
                            .adminLiveReveal(r.round)
                            .then(async () => {
                              setSummary(`Round ${r.round} shown on live board.`)
                              await loadLive()
                            })
                            .catch((e) =>
                              setError(e instanceof Error ? e.message : 'Reveal failed'),
                            )
                        }
                      >
                        Reveal now
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {liveRounds.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: 'var(--muted)' }}>
                  No rounds yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="section-label">Competition results</h3>
      <p className="page-help">
        Teams are ranked by total profit. Refresh after teams finish. Download opens in Excel.
      </p>
      <div className="actions-row">
        <button
          className="btn btn-secondary"
          onClick={() => void loadResults().catch((e) => setError(e.message))}
        >
          Refresh results
        </button>
        <button
          className="btn btn-primary"
          disabled={results.length === 0}
          onClick={() => downloadExcel(results)}
        >
          Download Excel (.csv)
        </button>
      </div>
      {results.length === 0 ? (
        <div className="empty">No completed runs yet. Results appear when a team finishes all rounds.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Company / Team</th>
                <th>Total profit</th>
                <th>Final pool</th>
                <th>Rounds</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.runId}>
                  <td>
                    <strong>#{r.rank}</strong>
                  </td>
                  <td>
                    <strong>{r.companyName}</strong>
                  </td>
                  <td
                    className="mono"
                    style={{ color: r.totalProfitM >= 0 ? 'var(--good)' : 'var(--bad)' }}
                  >
                    ${r.totalProfitM.toFixed(2)} M
                  </td>
                  <td className="mono">${r.finalPoolM.toFixed(2)} M</td>
                  <td>{r.roundsPlayed}</td>
                  <td>
                    {r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="section-label">Game setup</h3>
      <div className="form-row" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Number of rounds</label>
          <select
            value={cfg.numRounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Starting budget ($M)</label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={cfg.startBudgetM}
            onChange={(e) => setCfg({ ...cfg, startBudgetM: Number(e.target.value) })}
          />
        </div>
      </div>

      <h3 className="section-label">Scenario sequence (hidden from players)</h3>
      <div className="list">
        {cfg.sequence.map((s, i) => (
          <div key={i} className="list-item">
            <div>
              <strong>Round {i + 1}</strong>
            </div>
            <select value={s} onChange={(e) => setSeq(i, Number(e.target.value))}>
              {cfg.scenarios.map((sc) => (
                <option key={sc.scenarioId} value={sc.scenarioId}>
                  {sc.scenarioId}: {sc.title}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <h3 className="section-label">Budget mode</h3>
      <label className="mode-choice" style={{ marginBottom: 8 }}>
        <input
          type="radio"
          checked={cfg.budgetMode === 'A'}
          onChange={() => setCfg({ ...cfg, budgetMode: 'A' })}
        />
        <div>
          <h4>A — Without P&amp;L integrated</h4>
          <p>Every round’s pool is the starting budget.</p>
        </div>
      </label>
      <label className="mode-choice">
        <input
          type="radio"
          checked={cfg.budgetMode === 'B'}
          onChange={() => setCfg({ ...cfg, budgetMode: 'B' })}
        />
        <div>
          <h4>B — With P&amp;L integrated</h4>
          <p>Profit/loss changes the next round’s pool.</p>
        </div>
      </label>

      <h3 className="section-label">Timer</h3>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={cfg.timerEnabled}
          onChange={(e) => setCfg({ ...cfg, timerEnabled: e.target.checked })}
        />
        Enable round timer
      </label>
      {cfg.timerEnabled && (
        <div className="form-row">
          <div className="field">
            <label>Minutes per round</label>
            <input
              type="number"
              min={1}
              max={60}
              value={cfg.timerMinutes}
              onChange={(e) => setCfg({ ...cfg, timerMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Alert minutes (red + popup)</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={cfg.alertMinutes}
              onChange={(e) => setCfg({ ...cfg, alertMinutes: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
      {summary && (
        <div className="banner">
          <p>{summary}</p>
        </div>
      )}

      <div className="footer-actions">
        <Link className="btn btn-secondary" to="/">
          Home
        </Link>
        <button className="btn btn-primary" onClick={() => void save()}>
          Save setup
        </button>
      </div>
    </div>
  )
}
