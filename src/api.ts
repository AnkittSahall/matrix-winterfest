export type PublicConfig = {
  numRounds: number
  startBudgetM: number
  budgetMode: 'A' | 'B'
  timerEnabled: boolean
  timerMinutes: number | null
}

export type RunView = {
  runId: string
  companyName: string
  status: 'BRIEFING' | 'IN_PROGRESS' | 'COMPLETED'
  currentRound: number
  numRounds: number
  phase: 'NEWS' | 'DECISION' | 'RESULT' | null
  currentPoolM: number
  cumulativeProfitM: number
  budgetMode: 'A' | 'B'
  startBudgetM: number
  timerEnabled: boolean
  alertMinutes: number
  roundStartedAt: string | null
  roundDeadlineAt: string | null
  alertShown: boolean
  history: {
    round: number
    openingPoolM: number
    investedM: number
    idleM: number
    profitM: number
    closingPoolM: number
    cumulativeProfitM: number
    autoLocked: boolean
    timeUsedSec: number
    allocations: AllocationRow[]
  }[]
  lastLockedAllocations: AllocationRow[] | null
  finished?: boolean
}

export type AllocationRow = {
  countryCode: string
  modeCode: string
  amountM: number
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data as T
}

export const api = {
  health: () => req<{ ok: boolean; engineCheck: { profitM: number } }>('/api/health'),
  publicConfig: () => req<PublicConfig>('/api/config/public'),
  countries: () => req<{ home: Record<string, unknown>; countries: Country[] }>('/api/reference/countries'),
  entryModes: () => req<EntryMode[]>('/api/reference/entry-modes'),
  glossary: () => req<{ term: string; definition: string }[]>('/api/reference/glossary'),
  lobby: () => req<{ open: boolean; message: string }>('/api/lobby'),
  createRun: (companyName: string) =>
    req<RunView>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ companyName }),
    }),
  listRuns: () =>
    req<
      { runId: string; companyName: string; completedAt: string; roundsPlayed: number; totalProfitM: number }[]
    >('/api/runs'),
  getRun: (id: string) => req<RunView>(`/api/runs/${id}`),
  start: (id: string) => req<RunView>(`/api/runs/${id}/start`, { method: 'POST', body: '{}' }),
  news: (id: string) =>
    req<{ round: number; numRounds: number; title: string; items: { order: number; headline: string; body: string }[] }>(
      `/api/runs/${id}/news`,
    ),
  getDraft: (id: string) =>
    req<{ round: number; poolM: number; allocations: AllocationRow[] }>(`/api/runs/${id}/draft`),
  saveDraft: (id: string, allocations: AllocationRow[]) =>
    req<{ ok: boolean }>(`/api/runs/${id}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ allocations }),
    }),
  toDecision: (id: string) => req<RunView>(`/api/runs/${id}/phase`, { method: 'POST', body: '{}' }),
  lock: (id: string, allocations: AllocationRow[]) =>
    req<RunView>(`/api/runs/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ allocations }),
    }),
  next: (id: string) => req<RunView>(`/api/runs/${id}/next`, { method: 'POST', body: '{}' }),
  alertShown: (id: string) =>
    req<{ ok: boolean }>(`/api/runs/${id}/alert-shown`, { method: 'POST', body: '{}' }),
  adminLogin: (passcode: string) =>
    req<{ ok: boolean }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),
  adminConfig: () => req<AdminConfig>('/api/admin/config'),
  saveAdminConfig: (body: Record<string, unknown>) =>
    req<{ config: AdminConfig; summary: string }>('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  adminResults: () =>
    req<{
      generatedAt: string
      competitionId?: string
      count: number
      results: AdminResultRow[]
    }>('/api/admin/results'),
  resetCompetition: () =>
    req<{ ok: boolean; competitionId: string; roomCode: string; lobbyOpen: boolean }>(
      '/api/admin/reset-competition',
      {
        method: 'POST',
        body: '{}',
      },
    ),
  setLobby: (open: boolean) =>
    req<{ ok: boolean; roomCode: string; lobbyOpen: boolean; competitionId: string }>(
      '/api/admin/lobby',
      {
        method: 'POST',
        body: JSON.stringify({ open }),
      },
    ),
}

export type AdminResultRow = {
  rank: number
  runId: string
  companyName: string
  completedAt: string | null
  createdAt: string
  roundsPlayed: number
  totalProfitM: number
  finalPoolM: number
  budgetMode: 'A' | 'B'
  startBudgetM: number
}

export type Country = {
  code: string
  name: string
  countryRisk: string
  tradeBarriers: string | null
  industryRivalry: string
  culturalDistance: string | null
  indulgence: string
  gdpPerCapita: number
  gdpGrowthPct: number
  popGrowthPct: number
}

export type EntryMode = {
  code: string
  name: string
  outletsOnEntry: number
  entryCostUsd: number
  outletCostToYouUsd: number
  revenueModel: string
  ongoingCost: string | null
  notes: string | null
}

export type AdminConfig = {
  numRounds: number
  sequence: number[]
  startBudgetM: number
  budgetMode: 'A' | 'B'
  timerEnabled: boolean
  timerMinutes: number
  alertMinutes: number
  scenarios: { scenarioId: number; title: string }[]
  version?: number
  competitionId?: string
  roomCode?: string
  lobbyOpen?: boolean
}
