# Taipei Policy Islands

An interactive 3D map of Taipei Mayor Chiang Wan-an's policy record for the 2022–2026 term, plus plans the city government has announced. Every item links to a public source with its date.

> **Unofficial and independent.** This project has no affiliation with Chiang Wan-an, his campaign, the Taipei City Government, or any political party. It received no commission or funding.

The site's interface and content are in Traditional Chinese.

## What's inside

- **9 policy islands:** transport, urban development, industry & tech, housing, family & education, senior & health care, safety & resilience, environment, culture & sports
- **59 policy items, 99 sources**, each tagged with a status:
  - **Done** — implemented or opened
  - **In progress** — under construction or being rolled out
  - **Planned** — proposed by the city or still being pursued, not yet approved
  - **Re-election pledge** — future commitments made during the campaign
- **Three views:** 3D islands, list, and timeline, with a status filter and a day/night toggle
- **Policy scenes:** every item has its own animated mini-diorama that floats above its island, e.g. an adult handing a child a bottle of milk for the free-milk program, or a cheering crowd around the Taipei Dome. The scene follows whichever card you are reading in the panel.
- **Island residents:** small animated people on each island that match its theme. Tap one and they stop, wave, and show a speech bubble with one sourced fact from that policy area, with a link to the full item.
- **Term timeline slider:** drag or play through 2022-12 → today; policy markers light up by each item's event date (opening, signing, announcement), with a ticker showing the latest item. The date reflects the recorded event, not when work on a policy began.
- **Deep links** to any island or item, e.g. `#/transport` or `#/housing/housing-happy`
- **Data:** all content lives in [`data/policies.json`](data/policies.json), current as of **2026-10-23**

As of that date, no complete re-election platform had been published, so the pledge category is empty. The site states this on its home screen.

## How the data was compiled

- Sources are Taipei City Government publications and mainstream news outlets.
- After the initial research, independent reviewers checked every item against its sources. Claims the sources did not support were corrected or removed.
- Items describe what was done or proposed. They do not judge whether a policy is good or bad.
- News reports may differ from final official figures, so check the original source before citing anything.

## Tech

- Native ES modules, no build step at deploy time
- [Three.js](https://threejs.org/) r180 (MIT), as a tree-shaken bundle in `vendor/three-lite.js` (529 KB, 136 KB gzipped)
- All 3D models are generated in code; there are no external model files
  - `world.js`: islands, camera, interaction, quality tiers
  - `people.js`: all animated people share 7 instanced meshes, so the crowd size does not add draw calls
  - `vignettes.js`: the per-item scene library and the item → scene mapping
- Mobile performance: static meshes are merged per island, water waves run in a vertex shader, rendering pauses in list/timeline views and background tabs, idle phones are capped at 30 fps, and quality steps down automatically on slow devices (`?quality=high` or `?quality=low` overrides this)
- Devices without WebGL fall back to the list view

### Rebuilding Three.js

If you use a new Three.js class in the 3D code, regenerate the bundle:

```bash
npm install
npm run build:three
```

### Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

This is a static site deployed to Cloudflare Pages. `_headers` sets basic security headers, including a Content-Security-Policy.

The workflow at `.github/workflows/deploy.yml` deploys on every push to `main` once two repository secrets are set:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token created from the "Edit Cloudflare Pages" template |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

If the secrets are missing, the deploy steps are skipped instead of failing.

## Corrections

If you find an error or outdated information, please open an issue and include a source link.

## License

- **Code:** MIT License
- **Data compilation** (`data/policies.json`): CC BY 4.0. Rights to the original content belong to each source.
- **Three.js:** MIT License (see `vendor/three/LICENSE`)
