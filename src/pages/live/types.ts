export type LiveHighlight = {
  companyName: string
  delta?: number
  from?: number
  to?: number
  profit?: number
  round?: number
} | null

export type LiveTeam = {
  companyName: string
  rank: number
  prevRank: number | null
  roundProfits: (number | null)[]
  totalProfit: number
  poolM?: number
}

export type LiveState = {
  event: {
    numRounds: number
    budgetMode: 'A' | 'B'
    startBudgetM: number
    revealedRound: number
    registrationLocked: boolean
    soundOn: boolean
    showTicker: boolean
    championShown: boolean
    statusLabel: string
  }
  progress: {
    round: number
    submitted: number
    total: number
    recentSubmitters: string[]
    lobbyNames: string[]
  }
  teams: LiveTeam[]
  highlights: {
    biggestMover: LiveHighlight
    biggestDrop: LiveHighlight
    bestRound: LiveHighlight
    worstRound: LiveHighlight
  }
}
