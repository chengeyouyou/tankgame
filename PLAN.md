# 网页版原创 8-bit 坦克大战规格说明

## Problem Statement

玩家希望直接在桌面浏览器中获得接近经典红白机坦克大战的规则、节奏、像素表现和本地双人合作体验，但现有项目为空，尚无可运行游戏、工程基础、原创素材、关卡、存档或关卡编辑能力。同时，产品不能依赖原作 ROM、精灵、音效、音乐或关卡布局，需要在保留经典玩法手感的前提下，以原创内容规避不必要的版权风险。

## Solution

构建一款纯静态、无需后端的中文版桌面浏览器游戏。游戏采用原创 8-bit 像素素材、原创音效和 35 张原创关卡，在固定像素画布上实现单人战役、本地双人合作、经典地形与破坏、四类敌军、道具、升级、计分、逐关结算和高周目循环。

游戏同时提供键盘与双手柄操作、暂停与音量控制、本地进度保存，以及使用统一版本化关卡格式的可视化编辑器。编辑器支持本地保存、撤销/重做、即时试玩和 JSON 导入导出；自制关卡与官方战役成绩相互隔离。

## User Stories

1. As a desktop player, I want to open the game in a modern browser, so that I can play without installing a native application.
2. As a nostalgic player, I want a crisp fixed-resolution pixel presentation, so that the game feels like an 8-bit console title.
3. As a nostalgic player, I want movement, turning, shooting, collisions, spawning, and stage pacing to resemble classic tank combat, so that the experience feels familiar.
4. As a player, I want all artwork, maps, and sounds to be original, so that I can enjoy a respectful homage rather than copied content.
5. As a player, I want to choose single-player from the title menu, so that I can play the campaign alone.
6. As two local players, we want to choose cooperative two-player mode, so that we can defend the same base together on one screen.
7. As a keyboard player, I want clearly documented default controls, so that I can begin playing immediately.
8. As player one, I want to move with WASD and fire with F or Space, so that my controls are comfortable and independent.
9. As player two, I want to move with the arrow keys and fire with Enter or Right Control, so that I can share a keyboard with player one.
10. As two keyboard players, we want simultaneous movement and firing to register reliably, so that browser key handling does not disadvantage either player.
11. As a gamepad player, I want a connected controller to be detected at runtime, so that I know it is ready to use.
12. As two gamepad players, we want separate controller mappings, so that we can play local co-op without sharing a keyboard.
13. As a player, I want game keys not to scroll the page, so that input remains inside the game.
14. As a player, I want the game to pause when the browser loses focus, so that I am not defeated while attending to another window.
15. As a player, I want to resume without skipped simulation or stuck inputs, so that focus changes do not corrupt play.
16. As a player, I want to pause and resume manually, so that I can interrupt a session safely.
17. As a player, I want to mute and adjust volume, so that I can control the sound without leaving the game.
18. As a browser user, I want audio to begin only after an interaction, so that the game respects autoplay restrictions.
19. As a player, I want distinct original sounds for movement, shots, impacts, explosions, power-ups, stage openings, and results, so that gameplay feedback is clear.
20. As a player, I want tanks to move only in four directions with deliberate grid-like alignment, so that steering has the expected classic precision.
21. As a player, I want turning and movement to respond predictably near walls, so that navigating narrow passages feels fair.
22. As a player, I want tanks, bullets, map boundaries, and terrain to collide consistently, so that outcomes are understandable.
23. As a player, I want firing limits to change with upgrades, so that progression has an immediate gameplay effect.
24. As a player, I want opposing bullets to destroy each other, so that defensive shooting is possible.
25. As a player, I want a visible spawn animation and temporary protection, so that newly spawned tanks cannot be destroyed unfairly.
26. As a player, I want destructible brick walls with partial damage, so that shots reshape tactical routes rather than removing whole blocks at once.
27. As an upgraded player, I want powerful ammunition to destroy steel, so that maximum weapon upgrades open new tactical choices.
28. As a player, I want water to block tanks, so that it creates meaningful movement constraints.
29. As a player, I want forest tiles to visually cover tanks without blocking them, so that concealment affects situational awareness.
30. As a player, I want ice to preserve sliding momentum, so that frozen areas require different steering.
31. As a player, I want the home base to be vulnerable to all live ammunition, so that protecting it remains the central objective.
32. As a player, I want the stage to end immediately when the base is destroyed, so that the loss condition is unambiguous.
33. As a campaign player, I want each stage to contain a configured wave of 20 enemies, so that progression follows a recognizable classic structure.
34. As a player, I want no more than four enemies active simultaneously, so that challenge remains readable and period-authentic.
35. As a player, I want standard, fast, armored, and rapid-fire enemies, so that waves require varied responses.
36. As a player, I want flashing enemies to carry rewards, so that I can identify opportunities to obtain power-ups.
37. As a player, I want enemy tanks to make local directional decisions rather than use perfect pathfinding, so that their behavior feels classic rather than omniscient.
38. As a player, I want enemy pressure to rise across stages through spawn timing, firing frequency, armor, speed, and wave composition, so that the campaign becomes progressively harder.
39. As a player, I want enemy AI to retain a limited preference for players and the base, so that encounters remain purposeful without feeling like cheating.
40. As a player, I want tank power-ups to grant an extra life, so that risky reward collection can extend a run.
41. As a player, I want star power-ups to improve my weapon level, so that successful play increases combat strength.
42. As a player, I want grenade power-ups to destroy active enemies, so that I can recover from a crowded battlefield.
43. As a player, I want helmet power-ups to provide temporary invulnerability with visible feedback, so that their duration is understandable.
44. As a player, I want clock power-ups to freeze enemies temporarily, so that I gain a tactical respite.
45. As a player, I want shovel power-ups to reinforce the base perimeter temporarily, so that base defense can recover from damaged walls.
46. As a player, I want reinforced base walls to flash before reverting, so that I can anticipate the protection ending.
47. As a player, I want upgrades, lives, deaths, and stage transitions to follow consistent campaign rules, so that progression never feels arbitrary.
48. As a player, I want a sidebar showing remaining enemies, player lives, and current stage, so that essential status is visible without opening a menu.
49. As a player, I want points for defeating different enemy types and collecting rewards, so that skillful play is measurable.
50. As a player, I want a stage result screen showing kills by enemy type, stage score, and total score, so that I can review my performance.
51. As a campaign player, I want 35 distinct original stages, so that the game provides a complete long-form experience.
52. As a campaign player, I want each stage to define terrain, enemy composition, and difficulty parameters, so that stages have distinct tactical identities.
53. As a campaign player, I want unlocked progress and high scores to survive page refreshes, so that I can return later.
54. As a campaign player, I want completion of stage 35 to produce a final result, so that the campaign has a satisfying conclusion.
55. As an experienced player, I want to continue into a harder loop after finishing the campaign, so that the game remains replayable.
56. As a co-op player, I want both players to share the objective while retaining separate lives and upgrades, so that cooperation and individual risk both matter.
57. As a surviving co-op player, I want play to continue when my partner has no active tank but can still respawn, so that a temporary death does not incorrectly end the stage.
58. As two defeated co-op players, we want the run to end only when neither player can return, so that the failure rule is fair.
59. As a player, I want settings and control preferences to persist locally, so that I do not have to reconfigure every visit.
60. As a player, I want corrupted or obsolete save data to fall back safely, so that storage problems do not prevent the game from loading.
61. As a player, I want a help screen explaining controls, terrain, enemies, and power-ups, so that I can learn without external documentation.
62. As a level creator, I want a grid editor with a terrain palette, so that I can construct custom battlefields visually.
63. As a level creator, I want tools for the base, player spawns, and enemy spawns, so that custom stages contain every required gameplay element.
64. As a level creator, I want to configure the 20-enemy queue and difficulty values, so that my stage controls both layout and pacing.
65. As a level creator, I want undo and redo, so that editing mistakes are inexpensive to correct.
66. As a level creator, I want to clear, rename, duplicate, and delete a custom stage, so that I can manage local creations.
67. As a level creator, I want live validation with understandable Chinese errors, so that I know how to make a stage playable.
68. As a level creator, I want to test the current draft immediately, so that I can evaluate it without exporting first.
69. As a level creator, I want my unsaved draft preserved when returning from playtest, so that iteration is fast.
70. As a level creator, I want custom stages stored in my browser, so that they remain available between visits without an account.
71. As a level creator, I want to export a versioned JSON file, so that I can back up or share a stage manually.
72. As a level creator, I want to import a valid versioned JSON file, so that I can play or modify a shared stage.
73. As a level creator, I want malformed, oversized, or out-of-range imports rejected safely, so that untrusted files cannot destabilize the game.
74. As a campaign player, I want custom-stage results excluded from campaign unlocks and official high scores, so that progression remains trustworthy.
75. As a player on Chrome, Edge, or Firefox, I want consistent controls, rendering, audio, and storage behavior, so that browser choice does not materially change the experience.
76. As a player with a common desktop resolution, I want the game to preserve its aspect ratio and pixel sharpness, so that resizing does not distort the presentation.
77. As a player on normal desktop hardware, I want stable 60 FPS simulation and responsive controls, so that timing-dependent play feels reliable.
78. As a maintainer, I want deterministic simulation from a level, seed, and input sequence, so that gameplay regressions can be reproduced exactly.
79. As a maintainer, I want built-in and imported levels to use the same schema and validator, so that there is one definition of a playable stage.
80. As a maintainer, I want game rules independent of browser rendering and audio, so that behavior can be tested without relying on visual timing.

