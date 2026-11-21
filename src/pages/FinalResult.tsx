import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type RunView } from '../api'

function money(n: number) {
  return `$${n.toFixed(2)} M`
}

export function FinalResult() {
  const { runId = '' } = useParams()
  const [run, setRun] = useState<RunView | null>(null)

  useEffect(() => {
    void api.getRun(runId).then(setRun)
  }, [runId])

  if (!run) {
    return (
      <div className="shell">
        <div className="empty">Loading…</div>
      </div>
    )
  }

  const growth =
    run.startBudgetM > 0
      ? (((run.currentPoolM - run.startBudgetM) / run.startBudgetM) * 100).toFixed(1)
      : '0'

  return (
    <div className="shell">
      <header className="sim-header">
        <div className="brand">
          <img src="/matrix-logo.jfif" alt="MatriX" />
          <div className="brand-copy">
            <strong>
              Matri<span>X</span>
            </strong>
            <small>Final result</small>
          </div>
        </div>
      </header>

      <h2 className="page-title">{run.companyName}</h2>
      <p className="final-profit">
        Total profit{' '}
        <span style={{ color: run.cumulativeProfitM >= 0 ? 'var(--good)' : 'var(--bad)' }}>
          {money(run.cumulativeProfitM)}
        </span>
      </p>
      {run.budgetMode === 'B' && (
        <p className="page-help">
          Final pool {money(run.currentPoolM)} ({growth}% vs starting budget).
        </p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Pool</th>
              <th>Invested</th>
              <th>Idle</th>
              <th>Profit</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {run.history.map((h) => (
              <tr key={h.round}>
                <td>
                  <strong>{h.round}</strong>
                </td>
                <td className="mono">{money(h.openingPoolM)}</td>
                <td className="mono">{money(h.investedM)}</td>
                <td className="mono">{money(h.idleM)}</td>
                <td
                  className="mono"
                  style={{ color: h.profitM >= 0 ? 'var(--good)' : 'var(--bad)' }}
                >
                  {money(h.profitM)}
                </td>
                <td className="mono">{money(h.cumulativeProfitM)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="footer-actions">
        <Link className="btn btn-secondary" to="/">
          Go to Home
        </Link>
        <button
          className="btn btn-primary"
          onClick={async () => {
            const r = await api.createRun(run.companyName)
            window.location.href = `/play/${r.runId}`
          }}
        >
          Play again
        </button>
      </div>
    </div>
  )
}
