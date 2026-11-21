import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { resolveRound, nextPool, scaleToPool, round2, workedExample } from './engine.js'
import {
  loadSeed,
  loadDb,
  publicConfig,
  defaultConfig,
  randomUUID,
  usingSupabase,
  upsertRun,
  upsertDraft,
  upsertSession,
  removeSession,
  saveConfig,
  resetCompetition,
} from './store.js'

const PORT = process.env.PORT || 3001
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'matrix2026'

const seed = loadSeed()
const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.admin_session
    const d = await loadDb()
    if (!token || !d.sessions?.[token]) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

function scenarioForRound(run, round) {
  return run.configSnapshot.sequence[round - 1]
}

function getNews(scenarioId) {
  return seed.news.find((n) => n.scenarioId === scenarioId) || null
}

function draftKey(runId, round) {
  return `${runId}:${round}`
}

function sanitizeAllocations(rows) {
  const out = []
  const seen = new Set()
  for (const row of rows || []) {
    if (!row?.countryCode || seen.has(row.countryCode)) continue
    const mode = row.modeCode && row.modeCode !== 'NONE' ? row.modeCode : null
    const amount = Number(row.amountM)
    if (!mode || !(amount > 0)) continue
    seen.add(row.countryCode)
    out.push({
      countryCode: row.countryCode,
      modeCode: mode,
      amountM: round2(amount),
    })
  }
  return out
}

async function persistRun(d, run) {
  d.runs[run.runId] = run
  await upsertRun(run, d.competitionId)
}

async function persistDraft(d, runId, round, allocations) {
  d.drafts[draftKey(runId, round)] = allocations
  await upsertDraft(runId, round, allocations)
}

async function lazyAutoLock(run, d) {
  if (run.status !== 'IN_PROGRESS') return run
  if (run.phase === 'RESULT') return run
  if (!run.configSnapshot.timerEnabled || !run.roundDeadlineAt) return run
  if (Date.now() < new Date(run.roundDeadlineAt).getTime()) return run

  const key = draftKey(run.runId, run.currentRound)
  const draft = d.drafts[key] || []
  const pool = run.currentPoolM
  const allocations = scaleToPool(draft, pool)
  const scenarioId = scenarioForRound(run, run.currentRound)
  const resolved = resolveRound({
    pool,
    scenarioId,
    allocations,
    factorLookup: seed.factorLookup,
  })
  const closing = nextPool({
    budgetMode: run.configSnapshot.budgetMode,
    startBudgetM: run.configSnapshot.startBudgetM,
    pool,
    profitM: resolved.profitM,
  })
  const started = run.roundStartedAt ? new Date(run.roundStartedAt).getTime() : Date.now()
  const timeUsedSec = Math.max(0, Math.round((Date.now() - started) / 1000))

  run.history = run.history || []
  if (!run.history.some((h) => h.round === run.currentRound)) {
    run.history.push({
      round: run.currentRound,
      scenarioId,
      openingPoolM: pool,
      investedM: resolved.investedM,
      idleM: resolved.idleM,
      profitM: resolved.profitM,
      closingPoolM: closing,
      cumulativeProfitM: round2(run.cumulativeProfitM + resolved.profitM),
      autoLocked: true,
      timeUsedSec,
      lockedAt: new Date().toISOString(),
      allocations,
    })
    run.cumulativeProfitM = round2(run.cumulativeProfitM + resolved.profitM)
    run.currentPoolM = closing
  }
  run.phase = 'RESULT'
  run.roundDeadlineAt = null
  await persistRun(d, run)
  return run
}

function playerRunView(run) {
  const cfg = run.configSnapshot
  return {
    runId: run.runId,
    companyName: run.companyName,
    status: run.status,
    currentRound: run.currentRound,
    numRounds: cfg.numRounds,
    phase: run.phase,
    currentPoolM: run.currentPoolM,
    cumulativeProfitM: run.cumulativeProfitM,
    budgetMode: cfg.budgetMode,
    startBudgetM: cfg.startBudgetM,
    timerEnabled: cfg.timerEnabled,
    alertMinutes: cfg.alertMinutes || 1,
    roundStartedAt: run.roundStartedAt,
    roundDeadlineAt: run.roundDeadlineAt,
    alertShown: !!run.alertShown,
    history: (run.history || []).map((h) => ({
      round: h.round,
      openingPoolM: h.openingPoolM,
      investedM: h.investedM,
      idleM: h.idleM,
      profitM: h.profitM,
      closingPoolM: h.closingPoolM,
      cumulativeProfitM: h.cumulativeProfitM,
      autoLocked: h.autoLocked,
      timeUsedSec: h.timeUsedSec,
      allocations: h.allocations || [],
    })),
    lastLockedAllocations:
      (run.history || []).find((h) => h.round === run.currentRound)?.allocations || null,
  }
}

