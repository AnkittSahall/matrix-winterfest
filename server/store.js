import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED = path.join(__dirname, 'seed_data')
const onVercel = Boolean(process.env.VERCEL)
const STORE_PATH = onVercel
  ? path.join('/tmp', 'matrix-sim-db.json')
  : path.join(__dirname, 'store', 'db.json')

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim()
const SUPABASE_SECRET =
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

let memoryDb = null
let supabase = null

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function defaultConfig() {
  return {
    configId: randomUUID(),
    version: 1,
    isActive: true,
    numRounds: 6,
    sequence: [1, 2, 3, 4, 5, 6],
    startBudgetM: 100,
    budgetMode: 'A',
    timerEnabled: false,
    timerMinutes: 5,
    alertMinutes: 1,
    timerOverrides: {},
    createdAt: new Date().toISOString(),
  }
}

function emptyDb() {
  return {
    competitionId: randomUUID(),
    config: defaultConfig(),
    runs: {},
    drafts: {},
    sessions: {},
  }
}

export function usingSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET)
}

function sb() {
  if (!usingSupabase()) return null
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SECRET, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return supabase
}

export function loadSeed() {
  const countries = readJson(path.join(SEED, 'countries.json'))
  const entryModes = readJson(path.join(SEED, 'entry_modes.json'))
  const news = readJson(path.join(SEED, 'news.json'))
  const glossary = readJson(path.join(SEED, 'glossary.json'))
  const factors = readJson(path.join(SEED, 'factors.json'))

  const factorMap = new Map()
  for (const row of factors) {
    factorMap.set(`${row.scenarioId}|${row.countryCode}|${row.mode}`, row.multiplier)
  }

  return {
    countries,
    entryModes,
    news,
    glossary,
    factorLookup: (scenarioId, countryCode, modeCode) =>
      factorMap.get(`${scenarioId}|${countryCode}|${modeCode}`) ?? null,
    scenarios: news.map((n) => ({ scenarioId: n.scenarioId, title: n.title })),
  }
}

function fileLoad() {
  if (memoryDb) return memoryDb
  try {
    if (fs.existsSync(STORE_PATH)) {
      memoryDb = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
      if (!memoryDb.competitionId) memoryDb.competitionId = randomUUID()
      return memoryDb
    }
  } catch {
    // fall through
  }
  memoryDb = emptyDb()
  fileSave(memoryDb)
  return memoryDb
}

function fileSave(db) {
  memoryDb = db
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2))
  } catch (err) {
    console.warn('Could not persist db to disk:', err.message)
  }
}

async function ensureMeta() {
  const client = sb()
  const { data, error } = await client.from('matrix_meta').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(`Supabase meta read: ${error.message}`)
  if (data) return data
  const row = {
    id: 1,
    competition_id: randomUUID(),
    config: defaultConfig(),
  }
  const { error: insErr } = await client.from('matrix_meta').insert(row)
  if (insErr) throw new Error(`Supabase meta seed: ${insErr.message}`)
  return row
}

export async function loadDb() {
  if (!usingSupabase()) return fileLoad()

  const client = sb()
  const meta = await ensureMeta()
  const competitionId = meta.competition_id

  const { data: runRows, error: runErr } = await client
    .from('matrix_runs')
    .select('run_id, data')
    .eq('competition_id', competitionId)
  if (runErr) throw new Error(`Supabase runs read: ${runErr.message}`)

  const runs = {}
  for (const row of runRows || []) {
    runs[row.run_id] = row.data
  }

  const runIds = Object.keys(runs)
  const drafts = {}
  if (runIds.length) {
    const { data: draftRows, error: draftErr } = await client
      .from('matrix_drafts')
      .select('run_id, round, allocations')
      .in('run_id', runIds)
    if (draftErr) throw new Error(`Supabase drafts read: ${draftErr.message}`)
    for (const row of draftRows || []) {
      drafts[`${row.run_id}:${row.round}`] = row.allocations
    }
  }

  const { data: sessionRows, error: sessErr } = await client
    .from('matrix_sessions')
    .select('token, created_at')
  if (sessErr) throw new Error(`Supabase sessions read: ${sessErr.message}`)
  const sessions = {}
  for (const row of sessionRows || []) {
    sessions[row.token] = { at: row.created_at }
  }

  return {
    competitionId,
    config: meta.config,
    runs,
    drafts,
    sessions,
  }
}

export async function upsertRun(run, competitionId) {
  if (!usingSupabase()) {
    const d = fileLoad()
    d.runs[run.runId] = run
    fileSave(d)
    return
  }
  const client = sb()
  const meta = await ensureMeta()
  const cid = competitionId || meta.competition_id
  const { error } = await client.from('matrix_runs').upsert({
    run_id: run.runId,
    competition_id: cid,
    company_name: run.companyName,
    status: run.status,
    data: run,
    created_at: run.createdAt || new Date().toISOString(),
    completed_at: run.completedAt || null,
  })
  if (error) throw new Error(`Supabase upsert run: ${error.message}`)
}

export async function upsertDraft(runId, round, allocations) {
  if (!usingSupabase()) {
    const d = fileLoad()
    d.drafts[`${runId}:${round}`] = allocations
    fileSave(d)
    return
  }
  const client = sb()
  const { error } = await client.from('matrix_drafts').upsert({
    run_id: runId,
    round,
    allocations,
  })
  if (error) throw new Error(`Supabase upsert draft: ${error.message}`)
}

export async function upsertSession(token, at = new Date().toISOString()) {
  if (!usingSupabase()) {
    const d = fileLoad()
    d.sessions = d.sessions || {}
    d.sessions[token] = { at }
    fileSave(d)
    return
  }
  const client = sb()
  const { error } = await client.from('matrix_sessions').upsert({ token, created_at: at })
  if (error) throw new Error(`Supabase upsert session: ${error.message}`)
}

export async function removeSession(token) {
  if (!usingSupabase()) {
    const d = fileLoad()
    if (d.sessions) delete d.sessions[token]
    fileSave(d)
    return
  }
  const client = sb()
  const { error } = await client.from('matrix_sessions').delete().eq('token', token)
  if (error) throw new Error(`Supabase delete session: ${error.message}`)
}

export async function saveConfig(config, competitionId) {
  if (!usingSupabase()) {
    const d = fileLoad()
    d.config = config
    fileSave(d)
    return
  }
  const client = sb()
  const meta = await ensureMeta()
  const { error } = await client.from('matrix_meta').upsert({
    id: 1,
    competition_id: competitionId || meta.competition_id,
    config,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Supabase save config: ${error.message}`)
}

/** New competition — old runs kept by competition_id; UI only shows current. */
export async function resetCompetition() {
  const newId = randomUUID()
  if (!usingSupabase()) {
    const d = fileLoad()
    d.competitionId = newId
    d.runs = {}
    d.drafts = {}
    d.sessions = {}
    fileSave(d)
    return { competitionId: newId }
  }
  const client = sb()
  const meta = await ensureMeta()
  const { error } = await client.from('matrix_meta').upsert({
    id: 1,
    competition_id: newId,
    config: meta.config,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Supabase reset: ${error.message}`)
  await client.from('matrix_sessions').delete().neq('token', '')
  return { competitionId: newId }
}

export function publicConfig(cfg) {
  return {
    numRounds: cfg.numRounds,
    startBudgetM: cfg.startBudgetM,
    budgetMode: cfg.budgetMode,
    timerEnabled: cfg.timerEnabled,
    timerMinutes: cfg.timerEnabled ? cfg.timerMinutes : null,
  }
}

export { randomUUID }
