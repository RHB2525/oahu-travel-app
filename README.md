# O‘ahu Travel

Personal mobile-first trip companion for O‘ahu — saved places, day-by-day itinerary with drive times, and on-the-spot photo memories with captions.

## Stack

- React + Vite + TypeScript + Tailwind + shadcn/ui helpers
- Supabase (auth, Postgres, storage)
- `@vis.gl/react-google-maps` (Maps JS, Places, Directions)

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

## Required env vars

| Var                      | Where to get it                                          |
| ------------------------ | -------------------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Cloud → APIs & Services → Credentials             |
| `VITE_SUPABASE_URL`      | Supabase project settings → API                          |
| `VITE_SUPABASE_ANON_KEY` | Supabase project settings → API (publishable key)        |

## Deploying

Push to GitHub, import in Vercel, set the three env vars in Vercel's dashboard. Then add the Vercel domain to:
- Google Cloud → API key → HTTP referrer restrictions
- Supabase → Auth → URL Configuration → Site URL + Redirect URLs

## Home Construction Estimator

A separate app lives in [`estimator/`](estimator/README.md): upload a house plan set PDF, do manual or AI quantity takeoff, price it against your own price list, and print a client proposal or export to Excel.
