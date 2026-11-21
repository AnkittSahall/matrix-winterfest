import { useEffect, useState } from 'react'
import { api } from '../../api'

export function NewsTab({
  runId,
  round,
  onGoDecision,
}: {
  runId: string
  round: number
  onGoDecision: () => void | Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [numRounds, setNumRounds] = useState(6)
  const [items, setItems] = useState<{ order: number; headline: string; body: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api
      .news(runId)
      .then((n) => {
        if (!alive) return
        setTitle(n.title)
        setNumRounds(n.numRounds)
        setItems(n.items)
      })
      .catch((e) => {
        if (!alive) return
        setError(e.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [runId, round])

  if (error) return <div className="empty">{error}</div>
  if (loading) return <div className="empty">Loading news…</div>

  return (
    <div>
      <h2 className="page-title">
        Round {round} of {numRounds}: {title}
      </h2>
      <p className="page-help">Read the news carefully. Then allocate your budget on the Decision tab.</p>

      <div className="news-paragraphs">
        {items.map((item) => (
          <article key={item.order} className="news-block">
            <h3>{item.headline}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <div className="footer-actions">
        <button
          className={`btn btn-primary${busy ? ' is-busy' : ''}`}
          disabled={busy}
          onClick={() => {
            if (busy) return
            setBusy(true)
            void Promise.resolve(onGoDecision()).catch(() => setBusy(false))
          }}
        >
          {busy ? 'Opening…' : 'Go to Decision'}
        </button>
      </div>
    </div>
  )
}
