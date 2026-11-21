import { type ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { api, type PublicConfig } from '../api'

const HERO_IMG =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=80'

function BriefGraphics() {
  return (
    <div className="brief-graphics" aria-hidden>
      <svg className="brief-grid" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="matrixGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(227,6,19,0.08)" strokeWidth="1" />
          </pattern>
          <linearGradient id="redFade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(227,6,19,0.16)" />
            <stop offset="100%" stopColor="rgba(227,6,19,0)" />
          </linearGradient>
        </defs>
        <rect width="800" height="400" fill="url(#matrixGrid)" />
        <circle cx="720" cy="80" r="120" fill="url(#redFade)" />
        <circle cx="60" cy="340" r="90" fill="url(#redFade)" />
      </svg>
      <div className="brief-orb brief-orb-a" />
      <div className="brief-orb brief-orb-b" />
    </div>
  )
}

function summaryLine(cfg: PublicConfig | null) {
  if (!cfg) return 'Loading game settings…'
  const parts = [`${cfg.numRounds} rounds`, `Budget $${cfg.startBudgetM} M`]
  if (cfg.timerEnabled && cfg.timerMinutes) parts.push(`${cfg.timerMinutes} minutes per round`)
  if (cfg.budgetMode === 'B') parts.push('Profits and losses carry into the next round')
  return parts.join(' · ')
}

export function Welcome({ topTabs }: { topTabs?: ReactNode }) {
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [cfg, setCfg] = useState<PublicConfig | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = companyName.trim().length >= 2 && companyName.trim().length <= 40

  useEffect(() => {
    api.publicConfig().then(setCfg).catch(() => setCfg(null))
  }, [])

  const scrollToBrief = () => {
    document.getElementById('briefing')?.scrollIntoView({ behavior: 'smooth' })
  }

  const begin = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      const run = await api.createRun(companyName.trim())
      navigate(`/play/${run.runId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="welcome-page">
      <section className="welcome-hero-bleed">
        <div className="hero-bg" aria-hidden>
          <img src={HERO_IMG} alt="" />
          <div className="hero-shade" />
        </div>

        <div className="welcome-hero-inner">
          {topTabs && <div className="welcome-home-tabs">{topTabs}</div>}

          <motion.div
            className="welcome-brand-mark"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <img src="/matrix-logo.jfif" alt="MatriX Consulting Club" />
            <div className="mark-text">
              <strong>
                Matri<span>X</span>
              </strong>
              <small>Consulting Club · XIME Bengaluru</small>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06 }}
          >
            <div className="welcome-kicker">Market Entry Simulation</div>
            <h1 className="welcome-title-hero">
              Build the global brand. <span>Own the thesis.</span>
            </h1>
            <p className="welcome-sub-hero">{summaryLine(cfg)}</p>
            <p className="welcome-sub-hero" style={{ marginTop: 8, fontSize: '0.95rem' }}>
              Home country: USA
            </p>
          </motion.div>

          <motion.div
            className="welcome-cta-hero"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14 }}
          >
            <div className="field welcome-field">
              <label htmlFor="company">Company name</label>
              <input
                id="company"
                placeholder="Your Company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && ready) void begin()
                }}
                maxLength={40}
                autoFocus
              />
              {error && <span className="field-error">{error}</span>}
            </div>
            <button className="btn btn-primary btn-lg" disabled={!ready || busy} onClick={() => void begin()}>
              {busy ? 'Starting…' : 'Continue'}
            </button>
          </motion.div>
        </div>

        <button type="button" className="scroll-cue" onClick={scrollToBrief}>
          <span>Scroll for briefing</span>
          <span className="scroll-cue-arrow" aria-hidden />
        </button>
      </section>

      <section id="briefing" className="welcome-brief-wrap">
        <BriefGraphics />
        <div className="welcome-brief">
          <div>
            <div className="welcome-brief-label">Briefing</div>
            <h2>
              Welcome to the Market Entry <em>simulation</em>
            </h2>
            <div className="welcome-meta-row">
              <span className="welcome-chip">
                Rounds <b>{cfg?.numRounds ?? '—'}</b>
              </span>
              <span className="welcome-chip accent">
                Budget <b>${cfg?.startBudgetM ?? '—'} M</b>
              </span>
              <span className="welcome-chip">
                Home <b>USA</b>
              </span>
            </div>
          </div>

          <div className="welcome-prose">
            <p>
              You manage the international strategy of a casual dining chain. Each round you
              decide <strong>where to invest</strong> and in which <strong>entry mode</strong>.
            </p>
            <p>
              Your score is your <strong>total profit</strong> at the end. Holding cash is
              allowed — idle money earns nothing.
            </p>
            <p>
              After you continue: read <strong>Country Info</strong>, press{' '}
              <strong>Start</strong>, then each round go{' '}
              <strong>News → Decision → Result</strong>.
            </p>
          </div>
        </div>

        <p className="welcome-credit">Developed by MatriX Consulting Club team 2026</p>
      </section>
    </div>
  )
}
