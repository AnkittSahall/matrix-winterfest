import { useEffect, useState } from 'react'
import { api, type Country, type EntryMode } from '../../api'

export function CountryInfoTab({ onStart }: { onStart?: () => void }) {
  const [countries, setCountries] = useState<Country[]>([])
  const [home, setHome] = useState<Record<string, unknown> | null>(null)
  const [modes, setModes] = useState<EntryMode[]>([])

  useEffect(() => {
    void Promise.all([api.countries(), api.entryModes()]).then(([c, m]) => {
      setCountries(c.countries)
      setHome(c.home)
      setModes(m)
    })
  }, [])

  return (
    <div>
      <h2 className="page-title">Country Info</h2>
      <p className="page-help">
        Study the markets and entry modes. Your return depends on how well your choices fit each
        round&apos;s news — not on a published formula.
      </p>

      <div className="help-box">
        <h3>What to do</h3>
        <ol>
          <li>Read the three entry modes and what they cost / mean.</li>
          <li>Scan country risk and GDP tables.</li>
          <li>Press <strong>Start</strong> when ready for Round 1 news.</li>
        </ol>
      </div>

      {onStart && (
        <div className="actions-row">
          <button className="btn btn-primary" onClick={onStart}>
            Start Round 1
          </button>
        </div>
      )}

      <h3 className="section-label">Entry modes</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mode</th>
              <th>Outlets</th>
              <th>Entry cost</th>
              <th>Outlet cost (to you)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {modes.map((m) => (
              <tr key={m.code}>
                <td>
                  <strong>{m.name}</strong>
                </td>
                <td>{m.outletsOnEntry}</td>
                <td className="mono">${m.entryCostUsd.toLocaleString()}</td>
                <td className="mono">${m.outletCostToYouUsd.toLocaleString()}</td>
                <td style={{ color: 'var(--muted)' }}>
                  {m.revenueModel}
                  {m.notes ? ` · ${m.notes}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="section-label">Country attributes</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>Risk</th>
              <th>Trade barriers</th>
              <th>Rivalry</th>
              <th>Cultural distance</th>
              <th>Indulgence</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.code}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>
                  <span className={`level ${c.countryRisk}`}>{c.countryRisk}</span>
                </td>
                <td>
                  <span className={`level ${c.tradeBarriers || 'NA'}`}>
                    {c.tradeBarriers || 'NA'}
                  </span>
                </td>
                <td>
                  <span className={`level ${c.industryRivalry}`}>{c.industryRivalry}</span>
                </td>
                <td>
                  <span className={`level ${c.culturalDistance || 'NA'}`}>
                    {c.culturalDistance || 'NA'}
                  </span>
                </td>
                <td>
                  <span className={`level ${c.indulgence}`}>{c.indulgence}</span>
                </td>
              </tr>
            ))}
            {home && (
              <tr>
                <td>
                  <strong>USA (Home)</strong>
                </td>
                <td>
                  <span className="level Low">{String(home.countryRisk)}</span>
                </td>
                <td>
                  <span className="level NA">NA</span>
                </td>
                <td>
                  <span className={`level ${String(home.industryRivalry)}`}>
                    {String(home.industryRivalry)}
                  </span>
                </td>
                <td>
                  <span className="level NA">NA</span>
                </td>
                <td>
                  <span className={`level ${String(home.indulgence)}`}>
                    {String(home.indulgence)}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="section-label">GDP and growth</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>GDP per capita</th>
              <th>GDP growth</th>
              <th>Population growth</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.code}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td className="mono">${c.gdpPerCapita.toLocaleString()}</td>
                <td className="mono">{c.gdpGrowthPct.toFixed(1)}%</td>
                <td className="mono">{c.popGrowthPct.toFixed(2)}%</td>
              </tr>
            ))}
            {home && (
              <tr>
                <td>
                  <strong>USA (Home)</strong>
                </td>
                <td className="mono">${Number(home.gdpPerCapita).toLocaleString()}</td>
                <td className="mono">{Number(home.gdpGrowthPct).toFixed(1)}%</td>
                <td className="mono">{Number(home.popGrowthPct).toFixed(2)}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="page-help" style={{ marginTop: 8 }}>
        This information is for reference. Your return depends on how well your choices fit each
        round&apos;s news.
      </p>
    </div>
  )
}
