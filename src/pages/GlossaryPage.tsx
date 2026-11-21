import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

export function GlossaryPage() {
  const [terms, setTerms] = useState<{ term: string; definition: string }[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    void api.glossary().then(setTerms)
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return terms
    return terms.filter(
      (t) => t.term.toLowerCase().includes(s) || t.definition.toLowerCase().includes(s),
    )
  }, [terms, q])

  return (
    <div>
      <h2 className="page-title">Glossary</h2>
      <p className="page-help">Short definitions used in this simulation.</p>
      <div className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
        <label htmlFor="gsearch">Search</label>
        <input id="gsearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a word…" />
      </div>
      <div className="glossary-grid">
        {filtered.map((g) => (
          <div key={g.term} className="glossary-item">
            <h4>{g.term}</h4>
            <p>{g.definition}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
