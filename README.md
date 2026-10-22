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
- **Deep links** to any island or item, e.g. `#/transport` or `#/housing/housing-happy`
- **Data:** all content lives in [`data/policies.json`](data/policies.json), current as of **2026-10-23**

As of that date, no complete re-election platform had been published, so the pledge category is empty. The site states this on its home screen.

## How the data was compiled

- Sources are Taipei City Government publications and mainstream news outlets.
- After the initial research, independent reviewers checked every item against its sources. Claims the sources did not support were corrected or removed.
- Items describe what was done or proposed. They do not judge whether a policy is good or bad.
- News reports may differ from final official figures, so check the original source before citing anything.

## Tech

- Native ES modules, no build step
- [Three.js](https://threejs.org/) r180, vendored in `vendor/three/` (MIT)
- All 3D models are generated in code; there are no external model files
- Devices without WebGL fall back to the list view

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
