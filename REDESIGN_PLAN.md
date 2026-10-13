# Dune Arcanum redesign and implementation plan

Rebuild Dune Arcanum as a tactical ricochet game about restoring lost geometric mosaics. Keep the satisfying act of aiming one orb and watching a chain of rebounds, and give that action clear goals, fair pressure, readable materials, and a campaign that teaches increasingly interesting shots. All simulation, content, saves, and progression run in the browser; deploy the finished game as static files.

The first deliverable should be six excellent levels that prove the controls, physics, and visual identity. Expand to a 24-level campaign only after those levels are enjoyable. The settings below are initial tuning proposals, not established balance.

**1. Current game assessment**

The implementation is a 734-line JavaScript prototype with a small HTML shell and stylesheet. It has a single orb, wall and brick collisions, random descending rows, a score, fast-forward, generated textures, and synthesized tones. The much broader `instructions.txt` describes features that are mostly absent: levels, objectives, meaningful HP, powers, progression, saves, accessibility settings, and several tile types.

Browser inspection of the local build confirmed that it loads and a shot can advance the turn. On a 1280 × 720 viewport at device pixel ratio 2, the canvas occupied 842 × 1472 CSS pixels including its border and began at y = −376. The launcher and substantial portions of the board were outside the viewport. A 390 × 844 viewport check showed the portrait composition, a small low-contrast orb, and an intrusive noise strip near the launcher. These checks establish layout problems; they do not establish real-device touch or cross-browser compatibility.

| Priority | Finding and source | Player consequence | Required change |
| --- | --- | --- | --- |
| P0 | `main.js:23–27` sets resolution without controlling CSS canvas size; world scaling at lines 43–45 uses renderer dimensions. | High-DPI layouts can hide important parts of the game. | Separate CSS size, logical world size, and backing-store resolution. Use a measured game container, autoDensity, and screen dimensions for transforms. |
| P0 | `initialLayout()` at line 377 creates row 0, and `spawnRowAtTop()` at line 731 adds another row at the same coordinates. | The opening board has overlapping colliders and misleading visible targets. | Initialize the board exactly once and validate occupancy. |
| P0 | Configuration sets `rowStep: 42`, but line 515 descends by `cellH`, which is 100. | The advertised tuning has no effect; pressure is unexpectedly severe. | Make descent an explicit level rule with one source of truth. |
| P0 | Reflectors cannot be damaged, descend with other bricks, and trigger the same loss check. | Any surviving reflector eventually guarantees defeat. | Make reflectors anchored fixtures, or give a descending reflector an explicit removal mechanism. |
| P0 | Horizontal brick normals at lines 470–471 point inward. | Reflection still reverses horizontal velocity, but the separation nudge moves the orb into the collider, which the next collision query skips. | Use outward normals and a defined overlap recovery solver. |
| P0 | Landing is checked before other collision times at lines 587–596. | A later floor intersection can bypass an earlier wall or brick collision during the same step. | Include landing in the same earliest-event query as other collisions. |
| P0 | Particle code divides the Pixi ticker callback argument by 60; effect cleanup passes the return value of `ticker.add()` to `remove()`. | Particle state can become invalid, and callbacks can accumulate. | Use the v8 ticker time properties and remove the original callback, or centralize all effects in one update system. |
| P1 | Pointer input has no capture, cancel handler, minimum gesture distance, or robust gesture state. | Off-canvas releases and interruptions are unreliable; a simple release can launch unexpectedly. | Capture one active pointer, handle cancellation, and explicitly validate launch intent. |
| P1 | Aim prediction does not simulate destroyed bricks or include floor termination. It creates graphics and timers every frame. | The guide can imply impossible later bounces and creates avoidable allocation churn. | Share the simulation with a cloned preview state and reuse guide graphics. |
| P1 | No resize handling, pause state, restart control, win condition, save, or help flow. | Players cannot reliably finish, recover, or resume. | Add a complete application state machine and HTML menus. |
| P1 | The visible noise sprite is added to the background even when the optional displacement filter is unavailable. | A technical helper becomes a distracting art layer. | Hide filter helpers and simplify background effects. |
| P1 | A frame step cap exists, but elapsed time and accumulated backlog are unbounded. | Returning from a background tab can create prolonged catch-up behavior. | Pause when hidden, reset timing on resume, and bound real frame time and accumulated work. |
| P2 | All normal tiles are one-hit targets; HP textures and difficulty bands are unused. | The game has little tactical differentiation and no structured learning curve. | Introduce a small, deliberate set of tile behaviors through authored levels. |

