import { useState } from 'react'
import { Welcome } from './Welcome'
import { ViewRuns } from './ViewRuns'
import { GlossaryPage } from './GlossaryPage'

type Tab = 'welcome' | 'runs' | 'glossary'

export function HomeTabs() {
  const [tab, setTab] = useState<Tab>('welcome')

  if (tab === 'welcome') {
    return (
      <>
        <Welcome
          topTabs={
            <nav className="home-tabs" aria-label="Home">
              <button className="home-tab active" type="button">
                Welcome
              </button>
              <button className="home-tab" type="button" onClick={() => setTab('runs')}>
                View Runs
              </button>
              <button className="home-tab" type="button" onClick={() => setTab('glossary')}>
                Glossary
              </button>
            </nav>
          }
        />
      </>
    )
  }

  return (
    <div className="shell">
      <nav className="home-tabs" aria-label="Home">
        <button className="home-tab" type="button" onClick={() => setTab('welcome')}>
          Welcome
        </button>
        <button
          className={`home-tab ${tab === 'runs' ? 'active' : ''}`}
          type="button"
          onClick={() => setTab('runs')}
        >
          View Runs
        </button>
        <button
          className={`home-tab ${tab === 'glossary' ? 'active' : ''}`}
          type="button"
          onClick={() => setTab('glossary')}
        >
          Glossary
        </button>
      </nav>
      {tab === 'runs' && <ViewRuns />}
      {tab === 'glossary' && <GlossaryPage />}
    </div>
  )
}
