// ==================== FORTAL BATTLE GROUND - HYPER BATTLE MODE ====================
// Shared Game Core for all roles

const GAME_CONFIG = {
    // Grid
    GRID_WIDTH: 18,
    GRID_HEIGHT: 39,
    CELL_SIZE: 1.5,

    // Time
    GAME_DURATION: 5 * 60, // 5 minutes in seconds

    // Teams
    TEAM_PLAYER: 1, // Blue
    TEAM_ENEMY: 2,  // Red

    // Colors
    COLOR_NEUTRAL: 0x2c3e50,
    COLOR_PLAYER: 0x3498db,  // Blue
    COLOR_ENEMY: 0xe74c3c,   // Red
    COLOR_VANGUARD: 0x9b59b6, // Purple

    // Minion spawn
    MINION_SPAWN_INTERVAL: 10, // seconds
    MINIONS_PER_SPAWN: 3,

    // Ultimate gauge
    ULTIMATE_KILLS_REQUIRED: 100,
    ULTIMATE_TILES_REQUIRED: 100,

    // Skills cooldowns (seconds)
    SKILL_HERO_CD: 10,
    SKILL_TURRET_CD: 20,
    SKILL_METEOR_CD: 30,

    // Unit stats
    UNITS: {
        soldier: { hp: 100, atk: [8, 11], speed: 2, size: 0.4, color: 0x95a5a6 },
        hero: { hp: 200, atk: [18, 22], speed: 1.5, size: 0.6, color: 0xf1c40f },
        turret: { hp: 500, atk: [58, 64], speed: 0, size: 1.2, area: 5, color: 0x1abc9c },
        boss: { hp: 5000, atk: [98, 103], speed: 0.3, size: 2.5, color: 0x8e44ad }
    }
};

// ==================== GAME STATE ====================
const createGameState = () => ({
    // Time
    timeRemaining: GAME_CONFIG.GAME_DURATION,
    gameStarted: false,
    gameEnded: false,

    // Players
    players: {
        vanguard: {
            connected: false,
            x: GAME_CONFIG.GRID_WIDTH / 2,
            y: GAME_CONFIG.GRID_HEIGHT - 3,
            trail: true // Permanent rage in Hyper mode
        },
        striker: {
            connected: false,
            yaw: 0,
            pitch: 0,
            kills: 0 // For ultimate gauge
        },
        commander: {
            connected: false,
            skills: {
                hero: { ready: true, cooldown: 0 },
                turret: { ready: true, cooldown: 0 },
                meteor: { ready: true, cooldown: 0 },
                boss: { ready: false, cooldown: 0 }
            },
            ultimateGauge: 0
        }
    },

    // Grid (0 = neutral, 1 = player, 2 = enemy)
    grid: [],

    // Units
    units: {
        player: [], // Player team units
        enemy: []   // AI enemy units
    },

    // Boss
    boss: {
        player: null,
        enemy: null
    },

    // Stats
    stats: {
        playerTiles: 0,
        enemyTiles: 0,
        playerKills: 0,
        enemyKills: 0
    }
});

// Initialize grid
const initGrid = (state) => {
    for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
        state.grid[y] = [];
        for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
            // Starting territories
            if (y < 5) {
                state.grid[y][x] = GAME_CONFIG.TEAM_ENEMY; // Enemy side (top)
            } else if (y >= GAME_CONFIG.GRID_HEIGHT - 5) {
                state.grid[y][x] = GAME_CONFIG.TEAM_PLAYER; // Player side (bottom)
            } else {
                state.grid[y][x] = 0; // Neutral
            }
        }
    }
    updateTileCount(state);
};

// Count tiles
const updateTileCount = (state) => {
    let player = 0, enemy = 0;
    for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
        for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
            if (state.grid[y][x] === GAME_CONFIG.TEAM_PLAYER) player++;
            else if (state.grid[y][x] === GAME_CONFIG.TEAM_ENEMY) enemy++;
        }
    }
    state.stats.playerTiles = player;
    state.stats.enemyTiles = enemy;
};