Pixi v8 passes the ticker instance to callbacks and changed its texture and drawing APIs. `Ticker.add()` returns the ticker itself; `remove()` expects the listener function. Migrate consistently and remove the unused blur dependency instead of relying on optional globals. See the [v8 migration guide](https://pixijs.com/8.x/guides/migrations/v8) and [version 8.12 ticker reference](https://pixijs.download/v8.12.0/docs/ticker.Ticker.html). Use the documented [application sizing options](https://pixijs.com/8.x/guides/components/application) for resolution and autoDensity.

**2. Game identity and player experience**

The player is a traveling mosaic restorer carrying a luminous stone orb. Dust and brittle shells cover fragments of an ancient astronomical atlas. A good ricochet clears those shells, reconnects a pattern, and reveals the design underneath. Each completed chamber restores a small artwork; each chapter reveals part of a larger atlas.

The central pleasure is seeing a clever angle produce a satisfying, understandable result. Every mechanic should support that pleasure. Geometry becomes functional: symmetry suggests routes, mirrors open angles, and linked tiles reward planning. Brief story captions can give discoveries context, but the first playable shot should occur within 20 seconds of opening the game.

Keep the desert and Islamic geometric art identity. Use architecture, craftsmanship, astronomy, and ornamental geometry thoughtfully. Use neutral geometric marks for destructible objects; any actual calligraphy should have a verified meaning and appear in appropriate decorative or narrative contexts.

**3. Core loop and exact rules**

1. Show the chamber objective, current pressure, next wave, and remaining ability charges.
2. Aim the orb from its current landing point. The guide shows the first reliable collision and a limited continuation.
3. Optionally arm one ability, then launch one orb.
4. Resolve rebounds, damage, restoration, and chains. Players may accelerate the flight or recall the orb.
5. On landing, check victory first. If targets remain, apply the scheduled descent, test for a breach, and then add a wave if the level script calls for one. Reject overlapping or invalid wave placements.
6. Move into the next aiming phase, or show a result panel with replay and next-level actions.

Use one primary orb in the first release. This makes individual angles legible and the simulation easier to trust. Preserve its landing x coordinate for the next shot; the initial launch also begins on the same floor. Mark the expected return location when a preview reaches the floor.

Campaign chambers have finite authored waves. Every required target must be clearable. Completion counts targets in both the active board and all pending waves; clearing the current board alone does not end a chamber with reinforcements remaining. An empty board advances directly to the next scheduled wave without requiring empty launches or consuming additional shots. Anchored fixtures do not descend or count toward completion. Cleared targets can reveal a decorative mosaic behind the board, but that art never collides with the orb. A required target crossing the clearly marked danger line causes a breach and ends the level. The danger line sits above the launcher, leaving a safe control region.

Keep a stable orb speed. Increase difficulty through geometry and decisions, rather than faster unreadable motion. Start with a minimum upward angle of 12 degrees; validate it in playtests. A pointer below the launch line shows an invalid-aim indicator instead of silently choosing an unrelated shallow angle.

Recall ends the remaining flight, preserves damage already dealt, places the orb at its current clamped x coordinate on the floor, and consumes the shot normally. It must not grant extra damage or avoid descent. Also provide an automatic recall after a generous bounded flight duration, initially 15 seconds of simulated flight; use the same rule in preview, replay, and normal play. Display the approach to the limit so the cutoff is understandable. Tune the limit against valid long chains before release.

At level start, explain any changed rule in one sentence. No surprise descents, hidden reinforcements, or undisclosed boss behavior.

**4. Controls, onboarding, and readability**

Desktop defaults: move the pointer to inspect an angle; press and drag to refine it; release to launch after a deliberate gesture. A click can select an angle without firing when tap-to-aim mode is enabled. Provide a visible Launch button in that mode. Touch defaults: drag within the board to aim, then release; offer tap-to-aim plus Launch as a persistent setting. Both modes use the same angle calculation.

Capture the active pointer, ignore additional touches, apply `touch-action: none` only to the playfield, and cancel safely on `pointercancel`, focus loss, or an Escape action. HUD actions must never launch an orb. Add a small dead zone so an accidental tap in drag mode does not fire.

Keyboard controls: Left/Right adjust by one degree, Shift adjusts by five, Enter launches, Escape pauses or cancels aim, F toggles acceleration, and R recalls during flight. Space can launch while aiming and accelerate while flying if that context-sensitive behavior is clearly shown. Ignore global shortcuts while a menu control has focus. Provide a visible angle value and an accessible angle input for precise adjustment.

Teach three actions through playable levels: hit a tile directly, bank off a wall, and predict descent. Highlight only the relevant UI. Instructions disappear once performed and remain available in Help. Show the consequence of a miss before the first pressured shot.

The aim guide should use a strong solid segment to the first impact, a highlighted target, and a fading continuation. Use a cloned board state if showing later bounces through targets that break. If an unimplemented special behavior cannot be predicted accurately, stop the guide there and label that boundary. Never present a speculative full-flight path as guaranteed.

Place a bright orb core over a dark outline, plus a larger aiming ring. Tile HP must use readable numerals and distinct crack states. Shape icons identify special materials; color supplies a second cue. Indicate tiles endangered by the next descent with a consistent outline and a text count. Show a ghost of the next wave in its actual entry slots.

**5. Tile types and abilities**

Introduce one behavior at a time. The first six-level slice needs normal tiles, reinforced tiles, mirrors, and chain tiles; other types follow only after these work well.

| Tile | Rule | Tactical purpose | Visual language |
| --- | --- | --- | --- |
| Ceramic | 1 HP; reflects the orb and clears on hit. | Establish the basic interaction. | Turquoise glaze, thin brass edge, simple star. |
| Reinforced ceramic | 2–3 HP, decrementing once per valid impact. | Encourage returning angles and repeated contact. | Lapis glaze, readable HP, layered cracks. |
| Anchored mirror | Immovable and indestructible; not a target or danger participant. | Open intentional ricochet routes. | Silver surface, unmistakable arrow or bevel marking. |
| Linked tile | Breaking one deals 1 damage to each immediate linked neighbor. A neighbor propagates only if it also breaks. Process each break once per chain event. | Reward identifying a weak point in a pattern. | Visible connecting inlay and shared geometric motif. |
| Sand seal | Breaking it damages targets within one orthogonal cell by 1; no wall damage. | Let a small local action open a crowded chamber. | Amber vessel symbol and explicit radius preview. |
| Prism | Reflects the primary orb and emits one short-lived echo once per shot. Echoes cannot split again. | Create a later spectacle with bounded complexity. | Faceted teal triangle with an echo icon. |

Mirrors initially use horizontal or vertical faces. Add 45-degree pieces only after collision and preview support the actual sloped polygon. Do not draw triangular art over an unrelated rectangular collider.

Use three active abilities as the eventual maximum. **Pierce** passes through and damages the next two eligible targets; **Echo** launches one orb at the mirrored angle, with both orbs obeying the same damage and return rules; **Lift** raises descending targets by one descent increment before the shot, capped at their valid upper slots. Give each level an explicit allowance, initially one charge of its featured ability. Charges refill on replay and never require a consumable purchase or currency grind.

Keep all of these abilities out of the first two tutorials. Prototype only Pierce in the first slice. Ability selection updates the prediction and can be cancelled before launch. Permanent unlocks add choices, cosmetics, or preview comfort; they do not multiply damage and invalidate authored puzzles.

**6. Leveling, campaign, and replay**

Treat leveling as mastery progression. Complete a chamber to unlock the next. Each of four chapters contains six levels, with the sixth acting as an architectural puzzle finale. Completing a chapter opens the next chapter and reveals its atlas panel. Stars reward replay but never gate basic campaign access.

| Chapter | Art and atmosphere | New decisions |
| --- | --- | --- |
| The Sand Gate | Pale sandstone, daylight, turquoise ceramics. | Direct hits, banks, landing positions, and pressure. |
| The Lapis Court | Blue courtyard, shaded arches, copper details. | Reinforced tiles, mirror routes, and weak points. |
| The Glass Observatory | Night sky, faceted glass, restrained starlight. | Prisms, echoes, and crossing trajectories. |
| The Atlas Vault | Dark stone, brass diagrams, restored color. | Combined mechanics and a multi-stage geometric finale. |

Each chapter follows a teaching rhythm: introduce, practice, vary, combine, apply pressure, then resolve a distinctive finale. Finales are large geometric mechanisms with visible stages and weak points. Avoid replacing puzzle depth with huge HP totals. A finale could require releasing three seals to expose a center tile, with each stage previewed before it begins.

Award three independent stars: completion, completion within the authored par shot count, and a disclosed craft objective such as a three-target bank chain or avoiding an ability. Use level-specific craft objectives rather than a universal perfect-clear bonus that obscures what success means. The result panel explains each earned or missed star. Scores can combine 100 points per restored target, a capped chain bonus, and a par bonus, but score is secondary to completion and stars.

Add a journal showing discovered patterns and a workshop for unlocked orb appearances and trail styles. Unlock these through campaign milestones and a few understandable achievements. Avoid XP inflation, repeated low-value rewards, permanent power creep, and mandatory replays.

After campaign quality is proven, add Endless and Daily Mosaic. Endless uses constrained seeded generation, with an optional endurance cap and an explicit score goal. Daily Mosaic uses a documented UTC date plus content version to select a shared local seed. Everyone with that version gets the same board, but results remain on the device. Allow replay without a streak penalty. Seed sharing can use a URL fragment containing seed and version; label all shared scores as local and unverified.

**7. Level authoring and balance**

Start with an eight-column board, reducing the current ten columns to give each tile more space on phones. Use a logical board of 480 × 720 units, cells 60 × 48, padding 6, orb radius 8, and speed 600 units per second. Place the danger line at y = 620 in a top-left coordinate system and the orb floor center at y = 700. Keep the upper board reserved for targets and the lower area reserved for aiming. These values are a proposed coherent starting point, and can change together after testing.

For pressured campaign levels, start with descent of 24 units after each shot and scripted wave entry every two shots. New waves have 48 units of cumulative clearance between entry events; validate their slots instead of silently overlapping them. The first two levels have no descent. Later levels change one major pressure variable at a time. Most chambers should take roughly 6–14 shots and 2–4 minutes once learned; tutorials can be shorter.

Example first chapter:

| Level | Layout and learning goal | Completion and pressure |
| --- | --- | --- |
| 1 | Three reachable ceramics and a centered launcher. | Restore all three; no descent. |
| 2 | A wall-bank arrangement with a generous route. | Restore all targets; no descent; optional bank star. |
| 3 | Two sparse staggered rows, with a descent ghost. | Clear finite targets; introduce half-row descent. |
| 4 | An anchored mirror creating a route around reinforcement. | Clear targets; teach that fixtures remain. |
| 5 | A linked pattern with a visible low-HP entry point. | Clear two finite waves; teach chain planning. |
| 6 | A sealed gate with a three-part mosaic pattern. | Release visible seals and restore the center; combine banks and pressure. |

Write levels as data: ID, content version, chapter, grid, target placements, fixtures, finite wave schedule, descent schedule, initial launcher, objectives, par, allowed abilities, and tutorial prompts. Keep visual theme separate from collision behavior. Schema validation rejects duplicate slots, unknown tile types, inaccessible required targets, unbounded prism chains, bad wave positions, and objectives referring to missing IDs.

For procedural modes, generate from curated symmetric and asymmetric templates. Require usable entry routes, limit dense high-HP clusters near the danger band, and cap total active targets. Validate seeds with a simple candidate-angle search using the real simulator. That search detects obviously hopeless positions; it cannot prove a level is fun or universally solvable. Curate daily seeds from a tested catalog for the initial release, avoiding an unreviewed challenge generator.

Tune against recorded local playtests: shot duration, useful hits per shot, tiles entering danger, misses caused by controls, restarts, recalls, and ability use. Keep diagnostic recording local and exportable. Initial targets: a meaningful early shot typically clears 2–5 tiles; most flights finish in 2–6 seconds; testers can explain why they failed. Review outliers rather than increasing HP to fill time.

**8. Art direction and asset production**

Use a crafted ceramic and astronomical atlas style. The playfield is a quiet dark surface framed by architectural detail; the targets provide saturated color. Surrounding dunes, arches, and sky establish place while remaining lower in contrast than the active board. Transition from daylight to night across chapters.

Base palette: deep ink `#102A35`, lapis `#245A8D`, turquoise `#49B7AE`, warm ivory `#F5E9CC`, copper `#B87946`, and hazard coral `#D66B55`. Check contrast in the actual interface before treating these as final colors. Reserve hazard coral for pressure and breach warnings. HP, abilities, and selection also use shapes and labels.

Replace uniformly brown tiles with a small material system: glazed ceramic, reinforced glaze, silver mirror, carved amber seal, and glass prism. Make silhouette and damage legible before adding texture. Use geometric outlines for HP and neutral symbols for special behavior. Decoration must stay inside the tile and away from its number or icon.

Reveal a mosaic through restrained restoration animations. Impacts create a quick outline flash and a few material-specific fragments. A linked break lights its inlay path in sequence. A completed chamber settles into the restored artwork and pauses briefly before presenting the result. Make that moment skippable. Reduced motion removes camera movement and large particles while retaining static feedback.

Asset inventory for the six-level slice: one courtyard background with three depth layers; a compact tile atlas covering four types and three damage states; one orb plus a trail texture; a border set; ability, pressure, and navigation icons; impact particles; and one completed mosaic. Build borders and icons as SVG or code-generated geometry; bake detailed textures into a modest atlas. Expand to chapter backgrounds and finale art after the slice establishes the style. Keep originals, export rules, licenses, and attribution alongside assets.

Use a locally hosted readable font for controls and numerals, with a restrained display face for chapter names. Geometric title lettering belongs in large headings, never in tiny HP values. Avoid noisy fullscreen grain, heavy bloom, and heat distortion over the trajectory. Ambient layers animate slowly and can be disabled.

**9. Layout, sound, and accessibility**

Build the interface around a measured game shell. The top row contains Back/Pause, the chamber name, and progress toward the objective. The board contains targets, preview, pressure line, and orb. The bottom tray contains available ability charges, Launch when relevant, acceleration, and recall. Detailed score belongs in the result screen. During play, the objective and danger state deserve priority.

On phones, keep the portrait board and bottom controls within dynamic viewport height, respecting safe-area insets. Use border-box sizing and account for the frame, header, and tray before sizing the canvas. On wide screens, center the same logical board and use a modest side panel for objectives and tile descriptions. On short landscape screens, place controls beside the board. Rotation preserves the simulation state and shot angle.

Use HTML for menus, settings, objective text, and results. Make action controls at least 44 × 44 CSS pixels and give icon buttons accessible names and pressed states. Support keyboard focus, an angle input, high contrast, reduced motion, separate music/SFX volumes, and a no-flash option. Summarize turn outcomes in a restrained live region, not every collision. A textual board inspector can identify targets and coordinates; full nonvisual puzzle play requires a separately designed interaction model and should not be implied by adding ARIA labels alone.

Sound should reinforce materials: a short ceramic clink, a lower reinforced hit, a silver mirror tone, a quiet chain progression, and a warm restoration cadence. Use a subtle wind bed and sparse musical phrases. Limit simultaneous voices and avoid sharp repetitive square-wave pings. All important information also has visual feedback. Provide a music-off preset while retaining effect cues.

Initialize or resume audio during a user gesture and handle a suspended context gracefully. Save audio preferences locally. This follows the behavior documented for [AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume); actual browser and device testing remains necessary.

**10. Client-side architecture and storage**

Keep PixiJS 8 for rendering, pinned and bundled with the game. Use JavaScript modules, JSDoc types, HTML, and CSS; a small development build tool can emit plain static files. Add TypeScript only if it improves maintainability for the people implementing the game. Use the existing prototype as a reference, then move the core into small modules. A full general-purpose ECS is unnecessary for this scope.

Separate the pure simulation from rendering. It takes serializable board state plus a shot command and produces the next state and ordered events. The renderer turns those events into effects and sounds. Prediction runs the same rules on a cloned state. Replays store the seed, level/content version, selected angles, and ability actions. Stable IDs and explicit tie-breaking handle simultaneous events reproducibly; do not promise bit-for-bit floating-point equivalence across every browser.

Suggested responsibilities: `game/state`, `game/physics`, `game/rules`, `game/preview`, `game/levels`, `game/progression`, `input/pointer`, `input/keyboard`, `render/board`, `render/effects`, `ui/menus`, `audio`, and `storage`. Level files and an asset manifest remain data. Keep build, test, and authoring tooling outside runtime logic.

State transitions should be explicit: loading → menu → tutorial/aiming → flight → resolving → descent → aiming, with victory, defeat, and pause branches. Check campaign victory before applying further pressure. Guard input by phase. Retry reconstructs level state and disposes previous visual state, effects, and listeners.

Physics uses a fixed 1/120-second step and a bounded accumulator. Select the earliest event across floor, walls, and tiles. Use explicit parallel-axis handling, correct normals, deterministic corner ties, and overlap recovery. Expanded rectangles are an approximation around circular corners; either use proper swept circle corner tests or choose and document a deliberately forgiving arcade shape. Add polygon collision only when sloped mirrors ship. Fast-forward advances additional identical fixed steps, with a bounded budget, and never alters the damage rules.

Use one effects update list with pooled sprites. Reuse aim graphics; avoid per-frame timers and per-particle ticker listeners. Bound particle count, release destroyed display objects, and preserve shared textures until the game itself shuts down. Cap rendering resolution, initially at 2, and lower effects on slower devices. A renderer failure should produce a readable retry/help screen. A complete Canvas 2D renderer is a later option, not a second engine required for the first release.

Store small versioned progress and settings in localStorage: unlocked chambers, best stars, cosmetics, preferences, and the latest save. Save campaign state at stable turn boundaries; if the browser closes in flight, restore the pre-shot checkpoint and say so. If a save uses an incompatible content version, keep earned progress and restart the affected chamber. Validate imports, tolerate unavailable storage, and offer JSON export/import. Larger replay archives can use IndexedDB later. Storage clearing can remove local progress; no account or server sync is assumed.

Bundle every required font, texture, sound, level, and library on the same static origin. Add a scoped service worker and versioned cache after deployment is stable. Offer an update between chambers, not in the middle of a shot. Offline play works after the necessary assets have been cached. Service workers need HTTPS in production, with localhost supported for development, as documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers). Static hosting satisfies that requirement without game server logic.

