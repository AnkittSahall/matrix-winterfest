import { useEffect, useMemo, useState } from 'react'
import { api, type AllocationRow, type Country, type RunView } from '../../api'

const MODES = [
  { code: 'NONE', label: 'None' },
  { code: 'FRANCHISING', label: 'Franchising (25 outlets)' },
  { code: 'JOINT_VENTURE', label: 'Joint Venture (5 outlets)' },
  { code: 'WHOLLY_OWNED', label: 'Wholly Owned (5 outlets)' },
]

export function DecisionTab({
  run,
  readOnly,
  onLocked,
}: {
  run: RunView
  readOnly: boolean
  onLocked: (r: RunView) => void
}) {
  const [countries, setCountries] = useState<Country[]>([])
  const [rows, setRows] = useState<AllocationRow[]>([])
  const [amountText, setAmountText] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([api.countries(), api.getDraft(run.runId)]).then(([c, d]) => {
      setCountries(c.countries)
      const map = new Map(d.allocations.map((a) => [a.countryCode, a]))
      setRows(
        c.countries.map((co) => {
          const a = map.get(co.code)
          return {
            countryCode: co.code,
            modeCode: a?.modeCode || 'NONE',
            amountM: a?.amountM || 0,
          }
        }),
      )
      setAmountText({})
    })
  }, [run.runId, run.currentRound])

  // autosave debounced
  useEffect(() => {
    if (readOnly || rows.length === 0) return
    const t = setTimeout(() => {
      void api.saveDraft(run.runId, rows).catch(() => undefined)
    }, 500)
    return () => clearTimeout(t)
  }, [rows, run.runId, readOnly])

  const allocated = useMemo(
    () =>
      rows.reduce(
        (s, r) => s + (r.modeCode !== 'NONE' && r.amountM > 0 ? Number(r.amountM) : 0),
        0,
      ),
    [rows],
  )
  const idle = run.currentPoolM - allocated
  const over = idle < -1e-9
  const rowErrors = rows.some(
    (r) => r.modeCode !== 'NONE' && (!(r.amountM > 0) || Number.isNaN(r.amountM)),
  )
  const canLock = !readOnly && !over && !rowErrors

  const prev = run.history.find((h) => h.round === run.currentRound - 1)

  const changeLabel = (code: string) => {
    if (run.currentRound <= 1) {
      const row = rows.find((r) => r.countryCode === code)
      return row && row.modeCode !== 'NONE' ? 'New entry' : ''
    }
    const before = prev?.allocations?.find((a) => a.countryCode === code)
    const now = rows.find((r) => r.countryCode === code)
    const nowOn = now && now.modeCode !== 'NONE' && now.amountM > 0
    const beforeOn = before && before.amountM > 0
    if (!beforeOn && nowOn) return 'New entry'
    if (beforeOn && !nowOn) return 'Exited'
    if (beforeOn && nowOn) {
      if (before!.modeCode !== now!.modeCode) return 'Switched mode'
      if (now!.amountM > before!.amountM) return 'Increased'
      if (now!.amountM < before!.amountM) return 'Decreased'
      return 'Unchanged'
    }
    return ''
  }

  const update = (code: string, patch: Partial<AllocationRow>) => {
    setRows((prevRows) =>
      prevRows.map((r) => {
        if (r.countryCode !== code) return r
        const next = { ...r, ...patch }
        if (next.modeCode === 'NONE') next.amountM = 0
        return next
      }),
    )
    if (patch.modeCode === 'NONE') {
      setAmountText((t) => {
        const n = { ...t }
        delete n[code]
        return n
      })
    }
  }

  const amountDisplay = (code: string, amountM: number, modeCode: string) => {
    if (modeCode === 'NONE') return ''
    if (amountText[code] !== undefined) return amountText[code]
    if (amountM === 0) return ''
    return String(amountM)
  }

  const onAmountChange = (code: string, raw: string) => {
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
    setAmountText((t) => ({ ...t, [code]: raw }))
    if (raw === '' || raw === '.') {
      update(code, { amountM: 0 })
      return
    }
    const n = Number(raw)
    if (!Number.isNaN(n) && n >= 0) update(code, { amountM: n })
  }

  const lock = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await api.lock(run.runId, rows)
      setConfirm(false)
      onLocked(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lock failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="page-title">Round {run.currentRound} decisions</h2>
      <p className="page-help">
        Pick one entry mode per country and how many $ million to put there. You can leave money
        as idle cash.
      </p>

      <div className="stats-plain">
        <span>
          Pool this round: <b>${run.currentPoolM.toFixed(2)} M</b>
        </span>
        <span>
          Allocated: <b>${allocated.toFixed(2)} M</b>
        </span>
        <span className={over ? 'timer-red' : ''}>
          Idle cash: <b>${idle.toFixed(2)} M</b>
          {over ? ' — You have allocated more than your pool' : ''}
        </span>
      </div>

      {run.timerEnabled && !readOnly && (
        <p className="page-help">
          If the timer runs out, your current allocation is submitted automatically.
        </p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>Entry mode</th>
              <th>Amount ($M)</th>
              <th>Change vs last round</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => {
              const row = rows.find((r) => r.countryCode === c.code) || {
                countryCode: c.code,
                modeCode: 'NONE',
                amountM: 0,
              }
              return (
                <tr key={c.code}>
                  <td>
                    <strong>{c.name}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                      Risk {c.countryRisk} · Culture {c.culturalDistance || '—'}
                    </div>
                  </td>
                  <td>
                    <select
                      disabled={readOnly}
                      value={row.modeCode}
                      onChange={(e) => update(c.code, { modeCode: e.target.value })}
                    >
                      {MODES.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={readOnly || row.modeCode === 'NONE'}
                      placeholder="0"
                      value={amountDisplay(c.code, row.amountM, row.modeCode)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => onAmountChange(c.code, e.target.value)}
                      onBlur={() =>
                        setAmountText((t) => {
                          const n = { ...t }
                          delete n[c.code]
                          return n
                        })
                      }
                      style={{ width: 110 }}
                    />
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{changeLabel(c.code)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="field-error">{error}</p>}

      {!readOnly && (
        <div className="footer-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setAmountText({})
              setRows((rs) => rs.map((r) => ({ ...r, modeCode: 'NONE', amountM: 0 })))
            }}
          >
            Clear all
          </button>
          {run.currentRound > 1 && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                const prevAlloc = prev?.allocations || []
                setAmountText({})
                setRows(
                  countries.map((c) => {
                    const a = prevAlloc.find((x) => x.countryCode === c.code)
                    return {
                      countryCode: c.code,
                      modeCode: a?.modeCode || 'NONE',
                      amountM: a?.amountM || 0,
                    }
                  }),
                )
              }}
            >
              Reset to last round
            </button>
          )}
          <button
            className="btn btn-primary"
            disabled={!canLock || busy}
            onClick={() => setConfirm(true)}
          >
            Lock Round {run.currentRound}
          </button>
        </div>
      )}

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Lock Round {run.currentRound}?</h3>
            <p>
              Allocated ${allocated.toFixed(2)} M, idle cash ${idle.toFixed(2)} M. You cannot
              change this after locking.
            </p>
            {allocated === 0 && (
              <p>
                <strong>You are holding 100% in cash. Profit this round will be $0.</strong>
              </p>
            )}
            <div className="footer-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void lock()}>
                Confirm lock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
