# Portfolio site

Interactive portfolio featuring a rigged Spider-Man character, cursor tracking,
voice reactions, and a character-driven shutter transition between chapters.
Portfolio copy is sample content to replace later.

## Run locally

Use Node.js 22.13 or newer and npm:

```sh
npm ci
npm run build
npm run start -- --ip 127.0.0.1 --port 8787
```

Open http://127.0.0.1:8787. For development, use `npm run dev`.

## Project files

- `app/page.tsx`: chapter transitions and voice playback.
- `components/mascot-scene.tsx`: Three.js character, animation, and cursor tracking.
- `components/portfolio-content.tsx`: portfolio content.
- `app/globals.css`: site styling.
- `public/models/mascot_shutter_v4.glb`: current character and animation clips.
- `public/audio/`: supplied character voice clips.

Source updates belong in https://github.com/VED2032PATEL/Portfolio-site.
The `.openai/hosting.json` file retains the existing Sites project association;
local hosting does not require publishing that project.
