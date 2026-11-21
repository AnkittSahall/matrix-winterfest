/** Live Result Screen — ranking + payload (server-only). No factors/scenarios/allocations. */

export function defaultLiveBoard() {
  return {
    revealedRound: 0,
    registrationLocked: false,
    soundOn: false,
    showTicker: true,
    resetAt: null,
    championShown: false,
    lastRanks: {},
  }
}

export function normalizeLiveBoard(raw) {
  const d = defaultLiveBoard()
  if (!raw || typeof raw !== 'object') return d
  return {
    revealedRound: Math.max(0, Number(raw.revealedRound) || 0),
    registrationLocked: !!raw.registrationLocked,
    soundOn: !!raw.soundOn,
    showTicker: raw.showTicker !== false,
    resetAt: raw.resetAt || null,
    championShown: !!raw.championShown,
    lastRanks: raw.lastRanks && typeof raw.lastRanks === 'object' ? { ...raw.lastRanks } : {},
  }
}

export function truncateName(name, max = 28) {
  const s = String(name || '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

/**
 * Rank by total of revealed round profits (desc).
 * Tie-break: higher latest-revealed-round profit, then earlier lockedAt of that round.
 * Ties share the same rank number.
 */
export function rankLiveTeams(runs, revealedRound, prevRanks = {}, numRounds = 6, budgetMode = 'A') {
  const players = (runs || []).filter(
    (r) => r.status === 'IN_PROGRESS' || r.status === 'COMPLETED',
  )

  const rows = players.map((r) => {
    const history = Array.isArray(r.history) ? r.history : []
    const byRound = new Map(history.map((h) => [h.round, h]))
    const roundProfits = []
    let totalProfit = 0
    let latestRevealedProfit = 0
    let latestLockedAt = null

    for (let round = 1; round <= numRounds; round++) {
      if (round > revealedRound) {
        roundProfits.push(null)
        continue
      }
      const h = byRound.get(round)
      const profit = h ? Number(h.profitM) || 0 : 0
      roundProfits.push(Math.round((profit + Number.EPSILON) * 100) / 100)
      totalProfit += profit
      if (round === revealedRound) {
        latestRevealedProfit = profit
        latestLockedAt = h?.lockedAt || null
      }
    }

    return {
      companyName: r.companyName,
      displayName: truncateName(r.companyName),
      roundProfits,
      totalProfit: Math.round((totalProfit + Number.EPSILON) * 100) / 100,
      latestRevealedProfit,
      latestLockedAt,
      poolM: budgetMode === 'B' ? Number(r.currentPoolM) || 0 : null,
    }
  })

  rows.sort((a, b) => {
    if (b.totalProfit !== a.totalProfit) return b.totalProfit - a.totalProfit
    if (b.latestRevealedProfit !== a.latestRevealedProfit) {
      return b.latestRevealedProfit - a.latestRevealedProfit
    }
    const aT = a.latestLockedAt ? new Date(a.latestLockedAt).getTime() : Number.POSITIVE_INFINITY
    const bT = b.latestLockedAt ? new Date(b.latestLockedAt).getTime() : Number.POSITIVE_INFINITY
    if (aT !== bT) return aT - bT
    return String(a.companyName).localeCompare(String(b.companyName))
  })

  const out = []
  let currentRank = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const tied =
      i > 0 &&
      row.totalProfit === rows[i - 1].totalProfit &&
      row.latestRevealedProfit === rows[i - 1].latestRevealedProfit &&
      (row.latestLockedAt || '') === (rows[i - 1].latestLockedAt || '')
    if (!tied) currentRank = i + 1

    const team = {
      companyName: row.displayName,
      fullName: row.companyName,
      rank: currentRank,
      prevRank: prevRanks[row.companyName] ?? null,
      roundProfits: row.roundProfits,
      totalProfit: row.totalProfit,
    }
    if (budgetMode === 'B') {
      team.poolM = Math.round((row.poolM + Number.EPSILON) * 100) / 100
    }
    out.push(team)
  }
  return out
}

export function computeHighlights(teams, revealedRound) {
  if (!revealedRound || !teams?.length) {
    return { biggestMover: null, biggestDrop: null, bestRound: null, worstRound: null }
  }

  let biggestMover = null
  let biggestDrop = null
  let bestRound = null
  let worstRound = null

  for (const t of teams) {
    const profit = t.roundProfits?.[revealedRound - 1]
    if (typeof profit === 'number') {
      if (!bestRound || profit > bestRound.profit) {
        bestRound = { companyName: t.companyName, profit, round: revealedRound }
      }
      if (!worstRound || profit < worstRound.profit) {
        worstRound = { companyName: t.companyName, profit, round: revealedRound }
      }
    }
    if (t.prevRank != null && t.rank != null) {
      const delta = t.prevRank - t.rank
      if (delta > 0 && (!biggestMover || delta > biggestMover.delta)) {
        biggestMover = { companyName: t.companyName, delta, from: t.prevRank, to: t.rank }
      }
      if (delta < 0 && (!biggestDrop || delta < biggestDrop.delta)) {
        biggestDrop = { companyName: t.companyName, delta, from: t.prevRank, to: t.rank }
      }
    }
  }

  return { biggestMover, biggestDrop, bestRound, worstRound }
}

export function hasLockedRound(run, round) {
  return (run.history || []).some((h) => h.round === round)
}

export function ranksMapFromTeams(teams) {
  const map = {}
  for (const t of teams || []) {
    const key = t.fullName || t.companyName
    map[key] = t.rank
  }
  return map
}

/** Public live payload — never includes factors, scenarios, allocations, or run ids. */
export function buildLivePayload({ config, liveBoard, runs, recentSubmitters = [] }) {
  const board = normalizeLiveBoard(liveBoard)
  const numRounds = Number(config?.numRounds) || 6
  const budgetMode = config?.budgetMode === 'B' ? 'B' : 'A'
  const startBudgetM = Number(config?.startBudgetM) || 100
  const revealedRound = Math.min(Math.max(0, board.revealedRound), numRounds)

  const resetAtMs = board.resetAt ? new Date(board.resetAt).getTime() : 0
  const eventRuns = (runs || []).filter((r) => {
    if (resetAtMs && r.createdAt && new Date(r.createdAt).getTime() < resetAtMs) return false
    return true
  })

  const active = eventRuns.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'COMPLETED')
  const lobby = eventRuns.filter(
    (r) => r.status === 'BRIEFING' || r.status === 'IN_PROGRESS' || r.status === 'COMPLETED',
  )

  const ranked = rankLiveTeams(active, revealedRound, board.lastRanks, numRounds, budgetMode)
  const teams = ranked.map(({ fullName: _f, ...rest }) => rest)
  const highlights =
    revealedRound > 0
      ? computeHighlights(teams, revealedRound)
      : { biggestMover: null, biggestDrop: null, bestRound: null, worstRound: null }

  let progressRound = Math.min(revealedRound + 1, numRounds)
  let statusLabel = 'Waiting for teams'

  if (active.length === 0) {
    statusLabel = lobby.length ? `${lobby.length} team(s) ready` : 'Waiting for teams'
    progressRound = 1
  } else if (revealedRound >= numRounds) {
    statusLabel = 'Final results'
    progressRound = numRounds
  } else {
    const next = revealedRound + 1
    progressRound = next
    const allLocked = active.every((r) => hasLockedRound(r, next))
    statusLabel = allLocked ? `Round ${next} ready to reveal` : `Round ${next} in progress`
  }

  const submittedCount = active.filter((r) => hasLockedRound(r, progressRound)).length

  return {
    event: {
      numRounds,
      budgetMode,
      startBudgetM,
      revealedRound,
      registrationLocked: board.registrationLocked,
      soundOn: board.soundOn,
      showTicker: board.showTicker,
      championShown: board.championShown,
      statusLabel,
    },
    progress: {
      round: progressRound,
      submitted: submittedCount,
      total: active.length,
      recentSubmitters: (recentSubmitters || []).slice(0, 8).map(truncateName),
      lobbyNames: lobby.map((r) => truncateName(r.companyName)),
    },
    teams,
    highlights,
    _meta: { ranksForSave: ranksMapFromTeams(ranked) },
  }
}

export function publicLivePayload(payload) {
  if (!payload) return payload
  const { _meta, ...rest } = payload
  return rest
}
