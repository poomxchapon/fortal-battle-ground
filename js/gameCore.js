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

    // Unit stats (size in world units, CELL_SIZE = 1.5)
    UNITS: {
        soldier: { hp: 100, atk: [8, 11], speed: 2, size: 1.5, color: 0x95a5a6 },      // 1x1 cell
        hero: { hp: 200, atk: [18, 22], speed: 1.5, size: 3.0, color: 0xf1c40f },      // 2x2 cells
        turret: { hp: 500, atk: [58, 64], speed: 0, size: 3.0, area: 5, color: 0x1abc9c }, // 2x2 cells
        boss: { hp: 5000, atk: [98, 103], speed: 0.3, size: 7.5, color: 0x8e44ad }    // 5x5 cells
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
    },

    // Projectiles for visual effects
    projectiles: []
});

// Initialize grid
const initGrid = (state) => {
    for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
        state.grid[y] = [];
        for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
            // Starting territories (2 rows each side)
            if (y < 2) {
                state.grid[y][x] = GAME_CONFIG.TEAM_ENEMY; // Enemy side (top)
            } else if (y >= GAME_CONFIG.GRID_HEIGHT - 2) {
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

// ==================== PROJECTILE SYSTEM ====================
const createProjectile = (fromX, fromY, toX, toY, team, damage) => {
    return {
        id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        x: fromX,
        y: fromY,
        targetX: toX,
        targetY: toY,
        team: team,
        damage: damage,
        speed: 15, // Fast projectile
        alive: true
    };
};

const updateProjectiles = (state, deltaTime) => {
    state.projectiles.forEach(proj => {
        if (!proj.alive) return;

        // Move toward target
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.5) {
            // Reached target
            proj.alive = false;
        } else {
            // Move
            proj.x += (dx / dist) * proj.speed * deltaTime;
            proj.y += (dy / dist) * proj.speed * deltaTime;
        }
    });

    // Remove dead projectiles
    state.projectiles = state.projectiles.filter(p => p.alive);
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
    const meteorDamage = 500; // Damage dealt to boss/turret

    state.units.enemy = state.units.enemy.filter(unit => {
        const dist = Math.abs(unit.x - x) + Math.abs(unit.y - y);
        if (dist <= radius) {
            // Turrets take damage instead of instant kill
            if (unit.type === 'turret') {
                unit.hp -= meteorDamage;
                if (unit.hp <= 0) {
                    state.stats.playerKills++;
                    return false; // Remove
                }
                return true; // Keep (still alive)
            }
            state.stats.playerKills++;
            return false; // Remove (instant kill soldiers/heroes)
        }
        return true;
    });

    // Damage enemy boss if in range
    if (state.boss.enemy && state.boss.enemy.hp > 0) {
        const bossDist = Math.abs(state.boss.enemy.x - x) + Math.abs(state.boss.enemy.y - y);
        if (bossDist <= radius + 3) { // Larger hit area for boss (boss is big)
            state.boss.enemy.hp -= meteorDamage;
            if (state.boss.enemy.hp <= 0) {
                state.boss.enemy.hp = 0;
                state.boss.enemy.state = 'dead';
                state.stats.playerKills++;
            }
        }
    }

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
            updateTurret(unit, state, deltaTime, false);
        } else {
            updateMinion(unit, state.units.enemy, state, deltaTime, GAME_CONFIG.TEAM_PLAYER);
        }
    });

    // Update enemy units
    state.units.enemy.forEach(unit => {
        if (unit.state === 'dead') return;
        if (unit.type === 'turret') {
            updateTurret(unit, state, deltaTime, true); // Enemy turret
        } else {
            updateMinion(unit, state.units.player, state, deltaTime, GAME_CONFIG.TEAM_ENEMY);
        }
    });

    // Update projectiles
    updateProjectiles(state, deltaTime);

    // Remove dead units
    state.units.player = state.units.player.filter(u => u.state !== 'dead');
    state.units.enemy = state.units.enemy.filter(u => u.state !== 'dead');
};

