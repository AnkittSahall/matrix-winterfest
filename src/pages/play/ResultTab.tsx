import type { RunView } from '../../api'

function money(n: number) {
  return `$${n.toFixed(2)} M`
}

function CumulativeChart({ history }: { history: RunView['history'] }) {
  const points = history
    .slice()
    .sort((a, b) => a.round - b.round)
    .map((h) => ({ round: h.round, value: h.cumulativeProfitM }))

  if (points.length === 0) return null

  const w = 560
  const h = 200
  const pad = { top: 20, right: 16, bottom: 36, left: 48 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const vals = points.map((p) => p.value)
  const minV = Math.min(0, ...vals)
  const maxV = Math.max(0, ...vals)
  const span = maxV - minV || 1

  const xAt = (i: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const yAt = (v: number) => pad.top + innerH - ((v - minV) / span) * innerH

  const zeroY = yAt(0)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.value)}`).join(' ')
  const area =
    points.length > 0
      ? `${line} L ${xAt(points.length - 1)} ${zeroY} L ${xAt(0)} ${zeroY} Z`
      : ''

  return (
    <div className="cum-chart" aria-label="Cumulative profit by round">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img">
        <line
          x1={pad.left}
          x2={w - pad.right}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(15,23,42,0.18)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <path d={area} fill="rgba(227,6,19,0.10)" />
        <path d={line} fill="none" stroke="#e30613" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.round}>
            <circle cx={xAt(i)} cy={yAt(p.value)} r="4.5" fill="#e30613" />
            <text
              x={xAt(i)}
              y={yAt(p.value) - 10}
              textAnchor="middle"
              className="cum-chart-value"
            >
              {p.value >= 0 ? '+' : ''}
              {p.value.toFixed(1)}
            </text>
            <text x={xAt(i)} y={h - 12} textAnchor="middle" className="cum-chart-label">
              R{p.round}
            </text>
          </g>
        ))}
        <text x={8} y={pad.top + 4} className="cum-chart-axis">
          $M
        </text>
      </svg>
    </div>
  )
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

      <h3 className="section-label">Cumulative profit</h3>
      <p className="page-help">Updates after every locked round.</p>
      <CumulativeChart history={run.history} />

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
