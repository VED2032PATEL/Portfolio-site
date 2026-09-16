# Portfolio workflow

This is the user's portfolio website. Its canonical repository is
https://github.com/VED2032PATEL/Portfolio-site.

- Make future portfolio website changes in this checkout.
- Use `origin` for the GitHub repository and track `origin/main`.
- The user requested that completed future website changes be committed and
  pushed to this repository after appropriate validation. Preserve unrelated
  work and never force-push or overwrite remote changes.
- Vercel is the intended hosting provider. Preserve the static export and
  `vercel.json` configuration. Use local hosting for previews. Pushing to
  `main` may trigger a deployment once the user connects Vercel.
- Preserve the character's materials, textures, and rig unless the user asks
  for changes. Keep the GLB and its animation integration in sync.
- Use npm and preserve package-lock.json. Run `npm run build` after website
  changes. The full lint command currently reports existing errors in starter
  UI components; lint changed application files separately when appropriate.
- Do not commit dependencies, generated builds, local caches, or credentials.
