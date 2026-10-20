# AVS robots: interactive 3D Gaussian-splat models

Static site (GitHub Pages) with one interactive 3D model per robot, embedded into the TUM AVS TYPO3 pages
through the "iFrame with consent" content element.

| Robot | Embed URL (iframe) |
|---|---|
| RoboRacer (F1TENTH) | `https://fjahncke.github.io/RoboRacer-Vis/roboracer/` |

**Add a robot:** in the RoboRacer-3D-Isaac-Sim repository run
`python scripts/export_web_assets.py <vehicle> --out outputs/web/<robot>`, copy its `model.splat` into a
new folder here, copy `roboracer/index.html` next to it, and add a card to `index.html`.

The viewer (`assets/splat-embed.js`) uses three.js and GaussianSplats3D (both MIT; licences in
`assets/vendor/`). No cookies, no external requests.
