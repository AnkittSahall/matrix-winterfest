import { useEffect, useState } from 'react'
import { api, type Country } from '../../api'

const ENTRY_MODE_ROWS: { parameter: string; franchising: string; jv: string; wo: string }[] = [
  {
    parameter: 'Cost of entry and operation',
    franchising: 'Same in every mode. You decide the amount in $M on the Decision tab.',
    jv: 'Same in every mode. You decide the amount in $M on the Decision tab.',
    wo: 'Same in every mode. You decide the amount in $M on the Decision tab.',
  },
  {
    parameter: 'Outlets opened for every $1 M invested',
    franchising: '20 franchised outlets',
    jv: '8 outlets, 50% share',
    wo: '4 own outlets',
  },
  {
    parameter: 'What your money buys',
    franchising: 'Brand set-up, training and supervision. Franchisees fund the build-out.',
    jv: 'Your 50% share of each outlet, alongside a local partner.',
    wo: 'Full build-out of outlets that you own and run.',
  },
  {
    parameter: 'Share of profit',
    franchising: 'Smallest: you earn fees and royalty only',
    jv: 'Half of the profit',
    wo: 'All of the profit',
  },
  {
    parameter: 'Share of loss and risk',
    franchising: 'Mostly carried by the franchisee',
    jv: 'Shared equally with the partner',
    wo: 'Carried entirely by you',
  },
  {
    parameter: 'Local knowledge',
    franchising: 'Franchisee knows the market, but you cannot steer them closely',
    jv: 'Partner knows the culture, competitors and officials. A reliable partner is hard to find.',
    wo: 'None. You learn the market on your own.',
  },
  {
    parameter: 'Control over brand and operations',
    franchising: 'Low',
    jv: 'Shared',
    wo: 'Full',
  },
  {
    parameter: 'Tends to suit',
    franchising: 'Unstable or hostile markets',
    jv: 'Distant cultures, high trade barriers or strong local competitors',
    wo: 'Stable, familiar markets with few rivals or little cultural distance',
  },
  {
    parameter: 'Watch out for',
    franchising:
      'Capped upside. Requiring franchisees to buy from you hurts under local-sourcing rules.',
    jv: 'Partner disputes and slower decisions',
    wo: 'Currency and political losses, tariffs aimed at foreign brands, blind spots on rivals and culture',
  },
]

const MODE_LINK_ROWS: { attribute: string; whenHigh: string; whenLow: string }[] = [
  {
    attribute: 'Country risk',
    whenHigh:
      'Franchising shields you because the franchisee carries local capital and currency risk. A joint venture shares the risk. Wholly owned carries all of it.',
    whenLow: 'Wholly owned keeps all the profit with little danger.',
  },
  {
    attribute: 'Trade barriers',
    whenHigh:
      'A joint venture partner sources locally and knows the officials. Wholly owned imports and is the easiest target. Franchising suffers if tied to central supply.',
    whenLow: 'Modes differ little, so your share of profit matters most.',
  },
  {
    attribute: 'Industry rivalry',
    whenHigh:
      'A local partner reads competitors. Wholly owned has no local intelligence on rivals.',
    whenLow:
      'Few rivals to watch, so ownership captures the whole market. New competitors can still arrive.',
  },
  {
    attribute: 'Cultural distance',
    whenHigh:
      'A joint venture partner adapts menu, staff and tastes. A franchisee looks local but runs a standard brand. Wholly owned must learn alone.',
    whenLow: 'The brand travels as it is, so full control pays.',
  },
  {
    attribute: 'Indulgence',
    whenHigh: 'A standard full menu travels well and tight control pays.',
    whenLow: 'Menus need adapting, which local partners do faster.',
  },
  {
    attribute: 'GDP growth and population growth',
    whenHigh: 'The more you own, the more of the upside you keep.',
    whenLow:
      'Falling or flat demand leaves heavy ownership holding a shrinking market. Asset-light modes are safer.',
  },
]

export function CountryInfoTab({ onStart }: { onStart?: () => void | Promise<void> }) {
  const [countries, setCountries] = useState<Country[]>([])
  const [home, setHome] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api.countries().then((c) => {
      setCountries(c.countries)
      setHome(c.home)
    })
  }, [])

  return (
    <div>
      <h2 className="page-title">Country Info</h2>
      <p className="page-help">
        Study the markets and entry modes. Your return depends on how well your choices fit each
        round&apos;s news, not on a published formula.
      </p>

      <div className="help-box">
        <h3>What to do</h3>
        <p>
          Read the country tables and entry-mode comparison (fit, not price). Press Start when
          ready for Round 1 news.
        </p>
      </div>

      {onStart && (
        <div className="actions-row">
          <button
            className={`btn btn-primary${busy ? ' is-busy' : ''}`}
            disabled={busy}
            onClick={() => {
              if (busy) return
              setBusy(true)
              void Promise.resolve(onStart()).catch(() => setBusy(false))
            }}
          >
            {busy ? 'Starting…' : 'Start Round 1'}
          </button>
        </div>
      )}

      <h3 className="section-label">1. Qualitative attributes</h3>
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

      <h3 className="section-label">2. Economic indicators</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>GDP per capita ($)</th>
              <th>Forecast GDP growth (%)</th>
              <th>Forecast population growth (%)</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.code}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td className="mono">{c.gdpPerCapita.toLocaleString()}</td>
                <td className="mono">{c.gdpGrowthPct.toFixed(1)}</td>
                <td className="mono">{c.popGrowthPct.toFixed(2)}</td>
              </tr>
            ))}
            {home && (
              <tr>
                <td>
                  <strong>USA (Home)</strong>
                </td>
                <td className="mono">{Number(home.gdpPerCapita).toLocaleString()}</td>
                <td className="mono">{Number(home.gdpGrowthPct).toFixed(1)}</td>
                <td className="mono">{Number(home.popGrowthPct).toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="section-label">3. Entry modes</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Franchising</th>
              <th>Joint Venture</th>
              <th>Wholly Owned Subsidiary</th>
            </tr>
          </thead>
          <tbody>
            {ENTRY_MODE_ROWS.map((row) => (
              <tr key={row.parameter}>
                <td>
                  <strong>{row.parameter}</strong>
                </td>
                <td>{row.franchising}</td>
                <td>{row.jv}</td>
                <td>{row.wo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="page-help">
        All three modes cost the same to enter and operate, so the choice is about fit, not price.
      </p>

      <h3 className="section-label">4. How entry modes connect to country attributes</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Attribute</th>
              <th>When it is high</th>
              <th>When it is low</th>
            </tr>
          </thead>
          <tbody>
            {MODE_LINK_ROWS.map((row) => (
              <tr key={row.attribute}>
                <td>
                  <strong>{row.attribute}</strong>
                </td>
                <td>{row.whenHigh}</td>
                <td>{row.whenLow}</td>
              </tr>
            ))}
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
