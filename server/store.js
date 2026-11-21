import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED = path.join(__dirname, 'seed_data')
const onVercel = Boolean(process.env.VERCEL)
const STORE_PATH = onVercel
  ? path.join('/tmp', 'matrix-sim-db.json')
  : path.join(__dirname, 'store', 'db.json')

let memoryDb = null

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function defaultConfig() {
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
    config: defaultConfig(),
    runs: {},
    drafts: {},
    sessions: {},
  }
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

export function loadDb() {
  if (memoryDb) return memoryDb
  try {
    if (fs.existsSync(STORE_PATH)) {
      memoryDb = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
      return memoryDb
    }
  } catch {
    // fall through to empty
  }
  memoryDb = emptyDb()
  saveDb(memoryDb)
  return memoryDb
}

export function saveDb(db) {
  memoryDb = db
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2))
  } catch (err) {
    console.warn('Could not persist db to disk:', err.message)
  }
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

export { defaultConfig, randomUUID }