function completedResults(d) {
  return Object.values(d.runs)
    .filter((r) => r.status === 'COMPLETED')
    .map((r) => ({
      runId: r.runId,
      companyName: r.companyName,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      roundsPlayed: r.configSnapshot?.numRounds || r.history?.length || 0,
      totalProfitM: r.cumulativeProfitM,
      finalPoolM: r.currentPoolM,
      budgetMode: r.configSnapshot?.budgetMode || 'A',
      startBudgetM: r.configSnapshot?.startBudgetM || 100,
    }))
    .sort((a, b) => b.totalProfitM - a.totalProfitM)
    .map((r, i) => ({ rank: i + 1, ...r }))
}

async function mirrorToSheet(row) {
  const url = process.env.RESULTS_SHEET_WEBHOOK
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    })
  } catch (err) {
    console.warn('Sheet mirror failed:', err.message)
  }
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(err)
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Server error' })
      }
    })
  }
}

// —— Public reference (no factors) ——
app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    const ex = workedExample(seed.factorLookup)
    res.json({
      ok: true,
      store: usingSupabase() ? 'supabase' : 'file',
      engineCheck: {
        profitM: ex.profitM,
        idleM: ex.idleM,
        investedM: ex.investedM,
        expected: { profitM: 5.57, idleM: 40, investedM: 60 },
      },
    })
  }),
)

app.get(
  '/api/config/public',
  asyncHandler(async (_req, res) => {
    const d = await loadDb()
    res.json(publicConfig(d.config))
  }),
)

app.get('/api/reference/countries', (_req, res) => {
  res.json(seed.countries)
})

app.get('/api/reference/entry-modes', (_req, res) => {
  res.json(seed.entryModes)
})

app.get('/api/reference/glossary', (_req, res) => {
  res.json(seed.glossary)
})

// —— Admin ——
app.post(
  '/api/admin/login',
  asyncHandler(async (req, res) => {
    const pass = String(req.body?.passcode || '')
    if (pass !== ADMIN_PASSCODE) return res.status(401).json({ error: 'Wrong passcode' })
    const token = randomUUID()
    await upsertSession(token)
    res.cookie('admin_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(process.env.VERCEL),
      maxAge: 12 * 60 * 60 * 1000,
    })
    res.json({ ok: true })
  }),
)

app.post(
  '/api/admin/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.admin_session
    if (token) await removeSession(token)
    res.clearCookie('admin_session')
    res.json({ ok: true })
  }),
)

app.get(
  '/api/admin/config',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const d = await loadDb()
    res.json({ ...d.config, competitionId: d.competitionId, scenarios: seed.scenarios })
  }),
)

app.put(
  '/api/admin/config',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const numRounds = Number(body.numRounds)
    const sequence = (body.sequence || []).map(Number)
    const startBudgetM = Number(body.startBudgetM)
    const budgetMode = body.budgetMode === 'B' ? 'B' : 'A'
    const timerEnabled = !!body.timerEnabled
    const timerMinutes = Number(body.timerMinutes || 5)
    const alertMinutes = Number(body.alertMinutes || 1)

    if (!Number.isInteger(numRounds) || numRounds < 1 || numRounds > 6) {
      return res.status(400).json({ error: 'Rounds must be 1 to 6' })
    }
    if (sequence.length !== numRounds) {
      return res.status(400).json({ error: 'Fill every round slot' })
    }
    if (new Set(sequence).size !== sequence.length) {
      return res.status(400).json({ error: 'No duplicate scenarios' })
    }
    if (sequence.some((s) => s < 1 || s > 6)) {
      return res.status(400).json({ error: 'Scenarios must be 1 to 6' })
    }
    if (!(startBudgetM > 0)) return res.status(400).json({ error: 'Budget must be > 0' })
    if (timerEnabled) {
      if (timerMinutes < 1 || timerMinutes > 60) {
        return res.status(400).json({ error: 'Timer minutes 1–60' })
      }
      if (!(alertMinutes > 0) || alertMinutes >= timerMinutes) {
        return res.status(400).json({ error: 'Alert minutes must be smaller than round minutes' })
      }
    }

    const d = await loadDb()
    const prev = d.config || defaultConfig()
    d.config = {
      ...prev,
      configId: randomUUID(),
      version: (prev.version || 0) + 1,
      isActive: true,
      numRounds,
      sequence,
      startBudgetM: round2(startBudgetM),
      budgetMode,
      timerEnabled,
      timerMinutes,
      alertMinutes,
      timerOverrides: body.timerOverrides || {},
      createdAt: new Date().toISOString(),
    }
    await saveConfig(d.config, d.competitionId)
    const labels = sequence
      .map((id, i) => {
        const t = seed.scenarios.find((s) => s.scenarioId === id)?.title || id
        return `Round ${i + 1} → Scenario ${id} (${t})`
      })
      .join(' · ')
    res.json({
      config: d.config,
      summary: `${labels} · Budget $${d.config.startBudgetM}M · Mode ${budgetMode}${
        timerEnabled ? ` · Timer ${timerMinutes} min` : ''
      }`,
    })
  }),
)

