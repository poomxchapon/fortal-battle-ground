# Fortal Battle Ground

3-Player Co-op vs AI Territory Control Game for LED Floor

## How to Play

1. Open the game: https://poomxchapon.github.io/fortal-battle-ground/
2. Generate or enter a **Room ID**
3. Each player picks a different role:
   - **Vanguard** - LED Floor Runner (must open first, acts as host)
   - **Striker** - FPS Shooter
   - **Commander** - Strategy/Skills

## Roles

| Role | View | Controls | Special |
|------|------|----------|---------|
| Vanguard | Top-down | WASD | Permanent Rage (paint trail) |
| Striker | FPS | Mouse aim + Click shoot | Assault / Railgun modes |
| Commander | Top-down | 1-4 skills + Click to deploy | Hero, Turret, Meteor, Boss |

## Game Mode: Hyper Battle (5 min)

- Grid: 18x39
- Objective: Control more territory when time runs out
- Both teams spawn minions every 10 seconds
- Ultimate Gauge unlocks Boss summon at 100%

## Tech Stack

- Three.js (3D rendering)
- PeerJS (P2P networking via WebRTC)
- Pure HTML/JS (no build step)

## Network Architecture

- Vanguard = Host (authoritative server)
- Striker/Commander = Clients (receive state, send actions)

---

Made by Fortal Interactive
