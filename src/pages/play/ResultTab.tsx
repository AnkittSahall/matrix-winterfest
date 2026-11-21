import { useEffect, useMemo, useState } from 'react'
import { api, type RunView } from '../../api'

function money(n: number) {
  return `$${n.toFixed(2)} M`
}

function moneyCell(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
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
  const h = 280
  const pad = { top: 24, right: 16, bottom: 44, left: 54 }
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
            <text x={xAt(t)} y={h - 16} textAnchor="middle" className="cum-chart-label">
              {t}
            </text>
          </g>
        ))}
        <line
          x1={pad.left}
          x2={w - pad.right}
          y1={yAt(0)}
          y2={yAt(0)}
          stroke="rgba(15,23,42,0.4)"
          strokeWidth="1.4"
        />
        <line
          x1={pad.left}
          x2={pad.left}
          y1={pad.top}
          y2={h - pad.bottom}
          stroke="rgba(15,23,42,0.4)"
          strokeWidth="1.4"
        />
        {path && (
          <path d={path} fill="none" stroke="#111827" strokeWidth="2" strokeLinejoin="round" />
        )}
        {drawn.map((p) => (
          <circle key={p.x} cx={xAt(p.x)} cy={yAt(p.y)} r="3.2" fill="#111827" />
        ))}
        <text x={12} y={14} className="cum-chart-axis">
          $
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
        title="Profit this round ($)"
        series={annual}
        xMax={numRounds}
        yMin={yMin}
        yMax={yMax}
      />
      <LineChart
        title="Cumulative profit ($)"
        series={cumulative}
        xMax={numRounds}
        yMin={yMin}
        yMax={yMax}
      />
    </div>
  )
}

function ProfitByCountry({
  history,
  numRounds,
  names,
}: {
  history: RunView['history']
  numRounds: number
  names: Record<string, string>
}) {
  const rounds = Array.from({ length: numRounds + 1 }, (_, i) => i)
  const sorted = history.slice().sort((a, b) => a.round - b.round)

  const codes = useMemo(() => {
    const set = new Set<string>()
    for (const h of sorted) {
      for (const c of h.countryProfits || []) set.add(c.countryCode)
      for (const a of h.allocations || []) if (a.modeCode !== 'NONE') set.add(a.countryCode)
    }
    return [...set].sort((a, b) => (names[a] || a).localeCompare(names[b] || b))
  }, [sorted, names])

  const cell = (code: string, round: number) => {
    if (round === 0) return 0
    const h = sorted.find((x) => x.round === round)
    if (!h) return null
    const row = (h.countryProfits || []).find((c) => c.countryCode === code)
    return row ? row.profitM : 0
  }

  const total = (round: number) => {
    if (round === 0) return 0
    const h = sorted.find((x) => x.round === round)
    return h ? h.profitM : null
  }

  if (codes.length === 0) {
    return <div className="empty">No country allocations yet.</div>
  }

  return (
    <div className="table-wrap country-profit-wrap">
      <table>
        <thead>
          <tr>
            <th>Country</th>
            {rounds.map((r) => (
              <th key={r}>{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code}>
              <td>
                <strong>{names[code] || code}</strong>
              </td>
              {rounds.map((r) => {
                const v = cell(code, r)
                return (
                  <td key={r} className="mono">
                    {moneyCell(v)}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="country-profit-total">
            <td>
              <strong>Total Profit</strong>
            </td>
            {rounds.map((r) => {
              const v = total(r)
              return (
                <td key={r} className="mono">
                  <strong>{moneyCell(v)}</strong>
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function ResultTab({ run, onNext }: { run: RunView; onNext: () => void }) {
  const latest = run.history.find((h) => h.round === run.currentRound) || run.history.at(-1)
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    void api.countries().then((c) => {
      const map: Record<string, string> = {}
      for (const co of c.countries) map[co.code] = co.name
      setNames(map)
    })
  }, [])

  if (!latest) return <div className="empty">No result yet.</div>

  const retPct =
    latest.openingPoolM > 0 ? ((latest.profitM / latest.openingPoolM) * 100).toFixed(2) : '0.00'
  const last = run.currentRound >= run.numRounds

  return (
    <div>
      <h2 className="page-title">Round {latest.round} result</h2>
      <p className="page-help">Round summary, charts, and profit by country.</p>

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

      <h3 className="section-label">Round &amp; cumulative profit ($)</h3>
      <p className="page-help">Starts at Round 0 ($0). Axis goes through all rounds.</p>
      <ProfitCharts history={run.history} numRounds={run.numRounds} />

      <h3 className="section-label">Profit by country ($)</h3>
      <p className="page-help">Columns are rounds. Round 0 is the start (all zero).</p>
      <ProfitByCountry history={run.history} numRounds={run.numRounds} names={names} />

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