No backend is needed for campaign, cosmetic unlocks, local records, seeds, replay exports, or an installable offline version. Global authenticated leaderboards, cross-device saves, authoritative daily scoring, and multiplayer would need additional infrastructure and are outside this design.

**11. Delivery sequence and acceptance gates**

Effort ranges are planning estimates for one experienced developer with timely art support. They exclude external review delays and should be revised after the six-level slice.

| Stage | Estimated effort | Concrete deliverable | Gate before expanding |
| --- | --- | --- | --- |
| A. Repair the foundation | 2–4 development days | Correct sizing, single initialization, collision fixes, effect cleanup, restart, pause, and stable input. | Board and launcher visible at tested sizes and DPRs; no overlapping startup slots; no forced loss from fixtures; repeated retries release resources. |
| B. Prove the game | 5–8 days | Six authored levels, shared preview/simulation, exact objectives, finite pressure, four tile types, one ability, tutorial, and result UI. | New players understand the loop; preview first contact matches flight; every level has a replayable completion route; failure is explainable. |
| C. Establish the look and feel | 4–7 days, partly overlapping B | First art kit, sound kit, readable UI, responsive layouts, settings, and restoration reveal. | Controls and HP readable on a small phone; muted/reduced-motion play remains clear; frame time stays within budget on chosen devices. |
| D. Build the campaign | 10–15 days | 24 levels across four chapters, finales, atlas journal, cosmetic milestones, local progress, and save migration. | A fresh save can complete the whole campaign; progression never requires star grinding; no dead ends or invalid scripted waves. |
| E. Release and replay | 4–7 days | Offline cache, browser/device QA, import/export, tested Daily Mosaic catalog, and optional Endless. | Static deployment passes offline and update checks; daily seed/version behavior is repeatable; save failures are recoverable. |

