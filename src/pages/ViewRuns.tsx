import { useEffect, useState } from 'react'
import { api } from '../api'

export function ViewRuns() {
  const [rows, setRows] = useState<
    { runId: string; companyName: string; completedAt: string; roundsPlayed: number; totalProfitM: number }[]
  >([])

  useEffect(() => {
    void api.listRuns().then(setRows)
  }, [])

  return (
    <div>
      <h2 className="page-title">View Runs</h2>
      <p className="page-help">Completed runs on this server, sorted by total profit.</p>
      {rows.length === 0 ? (
        <div className="empty">No completed runs yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Finished</th>
                <th>Rounds</th>
                <th>Total profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.runId}>
                  <td>
                    <strong>{r.companyName}</strong>
                  </td>
                  <td>{r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}</td>
                  <td>{r.roundsPlayed}</td>
                  <td
                    className="mono"
                    style={{ color: r.totalProfitM >= 0 ? 'var(--good)' : 'var(--bad)' }}
                  >
                    ${r.totalProfitM.toFixed(2)} M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
