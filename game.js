const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 设置画布尺寸
const GAME_WIDTH = 480;
const GAME_HEIGHT = 800;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// 游戏状态
const STATE = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    UPGRADE: 3,
    GAMEOVER: 4
};

let gameState = STATE.MENU;
let score = 0;
let level = 1;
let frameCount = 0;
let shakeTimer = 0;

// 输入状态
const keys = {};
let mouseX = 0, mouseY = 0;
let mouseDown = false;
let touchActive = false;
let touchX = 0, touchY = 0;

// 音效系统 (Web Audio API)
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'bomb') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// 工具函数
function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

function checkCollision(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// 星星背景
class Star {
    constructor() {
        this.reset();
        this.y = rand(0, GAME_HEIGHT);
    }
    reset() {
        this.x = rand(0, GAME_WIDTH);
        this.y = -5;
        this.size = rand(0.5, 2.5);
        this.speed = rand(0.5, 3);
        this.alpha = rand(0.3, 1);
    }
    update() {
        this.y += this.speed + (level * 0.2);
        if (this.y > GAME_HEIGHT) this.reset();
    }
    draw() {
        ctx.fillStyle = `rgba(255,255,255,${this.alpha})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

const stars = Array.from({ length: 80 }, () => new Star());

// 粒子效果
class Particle {
    constructor(x, y, color, speed, life) {
        this.x = x;
        this.y = y;
        this.vx = rand(-speed, speed);
        this.vy = rand(-speed, speed);
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = rand(2, 5);
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.96;
    }
    draw() {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

let particles = [];

function spawnExplosion(x, y, color = '#ff6600', count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, 4, rand(20, 40)));
    }
}

// 子弹
class Bullet {
    constructor(x, y, vx, vy, isPlayer, damage = 1) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.isPlayer = isPlayer;
        this.damage = damage;
        this.w = 4;
        this.h = 12;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y < -20 || this.y > GAME_HEIGHT + 20 || this.x < -20 || this.x > GAME_WIDTH + 20) {
            this.active = false;
        }
    }
    draw() {
        ctx.save();
        if (this.isPlayer) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00ffff';
            ctx.fillStyle = '#ccffff';
        } else {
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ff4444';
            ctx.fillStyle = '#ff8888';
        }
        ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
        ctx.restore();
    }
}

let bullets = [];

// 玩家
class Player {
    constructor() {
        this.x = GAME_WIDTH / 2;
        this.y = GAME_HEIGHT - 100;
        this.w = 40;
        this.h = 50;
        this.speed = 5;
        this.shootTimer = 0;
        this.shootInterval = 12;
        this.power = 1;
        this.lives = 3;
        this.bombs = 3;
        this.shield = 0;
        this.energy = 0;
        this.invincible = 0;
        this.engineAnim = 0;
    }
    update() {
        // 移动
        let dx = 0, dy = 0;
        if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) dx += 1;
        if (keys['ArrowUp'] || keys['KeyW'] || keys['w']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS'] || keys['s']) dy += 1;
        
        // 鼠标/触摸跟随
        if (mouseDown && !touchActive) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = GAME_WIDTH / rect.width;
            const scaleY = GAME_HEIGHT / rect.height;
            const mx = (mouseX - rect.left) * scaleX;
            const my = (mouseY - rect.top) * scaleY;
            dx += (mx - this.x) * 0.05;
            dy += (my - this.y) * 0.05;
        }
        if (touchActive) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = GAME_WIDTH / rect.width;
            const scaleY = GAME_HEIGHT / rect.height;
            const tx = (touchX - rect.left) * scaleX;
            const ty = (touchY - rect.top) * scaleY;
            dx += (tx - this.x) * 0.08;
            dy += (ty - this.y) * 0.08;
        }
        
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707;
            dy *= 0.707;
        }
        
        this.x = clamp(this.x + dx * this.speed, this.w / 2, GAME_WIDTH - this.w / 2);
        this.y = clamp(this.y + dy * this.speed, this.h / 2, GAME_HEIGHT - this.h / 2);
        
        // 射击
        this.shootTimer--;
        if ((keys['Space'] || mouseDown || touchActive) && this.shootTimer <= 0) {
            this.shoot();
            this.shootTimer = this.shootInterval;
        }
        
        // 无敌时间
        if (this.invincible > 0) this.invincible--;
        this.engineAnim += 0.3;
        
        // 能量恢复
        if (this.energy < 100) this.energy += 0.02;
    }
    shoot() {
        playSound('shoot');
        const dmg = 1 + Math.floor(this.power / 3);
        if (this.power === 1) {
            bullets.push(new Bullet(this.x, this.y - 20, 0, -10, true, dmg));
        } else if (this.power === 2) {
            bullets.push(new Bullet(this.x - 8, this.y - 15, 0, -10, true, dmg));
            bullets.push(new Bullet(this.x + 8, this.y - 15, 0, -10, true, dmg));
        } else if (this.power === 3) {
            bullets.push(new Bullet(this.x, this.y - 20, 0, -10, true, dmg));
            bullets.push(new Bullet(this.x - 12, this.y - 15, -1, -9, true, dmg));
            bullets.push(new Bullet(this.x + 12, this.y - 15, 1, -9, true, dmg));
        } else {
            bullets.push(new Bullet(this.x, this.y - 20, 0, -11, true, dmg));
            bullets.push(new Bullet(this.x - 14, this.y - 15, -1.5, -10, true, dmg));
            bullets.push(new Bullet(this.x + 14, this.y - 15, 1.5, -10, true, dmg));
            bullets.push(new Bullet(this.x - 22, this.y - 10, -3, -9, true, dmg));
            bullets.push(new Bullet(this.x + 22, this.y - 10, 3, -9, true, dmg));
        }
    }
    useBomb() {
        if (this.bombs > 0) {
            this.bombs--;
            playSound('bomb');
            shakeTimer = 20;
            // 清屏伤害
            enemies.forEach(e => {
                e.hp -= 20;
                if (e.hp <= 0) {
                    e.active = false;
                    score += e.score;
                    spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, e.color, 20);
                }
            });
            bullets.forEach(b => { if (!b.isPlayer) b.active = false; });
            // 视觉特效
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(
                    rand(0, GAME_WIDTH), rand(0, GAME_HEIGHT),
                    '#ffffff', 8, rand(30, 60)
                ));
            }
            updateHUD();
        }
    }
    hit() {
        if (this.invincible > 0) return false;
        if (this.shield > 0) {
            this.shield--;
            this.invincible = 60;
            playSound('powerup');
            return false;
        }
        this.lives--;
        this.invincible = 120;
        shakeTimer = 15;
        spawnExplosion(this.x, this.y, '#00ffff', 30);
        playSound('explosion');
        if (this.lives <= 0) {
            gameOver();
        }
        updateHUD();
        return true;
    }
    draw() {
        ctx.save();
        
        // 护盾效果
        if (this.shield > 0) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fill();
        }
        
        // 无敌闪烁
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // 引擎火焰
        const flameH = 8 + Math.sin(this.engineAnim) * 4;
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(this.x - 8, this.y + 20);
        ctx.lineTo(this.x, this.y + 20 + flameH);
        ctx.lineTo(this.x + 8, this.y + 20);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(this.x - 4, this.y + 20);
        ctx.lineTo(this.x, this.y + 20 + flameH * 0.6);
        ctx.lineTo(this.x + 4, this.y + 20);
        ctx.fill();
        
        // 飞机主体
        ctx.fillStyle = '#4488ff';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 25);
        ctx.lineTo(this.x - 18, this.y + 15);
        ctx.lineTo(this.x - 8, this.y + 20);
        ctx.lineTo(this.x + 8, this.y + 20);
        ctx.lineTo(this.x + 18, this.y + 15);
        ctx.closePath();
        ctx.fill();
        
        // 机翼
        ctx.fillStyle = '#3366cc';
        ctx.beginPath();
        ctx.moveTo(this.x - 18, this.y + 5);
        ctx.lineTo(this.x - 28, this.y + 18);
        ctx.lineTo(this.x - 18, this.y + 18);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x + 18, this.y + 5);
        ctx.lineTo(this.x + 28, this.y + 18);
        ctx.lineTo(this.x + 18, this.y + 18);
        ctx.closePath();
        ctx.fill();
        
        // 驾驶舱
        ctx.fillStyle = '#88ccff';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 5, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

let player = new Player();


// 敌机
class Enemy {
    constructor(type) {
        this.type = type;
        this.active = true;
        this.w = 30;
        this.h = 30;
        this.x = rand(this.w / 2, GAME_WIDTH - this.w / 2);
        this.y = -40;
        this.vx = 0;
        this.vy = 2;
        this.hp = 3;
        this.score = 100;
        this.color = '#ff4444';
        this.shootTimer = rand(30, 90);
        this.angle = 0;
        
        switch (type) {
            case 1: // 基础敌机
                this.w = 32; this.h = 32;
                this.vy = 2 + level * 0.3;
                this.hp = 2 + level;
                this.score = 100;
                this.color = '#ff6666';
                break;
            case 2: // 快速敌机
                this.w = 26; this.h = 26;
                this.vy = 4 + level * 0.4;
                this.vx = rand(-1, 1);
                this.hp = 1 + Math.floor(level / 2);
                this.score = 150;
                this.color = '#ffaa44';
                break;
            case 3: // 坦克敌机
                this.w = 45; this.h = 40;
                this.vy = 1 + level * 0.15;
                this.hp = 8 + level * 3;
                this.score = 300;
                this.color = '#ff4444';
                break;
            case 4: // 射击敌机
                this.w = 35; this.h = 35;
                this.vy = 1.5 + level * 0.2;
                this.hp = 4 + level * 2;
                this.score = 250;
                this.color = '#ff66aa';
                break;
            case 5: // Boss
                this.w = 80; this.h = 70;
                this.vy = 0.5;
                this.vx = 1.5;
                this.hp = 50 + level * 20;
                this.score = 2000;
                this.color = '#aa00ff';
                this.x = GAME_WIDTH / 2;
                this.y = -80;
                break;
        }
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.angle += 0.02;
        
        if (this.type === 2) {
            this.vx = Math.sin(this.angle * 3) * 2;
        }
        if (this.type === 5) {
            this.vx = Math.sin(this.angle) * 2;
            this.y = clamp(this.y, 50, 200);
        }
        
        if (this.x < this.w / 2 || this.x > GAME_WIDTH - this.w / 2) this.vx *= -1;
        
        // 射击
        this.shootTimer--;
        if (this.shootTimer <= 0 && this.y > 0 && this.y < GAME_HEIGHT - 100) {
            this.shoot();
            this.shootTimer = this.type === 5 ? 20 : rand(60, 120) - level * 3;
        }
        
        if (this.y > GAME_HEIGHT + 50) this.active = false;
    }
    shoot() {
        const bx = this.x;
        const by = this.y + this.h / 2;
        if (this.type === 5) {
            for (let i = -2; i <= 2; i++) {
                bullets.push(new Bullet(bx + i * 15, by, i * 1.5, 4, false));
            }
        } else if (this.type === 4) {
            const angle = Math.atan2(player.y - by, player.x - bx);
            bullets.push(new Bullet(bx, by, Math.cos(angle) * 4, Math.sin(angle) * 4, false));
        } else {
            bullets.push(new Bullet(bx, by, 0, 4, false));
        }
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false;
            score += this.score;
            spawnExplosion(this.x, this.y, this.color, this.type === 5 ? 40 : 15);
            playSound('explosion');
            
            // 掉落道具
            if (this.type === 5 || Math.random() < 0.2 + level * 0.02) {
                const itemType = Math.random() < 0.3 ? 'power' : Math.random() < 0.4 ? 'life' : Math.random() < 0.5 ? 'bomb' : 'energy';
                items.push(new Item(this.x, this.y, itemType));
            }
            
            // Boss 死亡给大量能量
            if (this.type === 5) {
                player.energy = Math.min(100, player.energy + 50);
            }
            
            checkLevelUp();
        } else {
            // 受击闪烁粒子
            particles.push(new Particle(this.x, this.y, '#ffffff', 2, 10));
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // HP bar for tank/boss
        if (this.hp > 5 || this.type === 5) {
            const maxHp = this.type === 5 ? (50 + (level - 1) * 20) : (this.type === 3 ? (8 + level * 3) : this.hp + 5);
            const barW = this.w + 10;
            const barH = 4;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barW / 2, -this.h / 2 - 10, barW, barH);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-barW / 2, -this.h / 2 - 10, barW * (this.hp / maxHp), barH);
        }
        
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        if (this.type === 1) {
            // 菱形
            ctx.beginPath();
            ctx.moveTo(0, -this.h / 2);
            ctx.lineTo(this.w / 2, 0);
            ctx.lineTo(0, this.h / 2);
            ctx.lineTo(-this.w / 2, 0);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 2) {
            // 三角
            ctx.beginPath();
            ctx.moveTo(0, this.h / 2);
            ctx.lineTo(this.w / 2, -this.h / 2);
            ctx.lineTo(-this.w / 2, -this.h / 2);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 3) {
            // 六边形坦克
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const r = i % 2 === 0 ? this.w / 2 : this.w / 3;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 4) {
            // 圆形射击型
            ctx.beginPath();
            ctx.arc(0, 0, this.w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 5) {
            // Boss
            ctx.fillStyle = '#6600aa';
            ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
            ctx.fillStyle = '#aa00ff';
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            // 侧边炮管
            ctx.fillStyle = '#8800cc';
            ctx.fillRect(-this.w / 2 - 8, -10, 12, 20);
            ctx.fillRect(this.w / 2 - 4, -10, 12, 20);
        }
        
        ctx.restore();
    }
}

let enemies = [];

// 道具
class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.w = 24;
        this.h = 24;
        this.vy = 2;
        this.active = true;
        this.bob = 0;
    }
    update() {
        this.y += this.vy;
        this.bob += 0.1;
        if (this.y > GAME_HEIGHT + 30) this.active = false;
    }
    draw() {
        ctx.save();
        const bobY = Math.sin(this.bob) * 3;
        ctx.translate(this.x, this.y + bobY);
        ctx.shadowBlur = 12;
        
        let icon, color;
        switch (this.type) {
            case 'power': icon = '🔥'; color = '#ff6600'; break;
            case 'life': icon = '❤️'; color = '#ff4444'; break;
            case 'bomb': icon = '💣'; color = '#ffcc00'; break;
            case 'energy': icon = '⚡'; color = '#00ff88'; break;
            default: icon = '?'; color = '#fff';
        }
        
        ctx.shadowColor = color;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 0, 0);
        ctx.restore();
    }
    collect() {
        playSound('powerup');
        switch (this.type) {
            case 'power':
                if (player.power < 5) player.power++;
                break;
            case 'life':
                player.lives = Math.min(5, player.lives + 1);
                break;
            case 'bomb':
                player.bombs = Math.min(5, player.bombs + 1);
                break;
            case 'energy':
                player.energy = Math.min(100, player.energy + 20);
                break;
        }
        spawnExplosion(this.x, this.y, '#00ff88', 8);
        updateHUD();
    }
}

let items = [];

// 关卡系统
let enemiesKilled = 0;
let bossSpawned = false;
let levelScoreThreshold = 2000;

function checkLevelUp() {
    enemiesKilled++;
    if (score >= levelScoreThreshold && !bossSpawned) {
        // 生成 Boss
        enemies.push(new Enemy(5));
        bossSpawned = true;
    }
}

function nextLevel() {
    level++;
    levelScoreThreshold = level * 2000;
    enemiesKilled = 0;
    bossSpawned = false;
    gameState = STATE.UPGRADE;
    showUpgradeScreen();
    updateHUD();
}

function showUpgradeScreen() {
    document.getElementById('upgrade-screen').classList.remove('hidden');
}

function hideUpgradeScreen() {
    document.getElementById('upgrade-screen').classList.add('hidden');
}

// 敌机生成
let spawnTimer = 0;
function spawnEnemies() {
    spawnTimer--;
    if (spawnTimer <= 0) {
        const maxTypes = Math.min(4, 1 + Math.floor(level / 2));
        const type = Math.floor(rand(1, maxTypes + 1));
        enemies.push(new Enemy(type));
        spawnTimer = Math.max(20, 60 - level * 4);
    }
}


// 碰撞检测
function checkCollisions() {
    // 玩家子弹 vs 敌机
    for (const b of bullets) {
        if (!b.active || !b.isPlayer) continue;
        for (const e of enemies) {
            if (!e.active) continue;
            const ex = e.x - e.w / 2, ey = e.y - e.h / 2;
            if (b.x > ex && b.x < ex + e.w && b.y > ey && b.y < ey + e.h) {
                b.active = false;
                e.hit(b.damage);
                break;
            }
        }
    }
    
    // 敌机子弹 vs 玩家
    for (const b of bullets) {
        if (!b.active || b.isPlayer) continue;
        const px = player.x - player.w / 2, py = player.y - player.h / 2;
        if (b.x > px && b.x < px + player.w && b.y > py && b.y < py + player.h) {
            b.active = false;
            player.hit();
        }
    }
    
    // 敌机 vs 玩家（撞击）
    for (const e of enemies) {
        if (!e.active) continue;
        const ex = e.x - e.w / 2, ey = e.y - e.h / 2;
        const px = player.x - player.w / 2, py = player.y - player.h / 2;
        if (px < ex + e.w && px + player.w > ex && py < ey + e.h && py + player.h > ey) {
            e.active = false;
            e.hit(999);
            player.hit();
        }
    }
    
    // 道具 vs 玩家
    for (const item of items) {
        if (!item.active) continue;
        if (dist(item.x, item.y, player.x, player.y) < 30) {
            item.active = false;
            item.collect();
        }
    }
}

// HUD 更新
function updateHUD() {
    document.getElementById('lives').textContent = player.lives;
    document.getElementById('power').textContent = player.power;
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('bombs').textContent = player.bombs;
    document.getElementById('energy').textContent = Math.floor(player.energy);
}

// 屏幕震动
function applyShake() {
    if (shakeTimer > 0) {
        shakeTimer--;
        const dx = rand(-4, 4);
        const dy = rand(-4, 4);
        ctx.translate(dx, dy);
    }
}

// 游戏主循环
function gameLoop() {
    requestAnimationFrame(gameLoop);
    
    if (gameState !== STATE.PLAYING && gameState !== STATE.UPGRADE) {
        // 菜单和游戏结束时也更新背景
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        for (const s of stars) {
            s.update();
            s.draw();
        }
        return;
    }
    
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.save();
    applyShake();
    
    // 背景
    for (const s of stars) {
        s.update();
        s.draw();
    }
    
    if (gameState === STATE.PLAYING) {
        frameCount++;
        
        // 玩家
        player.update();
        player.draw();
        
        // 子弹
        for (const b of bullets) {
            b.update();
            b.draw();
        }
        bullets = bullets.filter(b => b.active);
        
        // 敌机
        spawnEnemies();
        for (const e of enemies) {
            e.update();
            e.draw();
        }
        enemies = enemies.filter(e => e.active);
        
        // 道具
        for (const item of items) {
            item.update();
            item.draw();
        }
        items = items.filter(i => i.active);
        
        // 碰撞
        checkCollisions();
        
        // 粒子
        for (const p of particles) {
            p.update();
            p.draw();
        }
        particles = particles.filter(p => p.life > 0);
        
        // 检查是否进入下一关（Boss 被消灭后）
        if (bossSpawned && enemies.filter(e => e.type === 5).length === 0) {
            nextLevel();
        }
        
        // 更新 HUD
        if (frameCount % 10 === 0) updateHUD();
    }
    
    ctx.restore();
}

// 游戏控制
function startGame() {
    initAudio();
    gameState = STATE.PLAYING;
    score = 0;
    level = 1;
    frameCount = 0;
    enemiesKilled = 0;
    bossSpawned = false;
    levelScoreThreshold = 2000;
    bullets = [];
    enemies = [];
    items = [];
    particles = [];
    player = new Player();
    
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    updateHUD();
}

function gameOver() {
    gameState = STATE.GAMEOVER;
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-level').textContent = level;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('gameover-screen').classList.remove('hidden');
}

function pauseGame() {
    if (gameState === STATE.PLAYING) {
        gameState = STATE.PAUSED;
        document.getElementById('pause-screen').classList.remove('hidden');
    }
}

function resumeGame() {
    if (gameState === STATE.PAUSED) {
        gameState = STATE.PLAYING;
        document.getElementById('pause-screen').classList.add('hidden');
    }
}

// 升级选择
function selectUpgrade(type) {
    switch (type) {
        case 'power':
            if (player.power < 5) player.power++;
            break;
        case 'speed':
            player.speed = Math.min(10, player.speed + 0.8);
            player.shootInterval = Math.max(5, player.shootInterval - 1);
            break;
        case 'shield':
            player.shield = Math.min(3, player.shield + 1);
            break;
        case 'bomb':
            player.bombs = Math.min(5, player.bombs + 2);
            break;
    }
    hideUpgradeScreen();
    gameState = STATE.PLAYING;
    updateHUD();
}

// 事件监听
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);

document.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => selectUpgrade(btn.dataset.type));
});

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    keys[e.key.toLowerCase()] = true;
    
    if (e.code === 'Space') e.preventDefault();
    
    if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === STATE.PLAYING) pauseGame();
        else if (gameState === STATE.PAUSED) resumeGame();
    }
    
    if (e.code === 'KeyB') {
        if (gameState === STATE.PLAYING) player.useBomb();
    }
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
    keys[e.key.toLowerCase()] = false;
});

// 鼠标
canvas.addEventListener('mousedown', e => {
    mouseDown = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
    touchActive = false;
});

window.addEventListener('mouseup', () => {
    mouseDown = false;
});

canvas.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// 触摸
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchActive = true;
    mouseDown = true;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    if (gameState === STATE.MENU) startGame();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    touchActive = false;
    mouseDown = false;
});

// 启动游戏循环
requestAnimationFrame(gameLoop);
