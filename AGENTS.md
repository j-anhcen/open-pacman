# AGENTS.md

Static vanilla-JS Pac-Man: no build step, no dependencies, no tests. The repo exists to practice spec-driven development (see below).

## Run / verify

- There is no `package.json`, bundler, linter, or test runner. Do not invent `npm test` / `npm run ...` commands.
- Run by opening `src/index.html` directly in a browser (or any static server). Verification is manual: arrow keys to move, overlay buttons to start/restart.

## Architecture

- `src/index.html` loads plain `<script>` tags in order: `maze.js` → `game.js` → `render.js` → `main.js`. Order matters.
- No ES modules / `import`. Files share state through `window` globals: `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` (maze.js), `createGame` / `update` / `DIRS` (game.js), `draw` (render.js). When adding a file, add its `<script>` tag in the correct position and export via `window`.
- Responsibilities: `maze.js` = pristine level data + constants; `game.js` = state and rules (`update`); `render.js` = canvas drawing; `main.js` = game loop, keyboard, overlay/start screens.

## Maze & movement (easy to get wrong)

- Grid is 28×31 cells, `TILE = 20` (canvas 560×620). Tile codes: `0` empty, `1` wall, `2` dot, `3` pen door.
- `MAZE` is immutable. Each game copies it into `game.grid`; read and mutate `game.grid` (render draws from it), never `MAZE`.
- `TUNNEL_ROW = 14`: actors wrap horizontally only on that row.
- Pac-Man is blocked by walls (1) and the pen door (3); ghosts are blocked only by walls (1).
- Speeds are fractional (Pac-Man 0.125, ghosts 0.1). Direction changes and dot-eating happen only when the actor is cell-`aligned()`; don't snap positions anywhere else.

## Spec-driven workflow (the point of this repo)

- Repo-local skills live in `.agents/skills/` (`spec`, `spec-impl`), pinned in `skills-lock.json`.
- Specs live in `specs/NN-slug.md` (the folder does not exist yet). Flow: author with `/spec`, then a human flips `**Status:**` to `Approved`, then `/spec-impl NN-slug` implements it step by step on a `spec-NN-slug` branch.
- `/spec-impl` refuses any spec whose status does not mean "Approved". Optional `specs/.spec-config.yml` controls `AutoCreateBranch` (default true) and `AutoCommitSteps` (default false).
- `.agents/skills/spec/template.md` defines the required spec sections and valid states — follow it when writing a spec.

## Conventions

- Comments, README, and UI strings are in Spanish. Match the existing language.
- Code style uses spaces inside parens/brackets (e.g. `if ( x )`, `grid[ y ][ x ]`) and 2-space indentation. Match it.
