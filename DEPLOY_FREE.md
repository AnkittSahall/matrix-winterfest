# Free deploy plan (15 teams · Vercel Hobby · no paid tools)

## How admin sees results

1. Open `/admin` → login  
2. **Competition results** table = live leaderboard (rank by total profit)  
3. **Download Excel (.csv)** → opens in Microsoft Excel / Google Sheets  

Every team that finishes all rounds is stored on the **shared server**, not only on their laptop.

## Why not “only Vercel + local file”?

Vercel free serverless has **no lasting disk**. A JSON file on the server will not reliably hold 15 teams’ results across requests.

So for competition day use this free stack:

| Piece | Free tool | Role |
|--------|-----------|------|
| Website | Vercel Hobby | Player UI |
| API + factors | Same project / small Node host | Scoring (factors stay secret) |
| Shared results | **Google Sheet** (recommended) or Supabase free | All 15 teams in one place |

15 teams ≈ almost no traffic. Vercel free limits will not be the problem if results live in a Sheet/DB.

## Recommended: Google Sheet mirror (feels like Excel)

1. Create a Google Sheet with headers:  
   `Rank, Company, TotalProfitM, FinalPoolM, Rounds, BudgetMode, CompletedAt, RunId`
2. Extensions → Apps Script → paste:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const d = JSON.parse(e.postData.contents);
  sheet.appendRow([
    d.rank || '',
    d.companyName || '',
    d.totalProfitM || '',
    d.finalPoolM || '',
    d.roundsPlayed || '',
    d.budgetMode || '',
    d.completedAt || '',
    d.runId || '',
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Deploy → Web app → Anyone → copy URL  
4. Set env: `RESULTS_SHEET_WEBHOOK=<that url>`  
5. When a team finishes, a row is appended. You can also still use **Download Excel** from `/admin`.

## Competition day checklist

- [ ] One shared URL for all teams  
- [ ] Teams use clear company names (e.g. `Team Alpha`)  
- [ ] Admin keeps `/admin` open → Refresh results  
- [ ] Download Excel before announcing winners  
- [ ] Optional: watch the Google Sheet live as a backup board  

## Local today

`npm run dev` — admin results + Excel download already work on the local API store.
