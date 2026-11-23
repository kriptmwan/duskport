# Duskport

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kriptmwan/duskport/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kriptmwan/duskport/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A neon open-world crime game, built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01) (gta6-01). Original city, characters, story, art and music — nothing from any commercial game.

## Play

Serve `game/` with any static server (or `node serve.ts`, then open http://localhost:8080) and open `game/index.html` in desktop Chrome. No network needed; everything is local files.

## Controls

- **WASD** — move (on foot) / drive (in car)
- **Mouse** — aim, **Click** — shoot
- **E** — enter / exit car (steal any parked or traffic car)
- **1 / 2 / 3** — pistol / SMG / shotgun (buy at the gun shop)
- **M** — map, **P** or **Esc** — pause, **R** — radio station
- **F5** quick-save is automatic: progress saves to localStorage

## The game

Duskport is a sun-soaked harbor city in five districts: Downtown, Old Town, Harbor, Industrial and the Palms suburbs. Take on 8 story missions for the fixer Mara Voss — deliveries, escapes, tails and takedowns — while the Duskport PD hunts you on a 0–5 star wanted scale. Earn cash, buy car upgrades and better guns at the garage and gun shop, climb the respect ranks from Street to Kingpin, and own the city one district at a time.

- Open world on foot and by car, with traffic and pedestrians
- Wanted system with police chases, roadblocks and a hide/evade cooldown
- 8 story missions with GPS guidance and minimap blips
- Day/night cycle, rain, synth radio, save/load
- 3 screenshots in `screenshots/` show the game itself

## Tech

Vanilla JavaScript, canvas 2D, no libraries, no build step. Seeded RNG makes the city layout deterministic. Source is split by job: `game/src/config.js`, `random.js`, `world.js`, `player.js`, `vehicles.js`, `police.js`, `missions.js`, `audio.js`, `ui.js`, `render.js`, `input.js`, `main.js`.

## License

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=emz2619t&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