## Implementation Decisions

- The application will use TypeScript with strict type checking and Vite as the build and development foundation. It will be a static client-only application with no runtime backend.
- Canvas 2D will render the game. Web Audio API will synthesize or play original audio, and Gamepad API will support up to two local controllers. No heavyweight game engine will be introduced.
- The logical presentation will use a 256×240 NES-style coordinate space. Image smoothing will be disabled. The preferred display uses integer scaling; when the viewport is too small, the game will preserve aspect ratio and prioritize crisp nearest-neighbor presentation.
- The architecture will separate deterministic game simulation, input mapping, scene/application flow, Canvas rendering, audio event handling, level data, persistence, and editor behavior. Rendering and audio may observe snapshots and emitted events but may not mutate simulation state.
- The primary gameplay seam will expose creation of a world from validated level data and a seed, submission of player commands for a tick, advancement by one fixed tick, and observation of a read-only snapshot plus domain events. This is the stable contract used by the runtime, playtests, and rule verification.
- Simulation will advance at a fixed 60 Hz using integer or fixed-point coordinates. Rendering may interpolate visually but cannot change outcomes. Accumulated time will be capped, and focus restoration will discard stale elapsed time rather than replay a burst of missed ticks.
- Random behavior will use a seeded generator owned by simulation state. A level, seed, and ordered input stream must always produce the same observable state and events.
- Stable domain types will cover tile types, tank kinds, power-up kinds, game modes, game phases, input commands, simulation events, level data, and versioned save data. Exhaustive handling will be enforced for game-state unions.
- Terrain will include empty ground, partially destructible brick, steel, water, forest, ice, and base tiles. Collision and projectile rules are domain rules, while draw order such as forest covering tanks is a renderer concern.
- Tanks will use four-direction movement with alignment assistance near tile lanes, discrete facing, entity collision, configurable speed, shot cooldown, active-shot limits, armor, weapon level, spawn protection, and life state.
- Projectile resolution will cover terrain impacts, partial brick damage, upgraded steel damage, tank damage, base destruction, opposing-projectile cancellation, ownership, and scoring. Collision ordering for a tick must be explicit and deterministic.
- Each campaign stage will contain exactly 20 enemy entries and permit no more than four simultaneously active enemies. Enemy kinds will be standard, fast, armored, and rapid-fire; reward-carrying enemies will have a clearly visible flashing state.
- Enemy AI will use local direction choices at obstacles and decision points, with configurable probabilistic preferences toward players or the base. It will not use full-map shortest-path pursuit or knowledge unavailable through game state.
- Difficulty will be data-driven through spawn interval, firing tendency, directional bias, speed/armor composition, and new-game-plus multipliers. Campaign difficulty changes must not require renderer changes.
- Power-ups will include extra life, weapon star, grenade, invulnerability helmet, enemy-freezing clock, and base-fortifying shovel. Timed effects will be measured in simulation ticks and emit warning/expiry events for presentation.
- Weapon progression will affect projectile speed, concurrent-shot capacity, and steel-destruction capability. Player death, respawn, stage carry-over, and downgrade behavior will use one centralized campaign ruleset rather than scene-specific logic.
- The scene state machine will cover loading, title, mode selection, help, settings, stage introduction, active play, pause, stage results, game over, campaign completion, and editor. Illegal transitions will be ignored or rejected predictably.
- Default keyboard controls will be P1: WASD plus F or Space; P2: arrow keys plus Enter or Right Control; Esc pauses and M toggles mute. Input will use held/released state rather than relying on browser key-repeat behavior.
- Gamepads will be polled each frame and normalized to the same player-command model as keyboards. Connection/disconnection feedback will not pause keyboard play.
- Audio initialization will occur only after a user gesture. Engine loops and one-shot effects will be driven by simulation or scene events. Mute and master-volume controls will persist.
- A versioned local save will include settings, volume/mute state, control preferences, high score, highest unlocked campaign stage, and custom-level records. Parsing will validate all fields and return safe defaults for unsupported or corrupted data.
- The level schema will include version, stable ID, display name, fixed-size terrain matrix, one base, player spawn positions, enemy spawn positions, a 20-entry enemy queue, difficulty parameters, and optional author metadata.
- One validator will be used for bundled levels, editor drafts before playtest, and imported files. It will verify dimensions, known values, unique required entities, spawn occupancy, queue length, numeric limits, and sufficient legal play space.
- Validation failures will be represented as structured issues that include a code, Chinese message, and relevant map position or field when available. Invalid levels will never enter simulation.
- The official campaign will provide 35 original, validated levels. No level may copy the original game's stage layout. Completion of stage 35 unlocks an endless campaign loop with deterministic difficulty multipliers.
- The editor will use the same tile grid and schema as runtime play. It will support terrain/entity tools, enemy queue and difficulty controls, bounded undo/redo history, validation, local CRUD operations, import/export, and immediate playtesting.
- Editor playtest will clone the current draft into a temporary session. Returning to the editor restores the exact draft and undo history. Playtest scores and progress cannot update campaign records.
- JSON import will enforce file-size, nesting, array-length, string-length, and numeric bounds before accepting data. Unknown schema versions will produce an actionable error rather than being guessed or silently coerced.
- All sprites, terrain, icons, animation frames, font treatment, sound effects, jingles, and stage layouts will be original or programmatically generated. The project will not include extracted ROM data or copied game assets.
- The user-facing game will be Chinese-first. Internal identifiers and data keys will remain English and presentation strings will be kept outside simulation logic to permit later localization.
- Documentation will state that the game is an original homage and is not affiliated with the original rights holders.

