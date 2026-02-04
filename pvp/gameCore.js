// ==================== FORTAL BATTLE GROUND - PVP MODE ====================
// 3v3 Team Battle - Blue vs Red

const GAME_CONFIG = {
    // Grid
    GRID_WIDTH: 18,
    GRID_HEIGHT: 39,
    CELL_SIZE: 1.5,

    // Time
    GAME_DURATION: 5 * 60, // 5 minutes

    // Teams
    TEAM_BLUE: 1,
    TEAM_RED: 2,

    // Colors
    COLOR_NEUTRAL: 0x2c3e50,
    COLOR_BLUE: 0x3498db,
    COLOR_RED: 0xe74c3c,

    // Minion spawn
    MINION_SPAWN_INTERVAL: 12, // seconds
    MINIONS_PER_SPAWN: 2,

    // Skills cooldowns (seconds)
    SKILL_HERO_CD: 15,
    SKILL_TURRET_CD: 25,
    SKILL_METEOR_CD: 40,

    // Unit stats
    UNITS: {
        soldier: { hp: 100, atk: [8, 11], speed: 2, size: 1.5, color: 0x95a5a6 },
        hero: { hp: 200, atk: [18, 22], speed: 1.5, size: 3.0, color: 0xf1c40f },
        turret: { hp: 500, atk: [58, 64], speed: 0, size: 3.0, area: 5, color: 0x1abc9c },
        boss: { hp: 3000, atk: [80, 90], speed: 0.3, size: 7.5, color: 0x8e44ad }
    }
};

// ==================== GAME STATE ====================
const createGameState = () => ({
    timeRemaining: GAME_CONFIG.GAME_DURATION,
    gameStarted: false,
    gameEnded: false,

    // Players - 6 total (3 per team)
    players: {
        blue: {
            vanguard: { connected: false, x: GAME_CONFIG.GRID_WIDTH / 2, y: GAME_CONFIG.GRID_HEIGHT - 3, trail: true },
            striker: { connected: false, yaw: 0, pitch: 0, kills: 0 },
            commander: {
                connected: false,
                skills: {
                    hero: { ready: true, cooldown: 0 },
                    turret: { ready: true, cooldown: 0 },
                    meteor: { ready: true, cooldown: 0 }
                }
            }
        },
        red: {
            vanguard: { connected: false, x: GAME_CONFIG.GRID_WIDTH / 2, y: 3, trail: true },
            striker: { connected: false, yaw: 0, pitch: 0, kills: 0 },
            commander: {
                connected: false,
                skills: {
                    hero: { ready: true, cooldown: 0 },
                    turret: { ready: true, cooldown: 0 },
                    meteor: { ready: true, cooldown: 0 }
                }
            }
        }
    },

    // Grid (0 = neutral, 1 = blue, 2 = red)
    grid: [],

    // Units
    units: {
        blue: [],
        red: []
    },

    // Projectiles
    projectiles: [],

    // Stats
    stats: {
        blueTiles: 0,
        redTiles: 0,
        blueKills: 0,
        redKills: 0
    }
});

// ==================== INITIALIZATION ====================
const initGrid = (state) => {
    state.grid = [];
    for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
        state.grid[y] = [];
        for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
            // Blue base (bottom), Red base (top)
            if (y >= GAME_CONFIG.GRID_HEIGHT - 5) {
                state.grid[y][x] = GAME_CONFIG.TEAM_BLUE;
            } else if (y < 5) {
                state.grid[y][x] = GAME_CONFIG.TEAM_RED;
            } else {
                state.grid[y][x] = 0;
            }
        }
    }
    updateTileCount(state);
};

const updateTileCount = (state) => {
    let blue = 0, red = 0;
    for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
        for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
            if (state.grid[y][x] === GAME_CONFIG.TEAM_BLUE) blue++;
            else if (state.grid[y][x] === GAME_CONFIG.TEAM_RED) red++;
        }
    }
    state.stats.blueTiles = blue;
    state.stats.redTiles = red;
};

