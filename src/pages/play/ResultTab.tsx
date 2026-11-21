import type { RunView } from '../../api'

function money(n: number) {
  return `$${n.toFixed(2)} M`
}

function niceMax(raw: number) {
  if (raw <= 0) return 5
  const padded = raw * 1.15
  const mag = 10 ** Math.floor(Math.log10(padded))
  const norm = padded / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

function buildTicks(minV: number, maxV: number, count = 6) {
  const span = maxV - minV || 1
  const step = span / (count - 1)
  return Array.from({ length: count }, (_, i) => minV + step * i)
}

function LineChart({
  title,
  series,
  xMax,
  yMin,
  yMax,
}: {
  title: string
  series: { x: number; y: number }[]
  xMax: number
  yMin: number
  yMax: number
}) {
  const w = 520
  const h = 260
  const pad = { top: 28, right: 18, bottom: 42, left: 52 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const yTicks = buildTicks(yMin, yMax, 6)
  const xTicks = Array.from({ length: xMax + 1 }, (_, i) => i)

  const xAt = (x: number) => pad.left + (x / Math.max(1, xMax)) * innerW
  const yAt = (y: number) => pad.top + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH

  const drawn = series.filter((p) => p.x <= xMax)
  const path = drawn
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(p.x).toFixed(1)} ${yAt(p.y).toFixed(1)}`)
    .join(' ')

  const formatY = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 10) return `${v.toFixed(0)}`
    if (abs >= 1) return `${v.toFixed(1)}`
    return `${v.toFixed(2)}`
  }

  return (
    <div className="profit-chart-card">
      <h4 className="profit-chart-title">{title}</h4>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={title}>
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="rgba(15,23,42,0.08)"
              strokeWidth="1"
            />
            <text x={pad.left - 8} y={yAt(t) + 4} textAnchor="end" className="cum-chart-axis">
              {formatY(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x-${t}`}>
            <line
              x1={xAt(t)}
              x2={xAt(t)}
              y1={pad.top}
              y2={h - pad.bottom}
              stroke="rgba(15,23,42,0.05)"
              strokeWidth="1"
            />
            <text x={xAt(t)} y={h - 14} textAnchor="middle" className="cum-chart-label">
              {t}
            </text>
          </g>
        ))}
        <line
          x1={pad.left}
          x2={w - pad.right}
          y1={yAt(0)}
          y2={yAt(0)}
          stroke="rgba(15,23,42,0.35)"
          strokeWidth="1.25"
        />
        <line
          x1={pad.left}
          x2={pad.left}
          y1={pad.top}
          y2={h - pad.bottom}
          stroke="rgba(15,23,42,0.35)"
          strokeWidth="1.25"
        />
        {path && (
          <path d={path} fill="none" stroke="#e30613" strokeWidth="2.25" strokeLinejoin="round" />
        )}
        {drawn.map((p) => (
          <circle key={p.x} cx={xAt(p.x)} cy={yAt(p.y)} r="3.5" fill="#e30613" />
        ))}
        <text x={10} y={16} className="cum-chart-axis">
          $M
        </text>
        <text x={w / 2} y={h - 2} textAnchor="middle" className="cum-chart-axis">
          Round
        </text>
      </svg>
    </div>
  )
}

function ProfitCharts({
  history,
  numRounds,
}: {
  history: RunView['history']
  numRounds: number
}) {
  const sorted = history.slice().sort((a, b) => a.round - b.round)
  const annual: { x: number; y: number }[] = [{ x: 0, y: 0 }]
  const cumulative: { x: number; y: number }[] = [{ x: 0, y: 0 }]

  for (const h of sorted) {
    annual.push({ x: h.round, y: h.profitM })
    cumulative.push({ x: h.round, y: h.cumulativeProfitM })
  }

  const allY = [...annual, ...cumulative].map((p) => p.y)
  const dataMin = Math.min(0, ...allY)
  const dataMax = Math.max(0, ...allY)
  const yMax = niceMax(Math.max(Math.abs(dataMax), Math.abs(dataMin), 1))
  const yMin = dataMin < 0 ? -niceMax(Math.abs(dataMin)) : 0

  return (
    <div className="profit-charts">
      <LineChart
        title="Profit this round ($M)"
        series={annual}
        xMax={numRounds}
        yMin={yMin}
        yMax={yMax}
      />
      <LineChart
        title="Cumulative profit ($M)"
        series={cumulative}
        xMax={numRounds}
        yMin={yMin}
        yMax={yMax}
      />
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

      <h3 className="section-label">Round &amp; cumulative profit</h3>
      <p className="page-help">Starts at Round 0 ($0). Updates after every locked round.</p>
      <ProfitCharts history={run.history} numRounds={run.numRounds} />

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