// Random in range
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ==================== UNIT FACTORY ====================
const createUnit = (type, team, x, y) => {
    const config = GAME_CONFIG.UNITS[type];
    return {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: type,
        team: team,
        x: x,
        y: y,
        hp: config.hp,
        maxHp: config.hp,
        atk: randomRange(config.atk[0], config.atk[1]),
        speed: config.speed,
        size: config.size,
        color: team === GAME_CONFIG.TEAM_PLAYER ? GAME_CONFIG.COLOR_PLAYER : GAME_CONFIG.COLOR_ENEMY,
        target: null,
        state: 'moving', // moving, fighting, dead
        weakPointTimer: 0, // For boss
        weakPointVisible: false
    };
};

// ==================== UNIT SPAWNING ====================
const spawnPlayerMinions = (state, count = GAME_CONFIG.MINIONS_PER_SPAWN) => {
    for (let i = 0; i < count; i++) {
        const x = randomRange(2, GAME_CONFIG.GRID_WIDTH - 3);
        const y = GAME_CONFIG.GRID_HEIGHT - 2;
        state.units.player.push(createUnit('soldier', GAME_CONFIG.TEAM_PLAYER, x, y));
    }
};

const spawnEnemyMinions = (state, count = GAME_CONFIG.MINIONS_PER_SPAWN) => {
    for (let i = 0; i < count; i++) {
        const x = randomRange(2, GAME_CONFIG.GRID_WIDTH - 3);
        const y = 1;
        state.units.enemy.push(createUnit('soldier', GAME_CONFIG.TEAM_ENEMY, x, y));
    }
};

const spawnHero = (state, x, y) => {
    state.units.player.push(createUnit('hero', GAME_CONFIG.TEAM_PLAYER, x, y));
};

const spawnTurret = (state, x, y) => {
    state.units.player.push(createUnit('turret', GAME_CONFIG.TEAM_PLAYER, x, y));
};

const spawnBoss = (state, team) => {
    const y = team === GAME_CONFIG.TEAM_PLAYER ? GAME_CONFIG.GRID_HEIGHT - 5 : 4;
    const x = GAME_CONFIG.GRID_WIDTH / 2;
    const boss = createUnit('boss', team, x, y);

    if (team === GAME_CONFIG.TEAM_PLAYER) {
        state.boss.player = boss;
    } else {
        state.boss.enemy = boss;
    }
    return boss;
};

// ==================== COMBAT SYSTEM ====================
const findNearestEnemy = (unit, enemies) => {
    let nearest = null;
    let minDist = Infinity;

    enemies.forEach(enemy => {
        if (enemy.state === 'dead') return;
        const dist = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y);
        if (dist < minDist) {
            minDist = dist;
            nearest = enemy;
        }
    });

    return { target: nearest, distance: minDist };
};

const moveToward = (unit, targetX, targetY, deltaTime) => {
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.1) {
        const moveX = (dx / dist) * unit.speed * deltaTime;
        const moveY = (dy / dist) * unit.speed * deltaTime;
        unit.x += moveX;
        unit.y += moveY;
    }

    // Clamp to grid
    unit.x = Math.max(0, Math.min(GAME_CONFIG.GRID_WIDTH - 1, unit.x));
    unit.y = Math.max(0, Math.min(GAME_CONFIG.GRID_HEIGHT - 1, unit.y));
};

const dealDamage = (attacker, defender) => {
    defender.hp -= attacker.atk;
    if (defender.hp <= 0) {
        defender.state = 'dead';
        return true; // Killed
    }
    return false;
};

// ==================== SKILLS ====================
const useSkillHero = (state, x, y) => {
    if (!state.players.commander.skills.hero.ready) return false;
    if (state.grid[Math.floor(y)][Math.floor(x)] !== GAME_CONFIG.TEAM_PLAYER) return false;

    spawnHero(state, x, y);
    state.players.commander.skills.hero.ready = false;
    state.players.commander.skills.hero.cooldown = GAME_CONFIG.SKILL_HERO_CD;
    return true;
};