app.post(
  '/api/admin/reset-competition',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await resetCompetition()
    res.json({ ok: true, ...result })
  }),
)

app.get(
  '/api/admin/results',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const d = await loadDb()
    const results = completedResults(d)
    res.json({
      generatedAt: new Date().toISOString(),
      competitionId: d.competitionId,
      count: results.length,
      results,
    })
  }),
)

// —— Runs ——
app.post(
  '/api/runs',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.companyName || '').trim()
    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({ error: 'Company name must be 2–40 characters' })
    }
    const d = await loadDb()
    const cfg = { ...d.config }
    const runId = randomUUID()
    const run = {
      runId,
      companyName: name,
      configSnapshot: cfg,
      status: 'BRIEFING',
      currentRound: 0,
      phase: null,
      currentPoolM: cfg.startBudgetM,
      cumulativeProfitM: 0,
      roundStartedAt: null,
      roundDeadlineAt: null,
      alertShown: false,
      history: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
    }
    await persistRun(d, run)
    res.json(playerRunView(run))
  }),
)

app.get(
  '/api/runs',
  asyncHandler(async (_req, res) => {
    const d = await loadDb()
    res.json(completedResults(d))
  }),
)

app.get(
  '/api/runs/:id',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    let run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    run = await lazyAutoLock(run, d)
    res.json(playerRunView(run))
  }),
)

app.post(
  '/api/runs/:id/start',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    let run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    if (run.status === 'BRIEFING') {
      run.status = 'IN_PROGRESS'
      run.currentRound = 1
      run.phase = 'NEWS'
      run.currentPoolM = run.configSnapshot.startBudgetM
      run.cumulativeProfitM = 0
      run.alertShown = false
      run.roundStartedAt = new Date().toISOString()
      if (run.configSnapshot.timerEnabled) {
        const mins =
          run.configSnapshot.timerOverrides?.[1] || run.configSnapshot.timerMinutes || 5
        run.roundDeadlineAt = new Date(Date.now() + mins * 60_000).toISOString()
      } else {
        run.roundDeadlineAt = null
      }
      await persistRun(d, run)
    }
    res.json(playerRunView(run))
  }),
)

app.get(
  '/api/runs/:id/news',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    let run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    run = await lazyAutoLock(run, d)
    if (run.status === 'BRIEFING' || !run.currentRound) {
      return res.status(403).json({ error: 'Press Start to begin Round 1' })
    }
    const scenarioId = scenarioForRound(run, run.currentRound)
    const news = getNews(scenarioId)
    res.json({
      round: run.currentRound,
      numRounds: run.configSnapshot.numRounds,
      title: news?.title || '',
      items: news?.items || [],
    })
  }),
)

app.get(
  '/api/runs/:id/draft',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    const run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    const round = run.currentRound || 1
    const key = draftKey(run.runId, round)
    let draft = d.drafts[key]
    if (!draft) {
      const prev = (run.history || []).find((h) => h.round === round - 1)
      draft = prev?.allocations?.map((a) => ({ ...a })) || []
    }
    res.json({ round, poolM: run.currentPoolM, allocations: draft })
  }),
)

app.put(
  '/api/runs/:id/draft',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    let run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    run = await lazyAutoLock(run, d)
    if (run.phase !== 'NEWS' && run.phase !== 'DECISION') {
      return res.status(403).json({ error: 'Round is locked' })
    }
    const rows = Array.isArray(req.body?.allocations) ? req.body.allocations : []
    const normalized = []
    for (const c of seed.countries.countries) {
      const row = rows.find((r) => r.countryCode === c.code)
      const mode = row?.modeCode && row.modeCode !== 'NONE' ? row.modeCode : 'NONE'
      const amountM = mode === 'NONE' ? 0 : Math.max(0, Number(row?.amountM) || 0)
      normalized.push({ countryCode: c.code, modeCode: mode, amountM: round2(amountM) })
    }
    await persistDraft(d, run.runId, run.currentRound, normalized)
    res.json({ ok: true })
  }),
)

