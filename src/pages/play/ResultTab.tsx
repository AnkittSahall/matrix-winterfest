import type { RunView } from '../../api'

function money(n: number) {
  return `$${n.toFixed(2)} M`
}

export function ResultTab({ run, onNext }: { run: RunView; onNext: () => void }) {
  const latest = run.history.find((h) => h.round === run.currentRound) || run.history.at(-1)
  if (!latest) return <div className="empty">No result yet.</div>

  const retPct =
    latest.openingPoolM > 0 ? ((latest.profitM / latest.openingPoolM) * 100).toFixed(2) : '0.00'
  const last = run.currentRound >= run.numRounds

  return (
    <div>
      <h2 className="page-title">Round {latest.round} result</h2>
      <p className="page-help">Round totals only — no country-by-country profit is shown.</p>

      <div className="result-card">
        <div className="stats-plain" style={{ border: 'none', margin: 0, padding: 0 }}>
          <span>
            Pool at start: <b>{money(latest.openingPoolM)}</b>
          </span>
          <span>
            Invested: <b>{money(latest.investedM)}</b>
          </span>
          <span>
            Idle cash: <b>{money(latest.idleM)}</b>
          </span>
          <span>
            Profit this round:{' '}
            <b style={{ color: latest.profitM >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {money(latest.profitM)}
            </b>
          </span>
          <span>
            Cumulative profit: <b>{money(latest.cumulativeProfitM)}</b>
          </span>
          <span>
            Return on pool: <b>{retPct}%</b>
          </span>
        </div>
        {latest.autoLocked && (
          <p className="page-help" style={{ marginTop: 12 }}>
            Time ran out. Your allocation at that moment was submitted automatically.
          </p>
        )}
      </div>

      <div className="help-box" style={{ marginTop: 16 }}>
        {run.budgetMode === 'A' ? (
          <p>
            Your budget for the next round is {money(latest.closingPoolM)}. Profit is not
            reinvested.
          </p>
        ) : (
          <p>
            Profit/loss of {money(latest.profitM)} has been added to your pool. Your budget for
            the next round is {money(latest.closingPoolM)}.
          </p>
        )}
      </div>

      <h3 className="section-label">History</h3>
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
        <button className="btn btn-primary btn-lg" onClick={onNext}>
          {last ? 'View Final Result' : `Continue to Round ${run.currentRound + 1}`}
        </button>
      </div>
    </div>
  )
}