This is approximately 25–41 development days before allowing for production art and revision. Endless and prism/echo interactions are the first expansion items to defer if they threaten the campaign quality. Six finished levels are a useful standalone release.

**12. Verification and playtesting**

Automated checks should exercise the fragile systems, especially pure simulation. Cover wall impacts, brick faces and corners, equal-time contacts, initial overlaps, zero velocity components, a wall before floor landing, pierce exit/re-entry damage, chain propagation, orb return, pressure and wave ordering, fixture exclusion, and victory before descent. Replay identical commands at 1× and accelerated speed and compare board outcomes. Compare preview first contact with flight. Validate every level and replay a known successful command sequence for each authored chamber. A known route proves that route works; it does not replace playtesting.

Use browser integration checks for launch/cancel, HUD isolation, pause/resume, retry, level transition, save/load, denied storage, corrupt imports, resize, and renderer failure. Profile ten minutes of active play and twenty retries; active effect and listener counts should return to baseline after cleanup, with no sustained memory growth attributable to game objects.

Test at 320 × 568, 390 × 844, a short landscape viewport, tablet, and desktop, with DPR 1, 2, and 3. Include real iOS Safari and Android Chrome, then desktop Safari, Firefox, and Chromium. Verify touch interruption, scrolling boundaries, keyboard focus, tab hiding, audio unlock, and rotation. Viewport emulation alone does not verify device touch behavior.

