# Home Construction Estimator

Upload a house plan set (PDF), take off quantities by hand or with AI, price them against your own price list, and produce a client proposal and an internal Excel workbook.

This is a standalone app. It shares the repository with the O‘ahu Travel app but has its own `package.json`, build and deployment.

## What it does

| Area | Details |
| --- | --- |
| **Plan upload** | Drag in the full PDF plan set. The file is stored in the browser (IndexedDB), with page thumbnails and sheet numbers. |
| **Manual takeoff** | Set the scale per sheet (printed-scale presets, or calibrate by clicking a known dimension). Then measure **Length** (LF), **Area** (SF) and **Count** (EA) on the sheet. A multiplier handles wall height or both sides. Link measurements to estimate lines and the quantities stay live. |
| **AI takeoff** | Claude reads each selected sheet: a full-page image, four zoomed quadrants in high-detail mode, and the PDF text layer. It reports roof, electrical, plumbing, cabinet, flooring and other quantities, with how it got each number and a confidence level. A second pass removes cross-sheet duplicates and matches lines to **your** price-list codes. You review the result and add it to the estimate. |
| **Price list** | Your own unit costs (material, labor, waste %) by code. Import CSV/XLSX (download the template from the Price List page), export, edit inline. Categories are editable, so custom upgrades can get their own trades. |
| **Estimate** | Lines grouped by trade, with waste, material and labor extensions, overhead, profit, contingency, tax (defaults to O‘ahu GET 4.712%), and cost per SF. |
| **Outputs** | Client proposal (print → Save as PDF), Excel workbook (Summary with formulas, Detail, Takeoff log, Price List), CSV. |
| **Saved projects** | Every job autosaves in the browser. **Backup** downloads a `.estimate.json` with the PDF included, and **Import backup** restores it on another computer. |

## Run locally

```bash
cd estimator
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for AI takeoff
npm run dev
```

The AI endpoints (`/api/analyze-page`, `/api/consolidate`) run inside the Vite dev server, so you don't need a separate backend locally. Manual takeoff, pricing and proposals work without an API key.

## Deploy (Vercel)

1. Import the repo in Vercel and set **Root Directory** to `estimator`.
2. Add the environment variable `ANTHROPIC_API_KEY` (server-side only; never prefix it with `VITE_`).
3. Deploy. The files in `api/` become serverless functions (`maxDuration` is 300s in `vercel.json`).

## AI cost and accuracy notes

- Model: `claude-opus-5-5` with adaptive thinking at high effort and structured JSON output. Server-side refusal fallback is enabled.
- Each sheet is one request, run three at a time. High-detail mode sends five images per sheet instead of one. It's more expensive but much better at counting outlets and fixtures.
- Vector (CAD-exported) PDFs give the best results because dimensions and schedules come through as text. Scanned sets work, but they rely on the images alone.
- Treat AI quantities as a first draft. Lines show their basis, source sheets and confidence, and the "Verify / ask about" list flags gaps such as a missing roof plan.

## Project layout

```
api/                 Vercel functions (Claude calls, prompts, JSON schemas)
src/lib/             types, IndexedDB storage, cost math, PDF rendering, AI client, Excel/CSV
src/components/      plan viewer + measuring tools, AI panel, shared UI
src/views/           Projects, Plans & Takeoff, Estimate, Proposal, Job Details, Price List, Company
```
