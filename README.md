# Taipei Policy Islands

An interactive 3D map of Taipei Mayor Chiang Wan-an's policy record for the 2022–2026 term, plus plans the city government has announced. Every item links to a public source with its date.

> **Unofficial and independent.** This project has no affiliation with Chiang Wan-an, his campaign, the Taipei City Government, or any political party. It received no commission or funding.

The site's interface and content are in Traditional Chinese.

## What's inside

- **10 policy islands:** transport, urban development, industry & tech, housing, family & education, senior & health care, safety & resilience, environment, culture & sports, and international exchange (sister cities, city diplomacy, international events and expos, international concerts at the Taipei Dome, foreign investment)
- **67 policy items, 129 sources**, each tagged with a status:
  - **Done** — implemented or opened
  - **In progress** — under construction or being rolled out
  - **Planned** — proposed by the city or still being pursued, not yet approved
  - **Re-election pledge** — future commitments made during the campaign
- **Five views:** 3D islands, list, timeline, the 2022 pledge tracker, and the mayors relay, with a status filter and a time-of-day toggle
- **Mayors relay:** every directly elected Taipei mayor since 1994 (Chen Shui-bian, Ma Ying-jeou, Hau Lung-bin, Ko Wen-je, Chiang Wan-an), each with 8 representative municipal actions and 2–3 widely reported municipal controversies, plus six cross-term projects (Taipei Dome, MRT Wenhu and Xinyi lines, YouBike, social housing, Beitou-Shilin Science Park) showing which administration did which stage. All five mayors are held to the same inclusion rules; personal court cases are excluded for everyone; colours mark terms, not parties. Data in [`data/mayors.json`](data/mayors.json)
- **2022 pledge tracker:** all 83 pledges from Chiang's 2022 mayoral campaign, each checked against public records up to **2026-10-24** and rated against the pledge's own wording (numbers, deadlines, scope):
  - **Fulfilled**, **Partly fulfilled**, **In progress**, **Not fulfilled**, **Not measurable**, **No public data**
  - Each pledge shows the original wording, the evidence, criticism where reported, sources, and links to related items on the islands
  - Pledge list: the 74 items compiled by the [READr pledge database](https://whoareyou.readr.tw/politics/443), plus 11 major pledges from news coverage, with 2 duplicates merged
  - Achievements of the previous administration and nationwide central-government policies do not count as fulfilled
  - Researched in two rounds, then independently reviewed item by item; data in [`data/pledges2022.json`](data/pledges2022.json)
- **Policy scenes:** every item has its own animated mini-diorama that floats above its island, e.g. an adult handing a child a bottle of milk for the free-milk program, or a cheering crowd around the Taipei Dome. The scene follows whichever card you are reading in the panel.
- **Island residents:** about 210 animated people walking the islands and the central plaza. Tap one and they stop, wave, and show a speech bubble with one sourced fact from that policy area, with a link to the full item. All residents share 7 instanced meshes, so the crowd size does not add draw calls.
- **District landmarks:** the outer ring has one landmark islet for each of Taipei's 12 districts (Xinyi is the Taipei 101 at the centre): Miramar Ferris wheel (Zhongshan), Dahu Park's Jindai Bridge (Neihu), Raohe Night Market and Ciyou Temple (Songshan), Taipei Music Center (Nangang), Maokong Gondola (Wenshan), Daan Forest Park (Da'an), Chiang Kai-shek Memorial Hall (Zhongzheng), Longshan Temple (Wanhua), Dihua Street and Dadaocheng (Datong), Taipei Performing Arts Center (Shilin) and Beitou Thermal Valley (Beitou). Bearings roughly follow real geography; distances are schematic
- **Three map layers:**
  - **Term record:** one beacon per policy item, coloured by status
  - **2022 pledges:** one sign per 2022 campaign pledge, coloured by fulfilment status; tap for a summary card
  - **Policy links:** 10 arcs between related policies on different islands. A link is drawn only when a source explicitly states the connection, and every arc lists its sources
- **Guided tour (`#/tour`):** a 70-second captioned camera tour over the nine islands, pairing each highlight with the matching 2022 pledge and ending with the overall fulfilment tally
- **A day in the city (`#/story/parent`, `commuter`, `senior`):** three fictional residents walk through four policy scenes from dawn to night; every fact shown is sourced from the site's data
- **Share cards:** every pledge (`/p/<id>`) and policy item (`/i/<id>`) has its own page with a 1200×630 preview image, generated at deploy time, so links posted on social media show that item's status
- **Embeddable pledge card:** `/embed/pledge.html?id=<pledge-id>` can be embedded with an iframe on any site
- **Report an error:** every card opens a pre-filled GitHub issue with the item ID and current rating
- **Term timeline slider:** drag or play through 2022-12 → today; policy markers light up by each item's event date (opening, signing, announcement), with a ticker showing the latest item. The date reflects the recorded event, not when work on a policy began.
- **Deep links** to any island, item or pledge, e.g. `#/transport`, `#/housing/housing-happy` or `#/pledges/p22-media-01`
- **Data:** all content lives in [`data/policies.json`](data/policies.json), current as of **2026-10-23**

As of that date, no complete re-election platform had been published, so the re-election pledge category is empty. (The 2022 pledge tracker is separate.) The site states this on its home screen.

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
  - `pledges.js`: the 2022 pledge tracker view, loaded separately from the 3D scene
  - `tour.js`: the guided tour and the "day in the city" stories
  - `data/links.json`: the sourced policy links
- Mobile performance: static meshes are merged per island, water waves run in a vertex shader, rendering pauses in list/timeline views and background tabs, idle phones are capped at 30 fps, and quality steps down automatically on slow devices (`?quality=high` or `?quality=low` overrides this)
- Devices without WebGL fall back to the list view

### Tests and checks

- `npm test` opens the site in headless Chromium (desktop and mobile), checks that the 3D scene starts, deep links, views, layers, tour and stories work, and that the console has no errors. The deploy workflow runs it before every deploy.
- `npm run build:share` generates the share pages and preview images into `dist/` (run automatically on deploy).
- `.github/workflows/linkcheck.yml` checks every source link each Monday and opens an issue if any link is dead.

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
- **Data compilation** (`data/policies.json`, `data/pledges2022.json`): CC BY 4.0. Rights to the original content belong to each source.
- **Three.js:** MIT License (see `vendor/three/LICENSE`)