## Testing Decisions

- Tests will assert externally observable behavior at the highest practical seam. They will provide validated level data, seeds, and player command streams to the simulation contract, then assert snapshots and emitted domain events rather than private functions, internal arrays, or rendering implementation.
- The second acceptance seam will be the running browser application. Browser tests will interact through menus, controls, persistence, editor UI, and visible outcomes. This is necessary because Canvas, focus, keyboard concurrency, Gamepad adaptation, audio gating, and local storage cannot be fully verified through the pure simulation seam alone.
- There is no prior test suite or testing convention because the repository currently contains only this specification. The chosen prior-art baseline is Vitest for deterministic domain behavior and Playwright for user-visible browser journeys.
- Rule tests will cover movement and lane alignment, turning, map/entity collision, terrain passability, partial brick damage, upgraded steel damage, forest draw-order signals, ice momentum, projectile cancellation, tank damage, armor, base destruction, and tick ordering.
- Campaign tests will cover lives, upgrades, death/downgrade, spawn protection, score attribution, 20-enemy wave completion, active-enemy limits, stage results, unlock progression, game over, stage-35 completion, and harder-loop transitions.
- Power-up tests will cover collection eligibility, immediate effects, timed durations, warning behavior, overlapping/repeated effects, freeze behavior, base-wall reinforcement, wall restoration after damage, and effect cleanup during stage transitions.
- AI tests will assert legal decisions, seed determinism, no spawn overlap, obstacle response, bounded target bias, firing rules, and long-running ability to process a complete configured wave. They will avoid asserting one exact direction unless the seed and state make it part of the public deterministic outcome.
- Co-op tests will cover simultaneous commands, separate lives and upgrades, shared objective behavior, respawn eligibility, one-player elimination, both-player elimination, scoring ownership, and independent keyboard/controller mapping.
- Level tests will validate every bundled campaign stage and representative valid custom stages. Invalid cases will include wrong dimensions, unknown tiles, missing/duplicate base, illegal spawns, occupied spawns, incorrect enemy counts, invalid difficulty limits, unreachable or unusable play space, unsupported versions, and oversized payloads.
- Editor tests will cover painting and entity placement through user actions, bounded undo/redo, clear, rename, duplicate, delete, validation feedback, local persistence, JSON round-trip stability, playtest entry, and exact draft restoration afterward.
- Persistence tests will cover new users, valid current saves, partially corrupted values, wholly malformed JSON, unsupported versions, storage quota/errors, and preservation of unrelated safe preferences during fallback where possible.
- Determinism tests will run identical seeds and input streams twice and compare complete observable results. Additional timing tests will prove that rendering frame cadence, pause duration, and focus loss do not alter fixed-tick results.
- Browser acceptance tests will cover loading to the title menu, entering single-player and two-player modes, concurrent keyboard input, pause/resume, mute/volume, stage victory, base defeat, game over, refresh persistence, help/settings, editor import, and custom-stage playtest.
- Rendering acceptance will verify the 256×240 aspect ratio, disabled smoothing, stable scale behavior, legible HUD, scene transitions, and absence of page scrolling on Chrome, Edge, and Firefox current stable versions at representative desktop viewport sizes.
- Performance verification will use a representative worst-case stage with maximum enemies, projectiles, foliage, effects, and active co-op input. On ordinary desktop hardware it must sustain the 60 Hz simulation without unbounded frame debt or input lag.
- Manual feel acceptance will compare acceleration response, four-direction turning, lane navigation, shot cadence, spawn animation, explosion timing, enemy pressure, stage opening, and result pacing against the intended classic-console feel while confirming that assets and maps are visibly original.
- A release candidate is acceptable only when all 35 bundled levels pass schema validation, can start without overlap, can resolve the full enemy queue, and preserve the base/player spawn invariants.