const useSkillTurret = (state, x, y) => {
    if (!state.players.commander.skills.turret.ready) return false;
    if (state.grid[Math.floor(y)][Math.floor(x)] !== GAME_CONFIG.TEAM_PLAYER) return false;

    spawnTurret(state, x, y);
    state.players.commander.skills.turret.ready = false;
    state.players.commander.skills.turret.cooldown = GAME_CONFIG.SKILL_TURRET_CD;
    return true;
};

const useSkillMeteor = (state, x, y) => {
    if (!state.players.commander.skills.meteor.ready) return false;

    // Kill all enemies in 10x10 area
    const radius = 5;
    state.units.enemy = state.units.enemy.filter(unit => {
        const dist = Math.abs(unit.x - x) + Math.abs(unit.y - y);
        if (dist <= radius) {
            state.stats.playerKills++;
            return false; // Remove
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
                    state.grid[gy][gx] = GAME_CONFIG.TEAM_PLAYER;
                }
            }
        }
    }

    state.players.commander.skills.meteor.ready = false;
    state.players.commander.skills.meteor.cooldown = GAME_CONFIG.SKILL_METEOR_CD;
    updateTileCount(state);
    return true;
};

const useSkillBoss = (state) => {
    if (!state.players.commander.skills.boss.ready) return false;
    if (state.boss.player) return false; // Already have a boss

    spawnBoss(state, GAME_CONFIG.TEAM_PLAYER);
    state.players.commander.skills.boss.ready = false;
    return true;
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

    // Update skill cooldowns
    Object.keys(state.players.commander.skills).forEach(skill => {
        const s = state.players.commander.skills[skill];
        if (!s.ready && s.cooldown > 0) {
            s.cooldown -= deltaTime;
            if (s.cooldown <= 0) {
                s.cooldown = 0;
                if (skill !== 'boss') s.ready = true;
            }
        }
    });

    // Check ultimate gauge for boss
    const gauge = state.stats.playerKills + (state.stats.playerTiles / 7);
    state.players.commander.ultimateGauge = Math.min(100, gauge);
    if (state.players.commander.ultimateGauge >= 100 && !state.boss.player) {
        state.players.commander.skills.boss.ready = true;
    }

    // Update units
    updateUnits(state, deltaTime);

    // Update boss
    updateBoss(state, deltaTime);

    // Update tile count
    updateTileCount(state);
};

const updateUnits = (state, deltaTime) => {
    // Update player units
    state.units.player.forEach(unit => {
        if (unit.state === 'dead') return;
        if (unit.type === 'turret') {
            updateTurret(unit, state, deltaTime);
        } else {
            updateMinion(unit, state.units.enemy, state, deltaTime, GAME_CONFIG.TEAM_PLAYER);
        }
    });

    // Update enemy units
    state.units.enemy.forEach(unit => {
        if (unit.state === 'dead') return;
        updateMinion(unit, state.units.player, state, deltaTime, GAME_CONFIG.TEAM_ENEMY);
    });

    // Remove dead units
    state.units.player = state.units.player.filter(u => u.state !== 'dead');
    state.units.enemy = state.units.enemy.filter(u => u.state !== 'dead');
};

const updateMinion = (unit, enemies, state, deltaTime, team) => {
    const { target, distance } = findNearestEnemy(unit, enemies);

    if (target && distance < 1.5) {
        // Fight
        unit.state = 'fighting';
        if (Math.random() < deltaTime * 2) { // Attack rate
            const killed = dealDamage(unit, target);
            if (killed) {
                if (team === GAME_CONFIG.TEAM_PLAYER) {
                    state.stats.playerKills++;
                } else {
                    state.stats.enemyKills++;
                }
            }
        }
    } else if (target) {
        // Move toward enemy
        unit.state = 'moving';
        moveToward(unit, target.x, target.y, deltaTime);
    } else {
        // Move toward enemy base
        unit.state = 'moving';
        const targetY = team === GAME_CONFIG.TEAM_PLAYER ? 0 : GAME_CONFIG.GRID_HEIGHT - 1;
        moveToward(unit, unit.x, targetY, deltaTime);
    }

    // Paint tile when moving
    const gx = Math.floor(unit.x);
    const gy = Math.floor(unit.y);
    if (gx >= 0 && gx < GAME_CONFIG.GRID_WIDTH && gy >= 0 && gy < GAME_CONFIG.GRID_HEIGHT) {
        if (unit.type !== 'soldier' || Math.random() < 0.1) { // Soldiers paint less
            state.grid[gy][gx] = team;
        }
    }
};