Initial performance goals: 60 FPS on the chosen midrange mobile test device during typical play, a playable 30 FPS reduced-effects fallback, simulation work bounded per frame, and compressed initial assets around 3 MB with a hard review above 5 MB. Cache or load later chapter art separately. Measure loading on a throttled mobile connection; do not confuse a byte budget with a guaranteed load time.

Run early usability sessions with five new players across phone and desktop. Observe whether they launch deliberately, bank without coaching, see the danger line, understand a mirror, and can recover from failure. Record completion and confusion, then revise before producing the other 18 levels. Treat target completion rates as tuning goals: roughly 80% first-attempt completion of the opening pressured levels and substantially lower, but recoverable, finale success. Session results determine the actual thresholds.

**13. First implementation backlog**

The first work should repair `main.js`, `style.css`, and the HTML shell sufficiently to establish a trustworthy baseline, then extract simulation and level data. Preserve the original design document as historical context and make this proposal the working direction after implementation begins.

1. **P0 sizing:** measure the available container, fix density/CSS sizing, use consistent logical transforms, account for border dimensions, and add resize/rotation handling.
2. **P0 initialization and rules:** remove the duplicate top spawn, replace the contradictory descent configuration, separate fixtures from targets, and add finite scripted levels and a win check.
3. **P0 simulation:** correct side normals, unify floor and collision event ordering, define corner and overlap behavior, bound catch-up, and pause on visibility loss.
4. **P0 lifecycle:** replace obsolete ticker assumptions, pool effects, remove callbacks correctly, and ensure retry returns to a clean baseline.
5. **P1 controls:** implement pointer capture/cancel, intentional launch validation, tap-to-aim, keyboard angle control, and menu isolation.
6. **P1 prediction:** create a pure shot simulator, reuse it in the guide, include destruction and landing, and remove per-frame graphic/timer creation.
7. **P1 complete sessions:** add objective HUD, pause/help, victory/defeat panels, replay/next controls, and saveable turn boundaries.
8. **P1 six-level slice:** author the first chapter, its tutorial and finale; introduce readable HP, anchored mirrors, chains, and Pierce.
9. **P1 presentation:** replace the brown/noise-heavy composition, enlarge important cues, add material sound, and provide contrast/motion/audio settings.
10. **P2 expansion:** build the remaining campaign, journal, cosmetic milestones, offline cache, and replay modes after the slice passes its acceptance gate.

The key production decision is to validate trustworthy aiming and six satisfying geometric puzzles before investing in a large content library. That gives Dune Arcanum a distinct identity and provides a measurable basis for every later art, progression, and difficulty decision.
