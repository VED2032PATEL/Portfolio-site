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
- `components/web-tethers.ts`: lit 3D web fibers, flight, attachment, and release.
- `components/portfolio-content.tsx`: portfolio content.
- `app/globals.css`: site styling.
- `public/models/mascot_web_pull.glb`: character with the 4.2-second web pull.
- `lib/mascot-motion.ts`: shared animation timing and background-tab handling.
- `blender/scripts/`: reusable clip authoring and clean-import validation.
- `public/audio/`: supplied character voice clips.

Source updates belong in https://github.com/VED2032PATEL/Portfolio-site.
The `.openai/hosting.json` file retains the historical Sites project association;
the Vercel build does not use it.

## Mascot motion

The web-assisted gesture uses an upward glance, staggered hand casts, a torso-led
pull, and a relaxed return. Wrist extension stays on one hinge axis (maximum
24 degrees); fingers change from the web-shooting sign to a closed grip.
Web emitters follow the forearm-mounted wrist shooters. The
incoming page follows measured hand travel and stays as the new chapter.
No independent CSS animation drives the shutter. Ordinary low frame rates
retain real-time playback; hidden tabs pause instead of skipping the gesture.

Webs render inside the Three.js scene with three braided, lit fibers per cord,
depth occlusion by the character, a short flight coil, a damped impact ripple,
an attachment pattern, and slack on release. Position/normal buffers are reused
each frame. The web attachment projects to the same screen position as the
shutter edge at desktop and mobile aspect ratios.

Content uses normal page scrolling, with chapter navigation at the bottom.
Reduced-motion visitors switch chapters immediately. Project disclosures and
profile links remain keyboard accessible. The canvas does not intercept content
clicks. Phone layouts crop the character to a bust and briefly widen the camera
during the cast so the hands remain visible.

Run `node --experimental-strip-types scripts/check-mascot-motion.mjs` for clip
and timing checks, and `node --experimental-strip-types scripts/check-web-tethers.mjs`
for 3D emitter/attachment alignment and geometry checks.
`blender/scripts/build_web_pull.py` takes the existing rigged
BLEND, original GLB, and an output directory. Run it using Python with Blender's
`bpy` module. It writes a separate editable BLEND, exports with Blender, and
merges only the new animation into the original GLB. Geometry, textures,
materials, weights, and rest transforms remain unchanged. Validate and render
the output with `blender/scripts/verify_web_pull.py MODEL.glb OUTPUT_DIRECTORY`.

Motion references studied: Sony Imageworks' [Animating Spider-Man breakdown](https://www.youtube.com/watch?v=R7p0yiGNqlI)
and the [Homecoming ferry sequence](https://www.youtube.com/watch?v=ORrQKFliVLM).
The gesture adapts the aiming, asymmetric casts, and body counter-motion to the
portfolio's upper-body framing; it is authored animation, not motion capture.
[Animation Mentor's principles](https://www.animationmentor.com/blog/tutorial-12-principles-of-animation/)
informed anticipation, arcs, and overlapping action. Reference footage is not
included in the website or repository.
