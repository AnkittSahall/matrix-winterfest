import { useEffect, useState } from 'react'
import { api } from '../../api'

export function NewsTab({
  runId,
  onGoDecision,
}: {
  runId: string
  onGoDecision: () => void
}) {
  const [title, setTitle] = useState('')
  const [round, setRound] = useState(1)
  const [numRounds, setNumRounds] = useState(6)
  const [items, setItems] = useState<{ order: number; headline: string; body: string }[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .news(runId)
      .then((n) => {
        setTitle(n.title)
        setRound(n.round)
        setNumRounds(n.numRounds)
        setItems(n.items)
      })
      .catch((e) => setError(e.message))
  }, [runId])

  if (error) return <div className="empty">{error}</div>

  return (
    <div>
      <h2 className="page-title">
        Round {round} of {numRounds} — {title}
      </h2>
      <p className="page-help">
        Read the news carefully. Then allocate your budget on the Decision tab.
      </p>

      <div className="news-paragraphs">
        {items.map((item) => (
          <p key={item.order}>
            <strong>{item.headline}</strong>
            {' – '}
            {item.body}
          </p>
        ))}
      </div>

      <div className="footer-actions">
        <button className="btn btn-primary" onClick={onGoDecision}>
          Go to Decision
        </button>
      </div>
    </div>
  )
}