// ==================== UNIT SYSTEM ====================
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const createUnit = (type, team, x, y) => {
    const config = GAME_CONFIG.UNITS[type];
    return {
        id: `${type}-${team}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type,
        team,
        x, y,
        hp: config.hp,
        atk: randomRange(config.atk[0], config.atk[1]),
        speed: config.speed,
        size: config.size,
        state: 'moving'
    };
};

let minionSpawnTimer = 0;

const spawnMinions = (state) => {
    // Spawn for blue team
    for (let i = 0; i < GAME_CONFIG.MINIONS_PER_SPAWN; i++) {
        const x = randomRange(2, GAME_CONFIG.GRID_WIDTH - 3);
        const y = GAME_CONFIG.GRID_HEIGHT - 2;
        state.units.blue.push(createUnit('soldier', GAME_CONFIG.TEAM_BLUE, x, y));
    }

    // Spawn for red team
    for (let i = 0; i < GAME_CONFIG.MINIONS_PER_SPAWN; i++) {
        const x = randomRange(2, GAME_CONFIG.GRID_WIDTH - 3);
        const y = 2;
        state.units.red.push(createUnit('soldier', GAME_CONFIG.TEAM_RED, x, y));
    }
};

// ==================== COMBAT SYSTEM ====================
const dealDamage = (attacker, defender) => {
    defender.hp -= attacker.atk;
    if (defender.hp <= 0) {
        defender.state = 'dead';
        return true;
    }
    return false;
};

const createProjectile = (fromX, fromY, toX, toY, team, damage) => {
    return {
        id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        x: fromX, y: fromY,
        targetX: toX, targetY: toY,
        team, damage,
        speed: 15,
        alive: true
    };
};

// ==================== SKILLS ====================
const useSkillHero = (state, team, x, y) => {
    const commander = state.players[team === GAME_CONFIG.TEAM_BLUE ? 'blue' : 'red'].commander;
    if (!commander.skills.hero.ready) return false;

    const units = team === GAME_CONFIG.TEAM_BLUE ? state.units.blue : state.units.red;
    units.push(createUnit('hero', team, x, y));

    commander.skills.hero.ready = false;
    commander.skills.hero.cooldown = GAME_CONFIG.SKILL_HERO_CD;
    return true;
};

const useSkillTurret = (state, team, x, y) => {
    const teamKey = team === GAME_CONFIG.TEAM_BLUE ? 'blue' : 'red';
    const commander = state.players[teamKey].commander;
    if (!commander.skills.turret.ready) return false;

    // Can only place on own territory
    if (state.grid[Math.floor(y)][Math.floor(x)] !== team) return false;

    const units = state.units[teamKey];
    units.push(createUnit('turret', team, x, y));

    commander.skills.turret.ready = false;
    commander.skills.turret.cooldown = GAME_CONFIG.SKILL_TURRET_CD;
    return true;
};

const useSkillMeteor = (state, team, x, y) => {
    const teamKey = team === GAME_CONFIG.TEAM_BLUE ? 'blue' : 'red';
    const enemyKey = team === GAME_CONFIG.TEAM_BLUE ? 'red' : 'blue';
    const commander = state.players[teamKey].commander;
    if (!commander.skills.meteor.ready) return false;

    const radius = 5;
    const meteorDamage = 500;

    // Damage enemy units
    state.units[enemyKey] = state.units[enemyKey].filter(unit => {
        const dist = Math.abs(unit.x - x) + Math.abs(unit.y - y);
        if (dist <= radius) {
            if (unit.type === 'turret') {
                unit.hp -= meteorDamage;
                if (unit.hp <= 0) {
                    state.stats[teamKey + 'Kills']++;
                    return false;
                }
                return true;
            }
            state.stats[teamKey + 'Kills']++;
            return false;
        }
        return true;
    });

    // Paint area
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const gx = Math.floor(x + dx);
            const gy = Math.floor(y + dy);
            if (gx >= 0 && gx < GAME_CONFIG.GRID_WIDTH &&
                gy >= 0 && gy < GAME_CONFIG.GRID_HEIGHT) {
                if (Math.abs(dx) + Math.abs(dy) <= radius) {
                    state.grid[gy][gx] = team;
                }
            }
        }
    }

    commander.skills.meteor.ready = false;
    commander.skills.meteor.cooldown = GAME_CONFIG.SKILL_METEOR_CD;
    updateTileCount(state);
    return true;
};

// ==================== UNIT UPDATES ====================
const updateMinion = (unit, state, deltaTime) => {
    if (unit.state === 'dead') return;

    const team = unit.team;
    const teamKey = team === GAME_CONFIG.TEAM_BLUE ? 'blue' : 'red';
    const enemyKey = team === GAME_CONFIG.TEAM_BLUE ? 'red' : 'blue';
    const enemies = state.units[enemyKey];

    // Find nearest enemy
    let target = null;
    let distance = Infinity;

    enemies.forEach(enemy => {
        if (enemy.state === 'dead') return;
        const dist = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y);
        if (dist < distance) {
            target = enemy;
            distance = dist;
        }
    });

    // Combat or move
    if (target && distance < 2) {
        unit.state = 'fighting';
        if (Math.random() < deltaTime * 2) {
            const killed = dealDamage(unit, target);
            if (killed) {
                state.stats[teamKey + 'Kills']++;
            }
        }
    } else {
        unit.state = 'moving';
        const moveDir = team === GAME_CONFIG.TEAM_BLUE ? -1 : 1; // Blue moves up, Red moves down
        unit.y += moveDir * unit.speed * deltaTime;

        // Slight horizontal drift
        unit.x += (Math.random() - 0.5) * deltaTime;
    }

    // Clamp position
    unit.x = Math.max(0, Math.min(GAME_CONFIG.GRID_WIDTH - 1, unit.x));
    unit.y = Math.max(0, Math.min(GAME_CONFIG.GRID_HEIGHT - 1, unit.y));

    // Paint trail
    const gx = Math.floor(unit.x);
    const gy = Math.floor(unit.y);
    if (gx >= 0 && gx < GAME_CONFIG.GRID_WIDTH && gy >= 0 && gy < GAME_CONFIG.GRID_HEIGHT) {
        if (unit.type !== 'soldier' || Math.random() < 0.1) {
            state.grid[gy][gx] = team;
        }
    }
};

const updateTurret = (turret, state, deltaTime) => {
    if (turret.shootCooldown === undefined) turret.shootCooldown = 0;
    if (turret.scanAngle === undefined) turret.scanAngle = Math.random() * Math.PI * 2;
    if (turret.scanDirection === undefined) turret.scanDirection = Math.random() > 0.5 ? 1 : -1;
    if (turret.scanSpeed === undefined) turret.scanSpeed = 0.5 + Math.random() * 0.5;

    // Update scan rotation
    turret.scanAngle += turret.scanDirection * turret.scanSpeed * deltaTime;
    if (turret.scanAngle > Math.PI / 3) {
        turret.scanAngle = Math.PI / 3;
        turret.scanDirection = -1;
    } else if (turret.scanAngle < -Math.PI / 3) {
        turret.scanAngle = -Math.PI / 3;
        turret.scanDirection = 1;
    }

    turret.shootCooldown -= deltaTime;

    const team = turret.team;
    const teamKey = team === GAME_CONFIG.TEAM_BLUE ? 'blue' : 'red';
    const enemyKey = team === GAME_CONFIG.TEAM_BLUE ? 'red' : 'blue';
    const area = GAME_CONFIG.UNITS.turret.area;

    // Find nearest enemy
    let nearestTarget = null;
    let nearestDist = Infinity;

    state.units[enemyKey].forEach(enemy => {
        if (enemy.state === 'dead') return;
        const dist = Math.abs(enemy.x - turret.x) + Math.abs(enemy.y - turret.y);
        if (dist <= area && dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = enemy;
        }
    });

    // Shoot
    if (turret.shootCooldown <= 0) {
        turret.shootCooldown = 2.0;

        let targetX, targetY;
        if (nearestTarget) {
            targetX = nearestTarget.x;
            targetY = nearestTarget.y;
        } else {
            const baseAngle = team === GAME_CONFIG.TEAM_RED ? Math.PI / 2 : -Math.PI / 2;
            const shootAngle = baseAngle + turret.scanAngle;
            targetX = turret.x + Math.cos(shootAngle) * area;
            targetY = turret.y + Math.sin(shootAngle) * area;
        }

        const proj = createProjectile(turret.x, turret.y, targetX, targetY, team, turret.atk);
        state.projectiles.push(proj);

        // Paint area
        const gx = Math.floor(targetX);
        const gy = Math.floor(targetY);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const px = gx + dx;
                const py = gy + dy;
                if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH && py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                    state.grid[py][px] = team;
                }
            }
        }

        if (nearestTarget) {
            const killed = dealDamage(turret, nearestTarget);
            if (killed) {
                state.stats[teamKey + 'Kills']++;
            }
        }
    }
};

// ==================== GAME UPDATE ====================
const updateGame = (state, deltaTime) => {
    if (!state.gameStarted || state.gameEnded) return;

    // Update timer
    state.timeRemaining -= deltaTime;
    if (state.timeRemaining <= 0) {
        state.timeRemaining = 0;
        state.gameEnded = true;
        return;
    }

    // Spawn minions
    minionSpawnTimer += deltaTime;
    if (minionSpawnTimer >= GAME_CONFIG.MINION_SPAWN_INTERVAL) {
        minionSpawnTimer = 0;
        spawnMinions(state);
    }

    // Update cooldowns
    ['blue', 'red'].forEach(teamKey => {
        const skills = state.players[teamKey].commander.skills;
        Object.keys(skills).forEach(skill => {
            if (!skills[skill].ready) {
                skills[skill].cooldown -= deltaTime;
                if (skills[skill].cooldown <= 0) {
                    skills[skill].ready = true;
                    skills[skill].cooldown = 0;
                }
            }
        });
    });

    // Update units
    ['blue', 'red'].forEach(teamKey => {
        state.units[teamKey].forEach(unit => {
            if (unit.state === 'dead') return;
            if (unit.type === 'turret') {
                updateTurret(unit, state, deltaTime);
            } else {
                updateMinion(unit, state, deltaTime);
            }
        });

        // Remove dead units
        state.units[teamKey] = state.units[teamKey].filter(u => u.state !== 'dead');
    });

    // Update projectiles
    if (state.projectiles) {
        state.projectiles = state.projectiles.filter(p => {
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.5) return false;
            const speed = p.speed * deltaTime;
            p.x += (dx / dist) * speed;
            p.y += (dy / dist) * speed;
            return true;
        });
    }

    // Vanguard painting
    ['blue', 'red'].forEach(teamKey => {
        const team = teamKey === 'blue' ? GAME_CONFIG.TEAM_BLUE : GAME_CONFIG.TEAM_RED;
        const vanguard = state.players[teamKey].vanguard;
        if (vanguard.connected && vanguard.trail) {
            const gx = Math.floor(vanguard.x);
            const gy = Math.floor(vanguard.y);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const px = gx + dx;
                    const py = gy + dy;
                    if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH && py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                        state.grid[py][px] = team;
                    }
                }
            }
        }
    });

    updateTileCount(state);
};

// Export for use in HTML files
if (typeof window !== 'undefined') {
    window.GAME_CONFIG = GAME_CONFIG;
    window.createGameState = createGameState;
    window.initGrid = initGrid;
    window.updateGame = updateGame;
    window.updateTileCount = updateTileCount;
    window.createUnit = createUnit;
    window.useSkillHero = useSkillHero;
    window.useSkillTurret = useSkillTurret;
    window.useSkillMeteor = useSkillMeteor;
}
