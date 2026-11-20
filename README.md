# Portfolio site

Interactive portfolio featuring a rigged Spider-Man character, cursor tracking,
voice reactions, and a character-driven shutter transition between chapters.
Portfolio chapters cover Ved Patel's projects, background, skills, and contact
details, based on his resume. CGPA is intentionally omitted; the original resume
PDF is not published.

## Run locally

Use Node.js 22.x (22.13 or newer) and npm:

```sh
npm ci
npm run build
npm run start -- --port 8787
```

Open http://127.0.0.1:8787. For development, use `npm run dev`.

## Deploy to Vercel

Import this repository, select branch `main`, and leave Root Directory as `./`.
The committed `vercel.json` supplies these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist/client` |
| Node.js | 22.x |

No manually configured environment variables or API keys are required. Keep
Vercel's automatic system environment variables enabled: sharing metadata uses
`VERCEL_PROJECT_PRODUCTION_URL`, falling back to `VERCEL_URL`. Optionally set
`SITE_URL` to a full HTTPS URL when choosing a custom canonical domain. Rebuild
after changing it, because metadata is generated at build time.

The build exports HTML, JavaScript, fonts, images, audio, and the GLB as static
files. No Cloudflare Worker, database, or server function is needed. Connected
Vercel projects can deploy future pushes to `main` automatically.

## Project files

- `app/page.tsx`: chapter transitions and voice playback.
- `components/mascot-scene.tsx`: Three.js character, animation, and cursor tracking.
- `components/portfolio-content.tsx`: portfolio content.
- `app/globals.css`: site styling.
- `public/models/mascot_shutter_v4.glb`: current character and animation clips.
- `public/audio/`: supplied character voice clips.

Source updates belong in https://github.com/VED2032PATEL/Portfolio-site.
The `.openai/hosting.json` file retains the historical Sites project association;
the Vercel build does not use it.
