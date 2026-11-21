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
  const mk = (name, profits, lockedAts = [], status = 'IN_PROGRESS', pool = 100) => ({
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

  it('exposes prevRank from lastRanks', () => {
    const teams = rankLiveTeams([mk('A', [1])], 1, { A: 3 }, 2, 'A')
    assert.equal(teams[0].prevRank, 3)
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
          companyName: 'Team One',
          status: 'IN_PROGRESS',
          currentRound: 1,
          currentPoolM: 100,
          createdAt: '2026-01-01T00:00:00.000Z',
          history: [],
        },
      ],
      recentSubmitters: ['Team One'],
    })
    const pub = publicLivePayload(payload)
    const json = JSON.stringify(pub)
    assert.equal(json.includes('scenario'), false)
    assert.equal(json.includes('factor'), false)
    assert.equal(json.includes('allocation'), false)
    assert.equal(json.includes('runId'), false)
    assert.equal(json.includes('_meta'), false)
    assert.equal(pub.progress.total, 1)
    assert.equal(pub.progress.submitted, 0)
  })

  it('respects resetAt filter', () => {
    const payload = buildLivePayload({
      config: { numRounds: 2, budgetMode: 'A', startBudgetM: 100 },
      liveBoard: { revealedRound: 0, resetAt: '2026-06-01T00:00:00.000Z' },
      runs: [
        {
          companyName: 'Old',
          status: 'IN_PROGRESS',
          createdAt: '2026-01-01T00:00:00.000Z',
          history: [{ round: 1, profitM: 9, lockedAt: '2026-01-01T01:00:00.000Z' }],
        },
        {
          companyName: 'New',
          status: 'IN_PROGRESS',
          createdAt: '2026-07-01T00:00:00.000Z',
          history: [],
        },
      ],
    })
    assert.equal(payload.progress.total, 1)
    assert.deepEqual(payload.progress.lobbyNames, ['New'])
  })
})