const updateTurret = (turret, state, deltaTime) => {
    // Find enemies in range
    const area = GAME_CONFIG.UNITS.turret.area;
    state.units.enemy.forEach(enemy => {
        if (enemy.state === 'dead') return;
        const dist = Math.abs(enemy.x - turret.x) + Math.abs(enemy.y - turret.y);
        if (dist <= area) {
            if (Math.random() < deltaTime * 1.5) {
                const killed = dealDamage(turret, enemy);
                if (killed) {
                    state.stats.playerKills++;
                    // Paint area where enemy died
                    const gx = Math.floor(enemy.x);
                    const gy = Math.floor(enemy.y);
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const px = gx + dx;
                            const py = gy + dy;
                            if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH &&
                                py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                                state.grid[py][px] = GAME_CONFIG.TEAM_PLAYER;
                            }
                        }
                    }
                }
            }
        }
    });
};

const updateBoss = (state, deltaTime) => {
    // Player boss
    if (state.boss.player && state.boss.player.hp > 0) {
        const boss = state.boss.player;

        // Move toward enemy base
        moveToward(boss, boss.x, 0, deltaTime);

        // Paint trail (Emperor Aura)
        const gx = Math.floor(boss.x);
        const gy = Math.floor(boss.y);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const px = gx + dx;
                const py = gy + dy;
                if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH &&
                    py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                    state.grid[py][px] = GAME_CONFIG.TEAM_PLAYER;
                }
            }
        }

        // Weak point timer
        boss.weakPointTimer += deltaTime;
        if (boss.weakPointTimer >= 5) {
            boss.weakPointTimer = 0;
            boss.weakPointVisible = !boss.weakPointVisible;
        }

        // Check if reached backline (Gigantic Smash)
        if (boss.y <= 2) {
            // Paint 90% of the field
            for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
                    if (Math.random() < 0.9) {
                        state.grid[y][x] = GAME_CONFIG.TEAM_PLAYER;
                    }
                }
            }
            state.boss.player = null; // Boss disappears
        }
    }

    // Enemy boss (AI)
    if (state.boss.enemy && state.boss.enemy.hp > 0) {
        const boss = state.boss.enemy;

        // Move toward player base
        moveToward(boss, boss.x, GAME_CONFIG.GRID_HEIGHT - 1, deltaTime);

        // Paint trail
        const gx = Math.floor(boss.x);
        const gy = Math.floor(boss.y);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const px = gx + dx;
                const py = gy + dy;
                if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH &&
                    py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                    state.grid[py][px] = GAME_CONFIG.TEAM_ENEMY;
                }
            }
        }

        // Check if reached backline
        if (boss.y >= GAME_CONFIG.GRID_HEIGHT - 3) {
            for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
                    if (Math.random() < 0.9) {
                        state.grid[y][x] = GAME_CONFIG.TEAM_ENEMY;
                    }
                }
            }
            state.boss.enemy = null;
        }
    }
};

// ==================== AI CONTROLLER ====================
const updateAI = (state, deltaTime) => {
    // AI spawns minions periodically (handled by main game loop)

    // AI might spawn boss when losing
    if (!state.boss.enemy && state.stats.enemyTiles < state.stats.playerTiles * 0.5) {
        if (Math.random() < 0.001) { // Small chance per frame
            spawnBoss(state, GAME_CONFIG.TEAM_ENEMY);
        }
    }
};

// ==================== EXPORTS ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_CONFIG,
        createGameState,
        initGrid,
        updateGame,
        updateAI,
        spawnPlayerMinions,
        spawnEnemyMinions,
        useSkillHero,
        useSkillTurret,
        useSkillMeteor,
        useSkillBoss
    };
}