app.post(
  '/api/runs/:id/phase',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    let run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    run = await lazyAutoLock(run, d)
    if (run.phase === 'NEWS') {
      run.phase = 'DECISION'
      await persistRun(d, run)
    }
    res.json(playerRunView(run))
  }),
)

app.post(
  '/api/runs/:id/lock',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    let run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    run = await lazyAutoLock(run, d)

    if (run.phase === 'RESULT') {
      return res.json(playerRunView(run))
    }
    if (run.phase !== 'NEWS' && run.phase !== 'DECISION') {
      return res.status(403).json({ error: 'Cannot lock now' })
    }

    const pool = run.currentPoolM
    const fromBody = sanitizeAllocations(req.body?.allocations)
    const key = draftKey(run.runId, run.currentRound)
    const fromDraft = sanitizeAllocations(d.drafts[key] || [])
    const allocations = fromBody.length ? fromBody : fromDraft

    const invested = round2(allocations.reduce((s, a) => s + a.amountM, 0))
    if (invested > pool + 1e-9) {
      return res.status(400).json({ error: 'You have allocated more than your pool' })
    }

    if (run.configSnapshot.timerEnabled && run.roundDeadlineAt) {
      const late = Date.now() - new Date(run.roundDeadlineAt).getTime()
      if (late > 2000) {
        run = await lazyAutoLock(run, d)
        return res.json(playerRunView(run))
      }
    }

    const scenarioId = scenarioForRound(run, run.currentRound)
    const resolved = resolveRound({
      pool,
      scenarioId,
      allocations,
      factorLookup: seed.factorLookup,
    })
    const closing = nextPool({
      budgetMode: run.configSnapshot.budgetMode,
      startBudgetM: run.configSnapshot.startBudgetM,
      pool,
      profitM: resolved.profitM,
    })
    const started = run.roundStartedAt ? new Date(run.roundStartedAt).getTime() : Date.now()
    const timeUsedSec = Math.max(0, Math.round((Date.now() - started) / 1000))

    run.history = run.history || []
    run.history.push({
      round: run.currentRound,
      scenarioId,
      openingPoolM: pool,
      investedM: resolved.investedM,
      idleM: resolved.idleM,
      profitM: resolved.profitM,
      closingPoolM: closing,
      cumulativeProfitM: round2(run.cumulativeProfitM + resolved.profitM),
      autoLocked: false,
      timeUsedSec,
      lockedAt: new Date().toISOString(),
      allocations,
    })
    run.cumulativeProfitM = round2(run.cumulativeProfitM + resolved.profitM)
    run.currentPoolM = closing
    run.phase = 'RESULT'
    run.roundDeadlineAt = null
    await persistRun(d, run)
    res.json(playerRunView(run))
  }),
)

app.post(
  '/api/runs/:id/next',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    let run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    if (run.phase !== 'RESULT') return res.status(403).json({ error: 'Lock the round first' })

    if (run.currentRound >= run.configSnapshot.numRounds) {
      run.status = 'COMPLETED'
      run.completedAt = new Date().toISOString()
      await persistRun(d, run)
      const ranked = completedResults(d).find((r) => r.runId === run.runId)
      void mirrorToSheet({
        event: 'run_completed',
        ...ranked,
      })
      return res.json({ ...playerRunView(run), finished: true })
    }

    run.currentRound += 1
    run.phase = 'NEWS'
    run.alertShown = false
    run.roundStartedAt = new Date().toISOString()
    if (run.configSnapshot.timerEnabled) {
      const mins =
        run.configSnapshot.timerOverrides?.[run.currentRound] ||
        run.configSnapshot.timerMinutes ||
        5
      run.roundDeadlineAt = new Date(Date.now() + mins * 60_000).toISOString()
    } else {
      run.roundDeadlineAt = null
    }
    await persistRun(d, run)
    res.json({ ...playerRunView(run), finished: false })
  }),
)

app.post(
  '/api/runs/:id/alert-shown',
  asyncHandler(async (req, res) => {
    const d = await loadDb()
    const run = d.runs[req.params.id]
    if (!run) return res.status(404).json({ error: 'Run not found' })
    run.alertShown = true
    await persistRun(d, run)
    res.json({ ok: true })
  }),
)

export default app

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const check = workedExample(seed.factorLookup)
    console.log(`MatriX API on http://localhost:${PORT}`)
    console.log(`Store: ${usingSupabase() ? 'supabase' : 'file'}`)
    console.log(
      `Engine check: profit=${check.profitM} idle=${check.idleM} (expect 5.57 / 40)`,
    )
  })
}
