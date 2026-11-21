# MatriX Market Entry Simulation: seed data

Load these files into the database. Full rules are in MatriX_Simulation_Workflow_Spec_FINAL.docx.

- factors.csv / factors.json: 198 rows (6 scenarios x 11 countries x 3 modes). SERVER ONLY. Never send to the browser.
- news.json: full news text per scenario, in display order. Show as paragraphs with a bold headline, no bullets.
- countries.json: qualitative attributes and economic indicators, plus home country (USA).
- entry_modes.json: reference table for the three entry modes (display only).
- glossary.json: draft definitions, need client sign-off.

Scenario = content set 1..6 from the factor sheet. Round = nth turn a team plays. Players see rounds only.
Profit per allocation line = amount * (multiplier - 1).
