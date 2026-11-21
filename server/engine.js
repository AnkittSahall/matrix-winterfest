/** Calculation engine — Section 5 of the FINAL spec */

export function resolveRound({ pool, scenarioId, allocations, factorLookup }) {
  const invested = round2(allocations.reduce((s, a) => s + a.amountM, 0))
  if (invested > pool + 1e-9) {
    throw new Error('ALLOCATION_OVER_POOL')
  }

  let profit = 0
  const countryProfits = []
  for (const a of allocations) {
    const f = factorLookup(scenarioId, a.countryCode, a.modeCode)
    if (f == null) throw new Error(`Missing factor ${scenarioId}/${a.countryCode}/${a.modeCode}`)
    const p = round2(a.amountM * (f - 1))
    countryProfits.push({ countryCode: a.countryCode, profitM: p })
    profit += p
  }
  profit = round2(profit)
  const idle = round2(pool - invested)
  return { investedM: invested, idleM: idle, profitM: profit, countryProfits }
}

export function nextPool({ budgetMode, startBudgetM, pool, profitM }) {
  if (budgetMode === 'B') return round2(Math.max(0, pool + profitM))
  return round2(startBudgetM)
}

/** Scale amounts proportionally to fit pool (auto-lock). */
export function scaleToPool(allocations, pool) {
  const cleaned = allocations
    .filter((a) => a.modeCode && a.modeCode !== 'NONE' && a.amountM > 0)
    .map((a) => ({ ...a, amountM: Number(a.amountM) }))
  const total = cleaned.reduce((s, a) => s + a.amountM, 0)
  if (total <= 0) return []
  if (total <= pool + 1e-9) {
    return cleaned.map((a) => ({ ...a, amountM: round2(a.amountM) }))
  }
  const scale = pool / total
  return cleaned.map((a) => ({ ...a, amountM: round2(a.amountM * scale) }))
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Section 5.3 worked example check */
export function workedExample(factorLookup) {
  const pool = 100
  const allocations = [
    { countryCode: 'IND', modeCode: 'WHOLLY_OWNED', amountM: 30 },
    { countryCode: 'AUS', modeCode: 'JOINT_VENTURE', amountM: 20 },
    { countryCode: 'EGY', modeCode: 'FRANCHISING', amountM: 10 },
  ]
  return resolveRound({ pool, scenarioId: 1, allocations, factorLookup })
}