## Out of Scope

- Online multiplayer, networking, matchmaking, rooms, rollback synchronization, spectators, and remote-save synchronization.
- User accounts, cloud saves, online leaderboards, achievements services, analytics, advertisements, purchases, or other backend features.
- Mobile-first layouts, touch controls, virtual joysticks, and mobile browser performance guarantees.
- Publishing, browsing, rating, moderating, or downloading levels from a cloud community library.
- Copying original ROM data, sprites, fonts, music, sound effects, UI graphics, exact balancing tables, or any of the original 35 stage layouts.
- Three-or-more-player modes, competitive PvP, new tank classes beyond the defined classic-inspired set, or non-campaign game modes.
- A general-purpose scripting/modding API beyond versioned level JSON import and export.
- Accessibility localization beyond the initial Chinese interface, although architecture must not prevent later localization.
- Native desktop or console packaging in the first release.

## Further Notes

- The repository is currently an empty, non-Git directory except for this specification; there are no existing modules, domain glossary, ADRs, tests, or engineering conventions to preserve.
- “完整复刻体验” means faithful mechanics, tempo, fixed-pixel composition, and local co-op—not copied copyrighted content.
- The selected testing seams are the deterministic simulation contract for gameplay rules and the browser application for end-to-end user behavior. These are the minimum two seams needed to cover both timing-sensitive rules and browser integration without testing internal implementation details.
- The site is expected to deploy to any static hosting provider. All durable user data remains in local browser storage or user-managed JSON files.
- Issue-tracker configuration and triage-label vocabulary were not provided, so this specification has been written locally but cannot yet be published or labeled `ready-for-agent`. Run `/setup-matt-pocock-skills` to configure that workflow, then publish this specification unchanged unless project vocabulary or ADRs are introduced first.