const updateMinion = (unit, enemies, state, deltaTime, team) => {
    // Check if minion reached enemy base - remove it
    if (team === GAME_CONFIG.TEAM_PLAYER && unit.y <= 1) {
        unit.state = 'dead'; // Remove when reaching enemy base
        return;
    }
    if (team === GAME_CONFIG.TEAM_ENEMY && unit.y >= GAME_CONFIG.GRID_HEIGHT - 2) {
        unit.state = 'dead'; // Remove when reaching player base
        return;
    }

    // Find nearest enemy (including boss)
    let { target, distance } = findNearestEnemy(unit, enemies);

    // Also check enemy boss as potential target
    const enemyBoss = team === GAME_CONFIG.TEAM_PLAYER ? state.boss.enemy : state.boss.player;
    if (enemyBoss && enemyBoss.hp > 0) {
        const bossDist = Math.abs(unit.x - enemyBoss.x) + Math.abs(unit.y - enemyBoss.y);
        if (bossDist < distance) {
            target = enemyBoss;
            distance = bossDist;
        }
    }

    if (target && distance < 1.5) {
        // Fight
        unit.state = 'fighting';
        if (Math.random() < deltaTime * 2) { // Attack rate
            const killed = dealDamage(unit, target);
            if (killed) {
                if (team === GAME_CONFIG.TEAM_PLAYER) {
                    state.stats.playerKills++;
                    // Check if killed boss
                    if (target === state.boss.enemy) {
                        state.boss.enemy = null;
                        state.stats.playerKills += 49; // Bonus for boss kill
                    }
                } else {
                    state.stats.enemyKills++;
                    if (target === state.boss.player) {
                        state.boss.player = null;
                        state.stats.enemyKills += 49;
                    }
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

const updateTurret = (turret, state, deltaTime, isEnemy = false) => {
    // Initialize turret properties if not exists
    if (turret.shootCooldown === undefined) turret.shootCooldown = 0;
    if (turret.scanAngle === undefined) turret.scanAngle = Math.random() * Math.PI * 2;
    if (turret.scanDirection === undefined) turret.scanDirection = Math.random() > 0.5 ? 1 : -1;
    if (turret.scanSpeed === undefined) turret.scanSpeed = 0.5 + Math.random() * 0.5;

    // Update scan rotation (left-right motion)
    turret.scanAngle += turret.scanDirection * turret.scanSpeed * deltaTime;
    // Reverse direction at limits (-60 to +60 degrees from center)
    if (turret.scanAngle > Math.PI / 3) {
        turret.scanAngle = Math.PI / 3;
        turret.scanDirection = -1;
    } else if (turret.scanAngle < -Math.PI / 3) {
        turret.scanAngle = -Math.PI / 3;
        turret.scanDirection = 1;
    }

    // Update cooldown
    turret.shootCooldown -= deltaTime;

    // Find enemies in range
    const area = GAME_CONFIG.UNITS.turret.area;
    const targets = isEnemy ? state.units.player : state.units.enemy;
    const team = isEnemy ? GAME_CONFIG.TEAM_ENEMY : GAME_CONFIG.TEAM_PLAYER;

    // Also include enemy boss as target
    const enemyBoss = isEnemy ? state.boss.player : state.boss.enemy;

    // Find nearest target in range
    let nearestTarget = null;
    let nearestDist = Infinity;

    targets.forEach(enemy => {
        if (enemy.state === 'dead') return;
        const dist = Math.abs(enemy.x - turret.x) + Math.abs(enemy.y - turret.y);
        if (dist <= area && dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = enemy;
        }
    });

    // Check boss as target too
    if (enemyBoss && enemyBoss.hp > 0) {
        const dist = Math.abs(enemyBoss.x - turret.x) + Math.abs(enemyBoss.y - turret.y);
        if (dist <= area && dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = enemyBoss;
        }
    }

    // Auto-shoot every 2 seconds
    if (turret.shootCooldown <= 0) {
        turret.shootCooldown = 2.0; // Shoot every 2 seconds

        let targetX, targetY;

        if (nearestTarget) {
            // Shoot at target
            targetX = nearestTarget.x;
            targetY = nearestTarget.y;
        } else {
            // No target - shoot in scan direction
            const baseAngle = isEnemy ? Math.PI / 2 : -Math.PI / 2; // Enemy shoots down, player shoots up
            const shootAngle = baseAngle + turret.scanAngle;
            targetX = turret.x + Math.cos(shootAngle) * area;
            targetY = turret.y + Math.sin(shootAngle) * area;
        }

        // Create projectile effect
        const proj = createProjectile(turret.x, turret.y, targetX, targetY, team, turret.atk);
        state.projectiles.push(proj);

        // Paint area where projectile lands (every shot paints!)
        const gx = Math.floor(targetX);
        const gy = Math.floor(targetY);
        const paintRadius = 1; // Small paint area per shot
        for (let dy = -paintRadius; dy <= paintRadius; dy++) {
            for (let dx = -paintRadius; dx <= paintRadius; dx++) {
                const px = gx + dx;
                const py = gy + dy;
                if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH &&
                    py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                    state.grid[py][px] = team;
                }
            }
        }

        // Deal damage if there's a target
        if (nearestTarget) {
            const killed = dealDamage(turret, nearestTarget);
            if (killed) {
                if (isEnemy) {
                    state.stats.enemyKills++;
                } else {
                    state.stats.playerKills++;
                }
                // Extra paint area where enemy died
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const px = gx + dx;
                        const py = gy + dy;
                        if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH &&
                            py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                            state.grid[py][px] = team;
                        }
                    }
                }
            }
        }
    }
};

const updateBoss = (state, deltaTime) => {
    const playerBoss = state.boss.player;
    const enemyBoss = state.boss.enemy;

    // Check if both bosses exist and should fight each other
    if (playerBoss && playerBoss.hp > 0 && enemyBoss && enemyBoss.hp > 0) {
        const dist = Math.abs(playerBoss.x - enemyBoss.x) + Math.abs(playerBoss.y - enemyBoss.y);

        if (dist < 8) {
            // BOSS FIGHT! Both bosses attack each other
            playerBoss.state = 'fighting';
            enemyBoss.state = 'fighting';

            // Move toward each other
            moveToward(playerBoss, enemyBoss.x, enemyBoss.y, deltaTime);
            moveToward(enemyBoss, playerBoss.x, playerBoss.y, deltaTime);

            // Both deal damage to each other
            if (Math.random() < deltaTime * 2) {
                const pAtk = GAME_CONFIG.UNITS.boss.atk;
                const pDmg = pAtk[0] + Math.random() * (pAtk[1] - pAtk[0]);
                enemyBoss.hp -= pDmg;

                const eDmg = pAtk[0] + Math.random() * (pAtk[1] - pAtk[0]);
                playerBoss.hp -= eDmg;
            }

            // Check deaths
            if (enemyBoss.hp <= 0) {
                state.boss.enemy = null;
                state.stats.playerKills += 50; // Big kill bonus
            }
            if (playerBoss.hp <= 0) {
                state.boss.player = null;
                state.stats.enemyKills += 50;
            }

            // Paint battle area
            const midX = Math.floor((playerBoss.x + enemyBoss.x) / 2);
            const midY = Math.floor((playerBoss.y + enemyBoss.y) / 2);
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const px = midX + dx;
                    const py = midY + dy;
                    if (px >= 0 && px < GAME_CONFIG.GRID_WIDTH && py >= 0 && py < GAME_CONFIG.GRID_HEIGHT) {
                        // Contested area - random team
                        state.grid[py][px] = Math.random() < 0.5 ? GAME_CONFIG.TEAM_PLAYER : GAME_CONFIG.TEAM_ENEMY;
                    }
                }
            }

            // Skip normal boss behavior when fighting
            return;
        }
    }

    // Player boss normal behavior
    if (playerBoss && playerBoss.hp > 0) {
        const boss = playerBoss;
        boss.state = 'moving';

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
            for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
                    if (Math.random() < 0.9) {
                        state.grid[y][x] = GAME_CONFIG.TEAM_PLAYER;
                    }
                }
            }
            state.boss.player = null;
        }
    }

    // Enemy boss normal behavior
    if (enemyBoss && enemyBoss.hp > 0) {
        const boss = enemyBoss;
        boss.state = 'moving';

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
let aiTurretTimer = 0;
let aiHeroTimer = 0;

const updateAI = (state, deltaTime) => {
    // AI spawns minions periodically (handled by main game loop)

    // AI spawns turrets every 30-45 seconds (reduced from 15-25)
    aiTurretTimer += deltaTime;
    if (aiTurretTimer >= 30 + Math.random() * 15) {
        aiTurretTimer = 0;
        // Find a spot in enemy territory to place turret
        const enemyTiles = [];
        for (let y = 0; y < GAME_CONFIG.GRID_HEIGHT / 2; y++) {
            for (let x = 0; x < GAME_CONFIG.GRID_WIDTH; x++) {
                if (state.grid[y][x] === GAME_CONFIG.TEAM_ENEMY) {
                    enemyTiles.push({ x, y });
                }
            }
        }
        if (enemyTiles.length > 0) {
            const spot = enemyTiles[Math.floor(Math.random() * enemyTiles.length)];
            // Spawn enemy turret
            const turret = createUnit('turret', GAME_CONFIG.TEAM_ENEMY, spot.x, spot.y);
            state.units.enemy.push(turret);
        }
    }

    // AI spawns heroes every 45-60 seconds (reduced from 20-30)
    aiHeroTimer += deltaTime;
    if (aiHeroTimer >= 45 + Math.random() * 15) {
        aiHeroTimer = 0;
        // Spawn hero at enemy base
        const x = randomRange(2, GAME_CONFIG.GRID_WIDTH - 3);
        const hero = createUnit('hero', GAME_CONFIG.TEAM_ENEMY, x, 2);
        state.units.enemy.push(hero);
    }

    // AI might spawn boss when losing badly (reduced chance)
    if (!state.boss.enemy && state.stats.enemyTiles < state.stats.playerTiles * 0.3) {
        if (Math.random() < 0.0005) { // Lower chance
            spawnBoss(state, GAME_CONFIG.TEAM_ENEMY);
        }
    }

    // AI spawns boss when player has boss (counter) - reduced chance
    if (!state.boss.enemy && state.boss.player) {
        if (Math.random() < 0.003) {
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
