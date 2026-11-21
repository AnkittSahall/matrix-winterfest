import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankLiveTeams,
  buildLivePayload,
  publicLivePayload,
  truncateName,
  hasLockedRound,
} from './liveBoard.js'

describe('truncateName', () => {
  it('keeps short names', () => {
    assert.equal(truncateName('Alpha'), 'Alpha')
  })
  it('truncates long names', () => {
    const s = truncateName('ABCDEFGHIJKLMNOPQRSTUVWXYZ1234')
    assert.equal(s.length, 28)
    assert.ok(s.endsWith('…'))
  })
})

describe('rankLiveTeams', () => {
  const mk = (name, profits, lockedAts = [], status = 'IN_PROGRESS', pool = 100, runId) => ({
    runId: runId || `run-${name}`,
    companyName: name,
    status,
    currentPoolM: pool,
    history: profits.map((profitM, i) => ({
      round: i + 1,
      profitM,
      lockedAt: lockedAts[i] || `2026-01-0${i + 1}T10:00:00.000Z`,
    })),
  })

  it('ranks by total revealed profit descending', () => {
    const teams = rankLiveTeams(
      [mk('A', [1, 2]), mk('B', [5, 0]), mk('C', [3, 3])],
      2,
      {},
      3,
      'A',
    )
    assert.deepEqual(
      teams.map((t) => t.companyName),
      ['C', 'B', 'A'],
    )
    assert.equal(teams[0].totalProfit, 6)
    assert.equal(teams[1].totalProfit, 5)
    assert.equal(teams[2].totalProfit, 3)
  })

  it('nulls unrevealed rounds', () => {
    const teams = rankLiveTeams([mk('A', [4, 9, 1])], 1, {}, 3, 'A')
    assert.deepEqual(teams[0].roundProfits, [4, null, null])
    assert.equal(teams[0].totalProfit, 4)
  })

  it('tie-breaks by latest revealed profit then earlier lock', () => {
    const teams = rankLiveTeams(
      [
        mk('Late', [10], ['2026-01-01T12:00:00.000Z']),
        mk('Early', [10], ['2026-01-01T11:00:00.000Z']),
        mk('HigherR1', [11], ['2026-01-01T13:00:00.000Z']),
      ],
      1,
      {},
      2,
      'A',
    )
    assert.deepEqual(
      teams.map((t) => t.companyName),
      ['HigherR1', 'Early', 'Late'],
    )
  })

  it('shares rank on full ties', () => {
    const t = '2026-01-01T10:00:00.000Z'
    const teams = rankLiveTeams(
      [mk('A', [5], [t]), mk('B', [5], [t]), mk('C', [1], [t])],
      1,
      {},
      2,
      'A',
    )
    assert.equal(teams[0].rank, 1)
    assert.equal(teams[1].rank, 1)
    assert.equal(teams[2].rank, 3)
  })

  it('includes poolM only for mode B', () => {
    const a = rankLiveTeams([mk('A', [1], [], 'IN_PROGRESS', 105.5)], 1, {}, 2, 'A')
    const b = rankLiveTeams([mk('A', [1], [], 'IN_PROGRESS', 105.5)], 1, {}, 2, 'B')
    assert.equal(a[0].poolM, undefined)
    assert.equal(b[0].poolM, 105.5)
  })

  it('exposes prevRank from lastRanks by run id', () => {
    const teams = rankLiveTeams([mk('A', [1], [], 'IN_PROGRESS', 100, 'id-a')], 1, { 'id-a': 3 }, 2, 'A')
    assert.equal(teams[0].prevRank, 3)
  })

  it('keeps duplicate company names as separate ranked rows', () => {
    const teams = rankLiveTeams(
      [mk('kk', [10], [], 'IN_PROGRESS', 100, 'r1'), mk('kk', [5], [], 'IN_PROGRESS', 100, 'r2')],
      1,
      {},
      2,
      'A',
    )
    assert.equal(teams.length, 2)
    assert.equal(teams[0].rank, 1)
    assert.equal(teams[1].rank, 2)
    assert.notEqual(teams[0].id, teams[1].id)
    assert.ok(teams[0].companyName.includes('kk'))
    assert.ok(teams[1].companyName.includes('kk'))
  })
})

describe('hasLockedRound', () => {
  it('detects locked history', () => {
    assert.equal(hasLockedRound({ history: [{ round: 2 }] }, 2), true)
    assert.equal(hasLockedRound({ history: [{ round: 1 }] }, 2), false)
  })
})

describe('buildLivePayload', () => {
  it('omits secrets from public payload', () => {
    const payload = buildLivePayload({
      config: { numRounds: 3, budgetMode: 'A', startBudgetM: 100 },
      liveBoard: { revealedRound: 0 },
      runs: [
        {
          runId: 't1',
          companyName: 'Team One',
          status: 'IN_PROGRESS',
          currentRound: 1,
          currentPoolM: 100,
          createdAt: '2026-01-01T00:00:00.000Z',
          history: [{ round: 1, profitM: 1, lockedAt: '2026-01-01T01:00:00.000Z' }],
        },
      ],
      recentSubmitters: ['Team One'],
    })
    const pub = publicLivePayload(payload)
    const json = JSON.stringify(pub)
    assert.equal(json.includes('scenario'), false)
    assert.equal(json.includes('factor'), false)
    assert.equal(json.includes('allocation'), false)
    assert.equal(json.includes('_meta'), false)
    assert.equal(pub.progress.total, 1)
    assert.equal(pub.progress.submitted, 1)
  })

  it('reset does not hide existing competition teams', () => {
    const payload = buildLivePayload({
      config: { numRounds: 2, budgetMode: 'A', startBudgetM: 100 },
      liveBoard: { revealedRound: 1, resetAt: null },
      runs: [
        {
          runId: 'old-1',
          companyName: 'Old',
          status: 'IN_PROGRESS',
          createdAt: '2026-01-01T00:00:00.000Z',
          history: [{ round: 1, profitM: 9, lockedAt: '2026-01-01T01:00:00.000Z' }],
        },
        {
          runId: 'new-1',
          companyName: 'New',
          status: 'IN_PROGRESS',
          createdAt: '2026-07-01T00:00:00.000Z',
          history: [{ round: 1, profitM: 2, lockedAt: '2026-07-01T01:00:00.000Z' }],
        },
      ],
    })
    assert.equal(payload.progress.total, 2)
    assert.equal(payload.teams[0].companyName, 'Old')
    assert.equal(payload.teams[0].totalProfit, 9)
  })
})
