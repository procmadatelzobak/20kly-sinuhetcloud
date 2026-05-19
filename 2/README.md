# 20ly — TypeScript reimplementation

Faithful TypeScript/Canvas2D reimplementation of
[20,000 Light Years Into Space](https://www.jwhitham.org/20kly/)
(original: Jack Whitham, GPL2).

The Pyodide/Python port is in the repo root. This folder contains a from-scratch
TypeScript rewrite that mirrors the original game mechanics exactly, using the
original `lib20k/` source as a reference for algorithms and constants.

## Status

> **Not started yet.** Placeholder for future work.

## Planned architecture

```
2/
├── src/
│   ├── main.ts              — async entry point (Vite)
│   ├── engine/
│   │   ├── loop.ts          — 35 FPS game loop (fixed timestep)
│   │   ├── input.ts         — mouse/keyboard events
│   │   └── render.ts        — Canvas2D blit, sprite animation
│   ├── sim/
│   │   ├── steam.ts         — RC-circuit pressure/flow (port of steam_model.py)
│   │   ├── network.ts       — pipe network topology (port of network.py)
│   │   └── grid.ts          — spatial hash, pipe intersections
│   ├── entities/
│   │   ├── city.ts
│   │   ├── node.ts
│   │   ├── well.ts
│   │   └── pipe.ts
│   ├── ai/
│   │   ├── aliens.ts        — 3 attack strategies (port of alien_invasion.py)
│   │   └── seasons.ts       — START→QUIET→ALIEN→QUAKE→STORM cycle
│   ├── ui/
│   │   ├── menu.ts
│   │   └── hud.ts
│   └── persistence/
│       └── save.ts          — JSON → localStorage (replaces pickle .dat)
├── public/
│   └── data/                — symlink or copy of ../../data/ (GPL2 assets)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Key references (from original lib20k/)

- `lib20k/steam_model.py` — RC-circuit physics (port 1:1, unit-testable)
- `lib20k/network.py` — 10 wells + bootstrap, wavefront algorithm
- `lib20k/difficulty.py` — all balance constants
- `lib20k/alien_invasion.py` — AI strategies, wave spawning
- `lib20k/game_types.py` — type aliases

## License

GPL2 (inherits from original).
