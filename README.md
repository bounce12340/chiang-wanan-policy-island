# Taipei Policy Islands

An interactive 3D map of Taipei Mayor Chiang Wan-an's policy record for the 2022–2026 term, plus plans the city government has announced. Every item links to a public source with its date.

> **Unofficial and independent.** This project has no affiliation with Chiang Wan-an, his campaign, the Taipei City Government, or any political party. It received no commission or funding.

The site's interface and content are in Traditional Chinese.

## What's inside

- **10 policy islands:** transport, urban development, industry & tech, housing, family & education, senior & health care, safety & resilience, environment, culture & sports, and international exchange (sister cities, city diplomacy, international events and expos, international concerts at the Taipei Dome, foreign investment)
- **68 policy items, 132 sources**, each tagged with a status:
  - **Done** — implemented or opened
  - **In progress** — under construction or being rolled out
  - **Planned** — proposed by the city or still being pursued, not yet approved
  - **Re-election pledge** — future commitments made during the campaign
- **Six views:** 3D islands, list, timeline (now including future plans), the 2022 pledge tracker, the citizens' ledger, and the mayors relay, with a status filter and a time-of-day toggle
- **Citizens' ledger (民生帳本):** for 12 groups (pregnancy and newborn families, under-6s, students, youth, working-age adults, seniors, people with disabilities, Indigenous residents, low-income households, single-parent and multiple-birth families, commuters, pet owners), every benefit the city added, raised or cut during the term, shown as before → after with effective date, scope and sources. Central-government benefits are excluded; only groups with at least one change during the term are listed. A second section tracks eight long-standing city problems with before/after indicators, rated "improved", "partly improved", "too early to tell" or "not improved" on the numbers, not on whether a policy was announced
- **Future blueprint:** a fourth map layer showing announced-but-unfinished city plans and campaign commitments as translucent columns over the islands (colour separates city plans from campaign promises), plus a dated list at the end of the timeline. As of the research date no full re-election platform had been published
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
- **Site-wide search (`/` or Ctrl/⌘+K):** one box searches policy items, 2022 pledges, the citizens' ledger, the mayors relay and the future blueprint, with keyboard navigation; 台 and 臺 match each other
- **"I am…" (`#/who/<id>`):** pick one of 12 groups (parents-to-be, young-child parents, students, youth, workers, seniors, people with disabilities, Indigenous residents, low-income households, single-parent and multiple-birth families, commuters, pet owners) and the islands light up only the items whose own text names that group, with one-tap links to that group's ledger entries and related 2022 pledges. The mapping is in [`data/personas.json`](data/personas.json) and is the site's own grouping, not an official one
- **Pledge quiz (`#/quiz`):** guess the status of 10 pledges sampled across fulfilled, partly fulfilled and not fulfilled (the sample is not proportional, and the quiz says so), see the sourced answer after each one, then share the score
- **Mini games (`#/games`):** a daily question (`#/daily`, same question for everyone each day, with a streak counter), *put them in order* (`#/sort`: drag five dated policy events into chronological order), and *which mayor did this?* (`#/whomayor`: two questions per mayor for all five directly elected mayors, names masked). Every answer shows the date and a source; no game uses made-up statements
- **Policy island passport (`#/passport`):** stamps for visiting each island, each feature page and each game, with two badges; stored only in the visitor's browser and shareable
- **Saved list:** star any item or pledge; the list lives only in the visitor's browser and can be shared as a link (`#/saved/<ids>`) that the recipient can import
- **What's new since your last visit:** the browser remembers which items and statuses it saw last time and flags new items and status changes with a badge and a summary on the home card
- **Swipe** left or right on the island panel (mobile) to move to the previous or next island
- **Deep links** to any island, item, view or pledge filter, e.g. `#/transport`, `#/housing/housing-happy`, `#/pledges/p22-media-01`, `#/pledges?status=not_done&cat=勞工` or `#/ledger`
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
  - `mayors.js`, `ledger.js`: the mayors relay and citizens' ledger views (`data/mayors.json`, `data/ledger.json`, `data/future.json`)
  - `data/links.json`: the sourced policy links
- Mobile performance: static meshes are merged per island, water waves run in a vertex shader, rendering pauses in list/timeline views and background tabs, idle phones are capped at 30 fps, and quality steps down automatically on slow devices (`?quality=high` or `?quality=low` overrides this)
- Devices without WebGL fall back to the list view

### Tests and checks

- `npm test` opens the site in headless Chromium (desktop and mobile), checks that the 3D scene starts, deep links, views, layers, tour and stories, search, saved list, "I am…", pledge filters in the URL, the quiz and the what's-new notice work, and that the console has no errors. The deploy workflow runs it before every deploy.
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

## 參考與製作方式

互動形式參考 HEART 政策島（https://puma.taipei/heart-island ，2026/10/22 上線）。程式使用 Claude Code 在 AI 輔助下撰寫，插畫為 AI 生成；資料由作者整理查證，皆附來源。

## Corrections

If you find an error or outdated information, please open an issue and include a source link.

## License

- **Code:** MIT License
- **Data compilation** (`data/policies.json`, `data/pledges2022.json`): CC BY 4.0. Rights to the original content belong to each source.
- **Three.js:** MIT License (see `vendor/three/LICENSE`)
