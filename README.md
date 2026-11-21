# MatriX Market Entry Simulation

XIME Bengaluru · MatriX Consulting Club

Harvard-style market entry sim for Winterfest. Factors stay server-side only.

## Local

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001
- Admin: `/admin` (default passcode `matrix2026`)

## Deploy

Push to GitHub, then import the repo on [Vercel](https://vercel.com). Set env:

- `ADMIN_PASSCODE` — admin login

Free serverless storage is ephemeral (fine for demos). For a live 15-team competition, add a shared store (Supabase / Google Sheet webhook).
