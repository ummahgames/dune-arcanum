# Dune Arcanum

A complete static browser game about restoring an astronomical atlas with ricocheting light. Everything runs on the client. No account, installation, package downloads, API keys, database, or application server is required for players.

## Play and deploy

Serve this directory on any static web host and open `index.html`. Keep the `src/` and `assets/` folders alongside it. The game works from a subdirectory such as `/dune-arcanum/`; all runtime paths are relative. JavaScript modules require HTTP or HTTPS, so opening the file directly with `file://` is not supported.

For a local preview, a standard static server is sufficient:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173 in a browser. This server only delivers files; all game logic and saves remain in the browser. There are no runtime dependencies or build step. `package.json` provides an optional developer test shortcut, not an installation requirement.

## Included

- 24 authored chambers across four chapters, with geometric gate finales and lore.
- Ceramic, reinforced lapis, constellation chains, sand seals, prisms, and protected atlas hearts.
- Anchored horizontal, vertical, and diagonal mirrors with matching collision geometry.
- Pierce, mirrored Echo, and Lift, plus a once-per-chamber rewind.
- Consistent prediction and simulation, fixed-step continuous circle collision, acceleration, and recall.
- Campaign stars, a restoration journal, and cosmetic orb unlocks.
- UTC Daily Mosaic, shareable date links, and a seeded Endless Caravan.
- Mouse, touch, angle slider, keyboard controls, high contrast, reduced motion, and gentler pressure.
- Original local SVG illustrations and synthesized audio; no external asset requests.
- Versioned local saves, stable aiming checkpoints, and progress export/import.
- Automatic browser caching on HTTPS static hosting after the first visit, with no app-install prompts. Localhost skips caching so code edits remain visible during development.

## Controls

Drag upward to aim, then release to launch. A short tap selects the angle; use **Send the light** to launch. Tap-to-aim can be enabled in Settings. The angle slider also works without dragging the board.

- Left / Right: aim by one degree; Shift uses five-degree steps.
- Enter: launch. Space: launch while aiming, change speed while flying.
- F: toggle 1× / 3× flight speed.
- R: recall. Escape: pause.

Abilities are selected before the shot. Select an armed ability again to cancel. Recall preserves damage and uses the shot normally. Every flight is bounded at 15 simulated seconds. Targets crossing the visible breach line cause defeat; fixed mirrors never descend or count toward completion. An atlas heart opens only after all other targets and finite waves are resolved.

## Saves and privacy

Progress uses the `dune-arcanum-v2` localStorage key. Reloading resumes at the latest stable aiming checkpoint, including when a tab was closed in flight. Export/import carries campaign records, daily records, settings, and cosmetics between browsers; imports merge better records instead of erasing progress. Active shots are not exported. The game remains playable when browser storage is unavailable, and the footer reports that state.

Daily layouts use the UTC date and a versioned curated pattern catalog. Scores are local and unverified. Shared links contain only the mosaic date, not personal data. There are no analytics or network writes.

## Development verification

Use Node's built-in test runner. No dependency installation is needed:

```sh
node --test tests/*.test.js
```

The suite covers exact circle sweeps and rounded corners, sloped mirrors, event ordering, pending and blocked waves, protected hearts, chains, preview isolation, recall, rewind, prism limits, endless generation, save handling, and replayable completion routes for all 24 campaign chambers at normal and accelerated frame schedules. Known winning routes are in `tests/campaign-routes.json`. They establish solvability, not human difficulty ratings.

`src/physics.js` contains collision geometry; `src/engine.js` owns pure simulation and turn rules; `src/levels.js` is authored content; `src/renderer.js` is Canvas 2D presentation; `src/storage.js` handles profiles; `src/audio.js` produces the original soundscape. `main.js` connects them to semantic HTML menus and controls.

When shipping changed assets or code, increment the cache version in `sw.js`. Updated code waits until older game tabs close, so an update does not replace rules during a shot. HTTPS is needed for offline caching, but normal online gameplay also works over HTTP.

## Artwork

The local geometric illustrations were created for this implementation; see `assets/README.md` for palettes. The earlier `instructions.txt` describes the original prototype proposal. `REDESIGN_PLAN.md` contains the redesign rationale; the implementation uses dependency-free Canvas 2D instead of PixiJS to keep delivery self-contained.
