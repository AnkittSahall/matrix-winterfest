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

const ROOM_ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode() {
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += ROOM_ALPH[Math.floor(Math.random() * ROOM_ALPH.length)]
  }
  return out
}

export function normalizeRoomCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
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
    timerEnabled: true,
    timerMinutes: 5,
    alertMinutes: 1,
    timerOverrides: {},
    roomCode: generateRoomCode(),
    lobbyOpen: false,
    createdAt: new Date().toISOString(),
  }
}

function emptyDb() {
  const config = defaultConfig()
  return {
    competitionId: randomUUID(),
    roomCode: config.roomCode,
    lobbyOpen: false,
    config,
    liveBoard: null,
    runs: {},
    drafts: {},
    sessions: {},
  }
}

function withLobbyFields(config) {
  const cfg = { ...(config || defaultConfig()) }
  if (!cfg.roomCode) cfg.roomCode = generateRoomCode()
  cfg.lobbyOpen = !!cfg.lobbyOpen
  cfg.roomCode = normalizeRoomCode(cfg.roomCode)
  return cfg
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
      memoryDb.config = withLobbyFields(memoryDb.config)
      memoryDb.roomCode = memoryDb.config.roomCode
      memoryDb.lobbyOpen = !!memoryDb.config.lobbyOpen
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
  if (data) {
    const config = withLobbyFields(data.config)
    if (config.roomCode !== data.config?.roomCode || !!data.config?.lobbyOpen !== config.lobbyOpen) {
      await client
        .from('matrix_meta')
        .update({ config, updated_at: new Date().toISOString() })
        .eq('id', 1)
    }
    return { ...data, config }
  }
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

  const config = withLobbyFields(meta.config)
  return {
    competitionId,
    roomCode: config.roomCode,
    lobbyOpen: !!config.lobbyOpen,
    config,
    runs,
    drafts,
    sessions,
  }
}

/** Meta only — fast path for lobby/config/auth. */
export async function getMetaState() {
  if (!usingSupabase()) {
    const d = fileLoad()
    return {
      competitionId: d.competitionId,
      roomCode: d.roomCode || d.config.roomCode,
      lobbyOpen: !!d.lobbyOpen,
      config: withLobbyFields(d.config),
    }
  }
  const meta = await ensureMeta()
  const config = withLobbyFields(meta.config)
  return {
    competitionId: meta.competition_id,
    roomCode: config.roomCode,
    lobbyOpen: !!config.lobbyOpen,
    config,
  }
}

export async function getRunById(runId) {
  if (!usingSupabase()) {
    return fileLoad().runs[runId] || null
  }
  const client = sb()
  const { data, error } = await client
    .from('matrix_runs')
    .select('data')
    .eq('run_id', runId)
    .maybeSingle()
  if (error) throw new Error(`Supabase get run: ${error.message}`)
  return data?.data || null
}

export async function getDraftFor(runId, round) {
  if (!usingSupabase()) {
    return fileLoad().drafts[`${runId}:${round}`] || null
  }
  const client = sb()
  const { data, error } = await client
    .from('matrix_drafts')
    .select('allocations')
    .eq('run_id', runId)
    .eq('round', round)
    .maybeSingle()
  if (error) throw new Error(`Supabase get draft: ${error.message}`)
  return data?.allocations ?? null
}

export async function sessionExists(token) {
  if (!token) return false
  if (!usingSupabase()) {
    return Boolean(fileLoad().sessions?.[token])
  }
  const client = sb()
  const { data, error } = await client
    .from('matrix_sessions')
    .select('token')
    .eq('token', token)
    .maybeSingle()
  if (error) throw new Error(`Supabase session: ${error.message}`)
  return Boolean(data)
}

export async function listCompletedRuns(competitionId) {
  if (!usingSupabase()) {
    return Object.values(fileLoad().runs).filter((r) => r.status === 'COMPLETED')
  }
  const client = sb()
  const { data, error } = await client
    .from('matrix_runs')
    .select('data')
    .eq('competition_id', competitionId)
    .eq('status', 'COMPLETED')
  if (error) throw new Error(`Supabase list completed: ${error.message}`)
  return (data || []).map((r) => r.data)
}

/** All runs for the active competition (for live board). */
export async function listCompetitionRuns(competitionId) {
  if (!usingSupabase()) {
    return Object.values(fileLoad().runs)
  }
  const client = sb()
  const { data, error } = await client
    .from('matrix_runs')
    .select('data')
    .eq('competition_id', competitionId)
  if (error) throw new Error(`Supabase list competition runs: ${error.message}`)
  return (data || []).map((r) => r.data)
}

export async function getLiveBoardState() {
  if (!usingSupabase()) {
    const d = fileLoad()
    return d.liveBoard || d.config?.liveBoard || null
  }
  const meta = await ensureMeta()
  return meta.config?.liveBoard || null
}

export async function saveLiveBoardState(liveBoard) {
  const meta = await getMetaState()
  const config = withLobbyFields({ ...meta.config, liveBoard })
  if (!usingSupabase()) {
    const d = fileLoad()
    d.liveBoard = liveBoard
    d.config = config
    fileSave(d)
    return liveBoard
  }
  await saveConfig(config, meta.competitionId)
  return liveBoard
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
  const next = withLobbyFields(config)
  if (!usingSupabase()) {
    const d = fileLoad()
    d.config = next
    d.roomCode = next.roomCode
    d.lobbyOpen = !!next.lobbyOpen
    fileSave(d)
    return next
  }
  const client = sb()
  const meta = await ensureMeta()
  const { error } = await client.from('matrix_meta').upsert({
    id: 1,
    competition_id: competitionId || meta.competition_id,
    config: next,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Supabase save config: ${error.message}`)
  return next
}

export async function setLobbyOpen(open) {
  const meta = await getMetaState()
  const config = withLobbyFields(meta.config)
  config.lobbyOpen = !!open
  await saveConfig(config, meta.competitionId)
  if (!usingSupabase()) {
    const d = fileLoad()
    d.lobbyOpen = !!open
    d.roomCode = config.roomCode
    fileSave(d)
  }
  return { roomCode: config.roomCode, lobbyOpen: !!open, competitionId: meta.competitionId }
}

/** New competition — old runs archived by competition_id. Keeps admin sessions. */
export async function resetCompetition() {
  const newId = randomUUID()
  const roomCode = generateRoomCode()
  if (!usingSupabase()) {
    const d = fileLoad()
    d.competitionId = newId
    d.runs = {}
    d.drafts = {}
    d.config = withLobbyFields({ ...d.config, roomCode, lobbyOpen: false })
    d.roomCode = roomCode
    d.lobbyOpen = false
    fileSave(d)
    return { competitionId: newId, roomCode, lobbyOpen: false }
  }
  const client = sb()
  const meta = await ensureMeta()
  const config = withLobbyFields({ ...meta.config, roomCode, lobbyOpen: false })
  const { error } = await client.from('matrix_meta').upsert({
    id: 1,
    competition_id: newId,
    config,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Supabase reset: ${error.message}`)
  return { competitionId: newId, roomCode, lobbyOpen: false }
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
