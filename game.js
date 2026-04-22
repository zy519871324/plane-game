const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = 480;
const GAME_HEIGHT = 800;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, UPGRADE: 3, GAMEOVER: 4, LEVEL_DONE: 5 };
let gameState = STATE.MENU;
let score = 0;
let level = 1;
let chapter = 1;
let frameCount = 0;
let shakeTimer = 0;
let combo = 0;
let comboTimer = 0;
let maxCombo = 0;
let totalKills = 0;

const keys = {};
let mouseX = 0, mouseY = 0;
let mouseDown = false;
let touchActive = false;
let touchX = 0, touchY = 0;

// 音效
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new AudioCtx(); }

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'shootHeavy') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'bomb') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(15, now + 0.6);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'combo') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600 + combo * 50, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    }
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

// 章节主题色
function getChapterTheme(c) {
    const themes = [
        { bg1: '#0a0a2e', bg2: '#1a0a3e', star: '#ffffff', accent: '#00ffff', enemy: '#ff4444' },
        { bg1: '#0a1a0a', bg2: '#0a2e1a', star: '#aaffaa', accent: '#00ff66', enemy: '#ff8800' },
        { bg1: '#1a0a0a', bg2: '#2e0a0a', star: '#ffaaaa', accent: '#ff0066', enemy: '#ffcc00' },
        { bg1: '#0a0a1a', bg2: '#0a1a2e', star: '#aaccff', accent: '#4488ff', enemy: '#ff66cc' },
        { bg1: '#1a1a0a', bg2: '#2e2e0a', star: '#ffffaa', accent: '#ffcc00', enemy: '#ff0000' },
    ];
    return themes[(c - 1) % themes.length];
}

// 视差背景
class StarLayer {
    constructor(count, speedMod, sizeMod) {
        this.stars = [];
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: rand(0, GAME_WIDTH),
                y: rand(0, GAME_HEIGHT),
                size: rand(0.5, 2.5) * sizeMod,
                speed: rand(0.3, 2) * speedMod,
                alpha: rand(0.3, 1),
                twinkle: rand(0, Math.PI * 2)
            });
        }
        this.speedMod = speedMod;
    }
    update() {
        const theme = getChapterTheme(chapter);
        for (const s of this.stars) {
            s.y += s.speed + (level * 0.1 * this.speedMod);
            s.twinkle += 0.05;
            if (s.y > GAME_HEIGHT + 5) {
                s.y = -5;
                s.x = rand(0, GAME_WIDTH);
            }
        }
    }
    draw() {
        const theme = getChapterTheme(chapter);
        for (const s of this.stars) {
            const a = s.alpha * (0.7 + 0.3 * Math.sin(s.twinkle));
            ctx.fillStyle = theme.star;
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

class Nebula {
    constructor() {
        this.x = rand(0, GAME_WIDTH);
        this.y = -100;
        this.radius = rand(60, 150);
        this.speed = rand(0.2, 0.5);
        this.hue = rand(0, 360);
        this.active = true;
    }
    update() {
        this.y += this.speed;
        if (this.y > GAME_HEIGHT + 150) this.active = false;
    }
    draw() {
        const theme = getChapterTheme(chapter);
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        g.addColorStop(0, `hsla(${this.hue}, 60%, 30%, 0.08)`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

const starLayers = [new StarLayer(40, 0.3, 0.8), new StarLayer(50, 0.7, 1), new StarLayer(20, 1.5, 1.5)];
let nebulas = [];

// 粒子系统
class Particle {
    constructor(x, y, color, speed, life, size) {
        this.x = x; this.y = y;
        this.vx = rand(-speed, speed);
        this.vy = rand(-speed, speed);
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size || rand(2, 5);
        this.decay = rand(0.92, 0.98);
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= this.decay;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }
    draw() {
        ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

let particles = [];

function spawnExplosion(x, y, color, count = 20, spread = 5) {
    for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(1, spread);
        particles.push(new Particle(x, y, color, speed, rand(20, 50), rand(2, 6)));
    }
    // 火花
    for (let i = 0; i < count / 2; i++) {
        particles.push(new Particle(x, y, '#ffffff', spread * 1.5, rand(10, 25), rand(1, 3)));
    }
}

// 子弹
class Bullet {
    constructor(x, y, vx, vy, isPlayer, damage = 1, type = 'normal') {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.isPlayer = isPlayer;
        this.damage = damage;
        this.type = type;
        this.w = 6; this.h = 14;
        this.active = true;
        this.trail = [];
    }
    update() {
        this.trail.push({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > 6) this.trail.shift();
        for (const t of this.trail) t.alpha *= 0.7;
        
        this.x += this.vx;
        this.y += this.vy;
        if (this.y < -30 || this.y > GAME_HEIGHT + 30 || this.x < -30 || this.x > GAME_WIDTH + 30) {
            this.active = false;
        }
    }
    draw() {
        const theme = getChapterTheme(chapter);
        // 拖尾
        for (const t of this.trail) {
            ctx.globalAlpha = t.alpha * 0.5;
            ctx.fillStyle = this.isPlayer ? theme.accent : '#ff4444';
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.type === 'heavy' ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        // 主体
        ctx.save();
        if (this.isPlayer) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = theme.accent;
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ff4444';
            ctx.fillStyle = '#ffaaaa';
        }
        const w = this.type === 'heavy' ? 8 : this.w;
        const h = this.type === 'heavy' ? 18 : this.h;
        ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);
        ctx.restore();
    }
}

let bullets = [];

// 玩家战机
class Player {
    constructor() {
        this.x = GAME_WIDTH / 2;
        this.y = GAME_HEIGHT - 120;
        this.w = 36;
        this.h = 48;
        this.speed = 5;
        this.shootTimer = 0;
        this.shootInterval = 10;
        this.power = 1;
        this.lives = 3;
        this.bombs = 3;
        this.shield = 0;
        this.energy = 0;
        this.invincible = 0;
        this.engineAnim = 0;
        this.magnet = 0;
        this.doubleScore = 0;
        this.slowMo = 0;
    }
    update() {
        let dx = 0, dy = 0;
        if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) dx += 1;
        if (keys['ArrowUp'] || keys['KeyW'] || keys['w']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS'] || keys['s']) dy += 1;
        
        if (mouseDown && !touchActive) {
            const rect = canvas.getBoundingClientRect();
            const sx = GAME_WIDTH / rect.width;
            const sy = GAME_HEIGHT / rect.height;
            const mx = (mouseX - rect.left) * sx;
            const my = (mouseY - rect.top) * sy;
            dx += (mx - this.x) * 0.04;
            dy += (my - this.y) * 0.04;
        }
        if (touchActive) {
            const rect = canvas.getBoundingClientRect();
            const sx = GAME_WIDTH / rect.width;
            const sy = GAME_HEIGHT / rect.height;
            const tx = (touchX - rect.left) * sx;
            const ty = (touchY - rect.top) * sy;
            dx += (tx - this.x) * 0.06;
            dy += (ty - this.y) * 0.06;
        }
        
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
        
        const spd = this.speed * (this.slowMo > 0 ? 1.3 : 1);
        this.x = clamp(this.x + dx * spd, this.w, GAME_WIDTH - this.w);
        this.y = clamp(this.y + dy * spd, this.h, GAME_HEIGHT - this.h);
        
        this.shootTimer--;
        const si = this.slowMo > 0 ? Math.max(4, this.shootInterval - 3) : this.shootInterval;
        if ((keys['Space'] || mouseDown || touchActive) && this.shootTimer <= 0) {
            this.shoot();
            this.shootTimer = si;
        }
        
        if (this.invincible > 0) this.invincible--;
        if (this.magnet > 0) this.magnet--;
        if (this.doubleScore > 0) this.doubleScore--;
        if (this.slowMo > 0) this.slowMo--;
        this.engineAnim += 0.3;
        if (this.energy < 100) this.energy += 0.015;
    }
    shoot() {
        playSound(this.power >= 4 ? 'shootHeavy' : 'shoot');
        const dmg = 1 + Math.floor(this.power / 3);
        const theme = getChapterTheme(chapter);
        if (this.power === 1) {
            bullets.push(new Bullet(this.x, this.y - 22, 0, -12, true, dmg));
        } else if (this.power === 2) {
            bullets.push(new Bullet(this.x - 10, this.y - 18, -0.3, -11, true, dmg));
            bullets.push(new Bullet(this.x + 10, this.y - 18, 0.3, -11, true, dmg));
        } else if (this.power === 3) {
            bullets.push(new Bullet(this.x, this.y - 24, 0, -13, true, dmg));
            bullets.push(new Bullet(this.x - 14, this.y - 18, -1.5, -11, true, dmg));
            bullets.push(new Bullet(this.x + 14, this.y - 18, 1.5, -11, true, dmg));
        } else if (this.power === 4) {
            bullets.push(new Bullet(this.x, this.y - 26, 0, -14, true, dmg, 'heavy'));
            bullets.push(new Bullet(this.x - 14, this.y - 20, -1, -12, true, dmg));
            bullets.push(new Bullet(this.x + 14, this.y - 20, 1, -12, true, dmg));
            bullets.push(new Bullet(this.x - 22, this.y - 14, -2.5, -10, true, dmg));
            bullets.push(new Bullet(this.x + 22, this.y - 14, 2.5, -10, true, dmg));
        } else {
            bullets.push(new Bullet(this.x, this.y - 28, 0, -15, true, dmg + 1, 'heavy'));
            bullets.push(new Bullet(this.x - 12, this.y - 22, -0.8, -13, true, dmg));
            bullets.push(new Bullet(this.x + 12, this.y - 22, 0.8, -13, true, dmg));
            bullets.push(new Bullet(this.x - 22, this.y - 16, -2, -11, true, dmg));
            bullets.push(new Bullet(this.x + 22, this.y - 16, 2, -11, true, dmg));
            bullets.push(new Bullet(this.x - 30, this.y - 10, -3.5, -9, true, dmg));
            bullets.push(new Bullet(this.x + 30, this.y - 10, 3.5, -9, true, dmg));
        }
    }
    useBomb() {
        if (this.bombs > 0) {
            this.bombs--;
            playSound('bomb');
            shakeTimer = 25;
            for (const e of enemies) {
                if (!e.active) continue;
                e.hp -= 25;
                if (e.hp <= 0) {
                    e.active = false;
                    const mul = this.doubleScore > 0 ? 2 : 1;
                    const pts = e.score * mul * (1 + combo * 0.1);
                    score += Math.floor(pts);
                    spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, e.color, e.type >= 5 ? 50 : 20);
                    addCombo();
                }
            }
            for (const b of bullets) { if (!b.isPlayer) b.active = false; }
            for (let i = 0; i < 60; i++) {
                particles.push(new Particle(rand(0, GAME_WIDTH), rand(0, GAME_HEIGHT), '#ffffff', 10, rand(40, 80), rand(2, 6)));
            }
            updateHUD();
        }
    }
    hit() {
        if (this.invincible > 0) return false;
        if (this.shield > 0) {
            this.shield--;
            this.invincible = 90;
            playSound('powerup');
            return false;
        }
        this.lives--;
        this.invincible = 150;
        shakeTimer = 18;
        spawnExplosion(this.x, this.y, '#00ffff', 35);
        playSound('explosion');
        combo = 0;
        if (this.lives <= 0) gameOver();
        updateHUD();
        return true;
    }
    draw() {
        const theme = getChapterTheme(chapter);
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 护盾
        if (this.shield > 0) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 + 0.2 * Math.sin(frameCount * 0.1)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 38, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 255, 0.06)';
            ctx.fill();
        }
        
        // 无敌闪烁
        if (this.invincible > 0 && Math.floor(this.invincible / 5) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }
        
        // 引擎尾焰
        const fh = 10 + Math.sin(this.engineAnim) * 5;
        const fw = 6 + Math.cos(this.engineAnim * 1.3) * 2;
        ctx.fillStyle = '#ff6600';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(-fw, 22);
        ctx.lineTo(0, 22 + fh);
        ctx.lineTo(fw, 22);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(-fw * 0.5, 22);
        ctx.lineTo(0, 22 + fh * 0.7);
        ctx.lineTo(fw * 0.5, 22);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // 机翼（后）
        ctx.fillStyle = '#2255aa';
        ctx.beginPath();
        ctx.moveTo(-16, 5);
        ctx.lineTo(-32, 20);
        ctx.lineTo(-18, 18);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(16, 5);
        ctx.lineTo(32, 20);
        ctx.lineTo(18, 18);
        ctx.closePath();
        ctx.fill();
        
        // 机身
        ctx.fillStyle = '#4488dd';
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.quadraticCurveTo(12, -5, 14, 18);
        ctx.lineTo(8, 22);
        ctx.lineTo(-8, 22);
        ctx.lineTo(-14, 18);
        ctx.quadraticCurveTo(-12, -5, 0, -28);
        ctx.closePath();
        ctx.fill();
        
        // 机身高光
        ctx.fillStyle = '#66aaff';
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.quadraticCurveTo(6, -5, 7, 10);
        ctx.lineTo(3, 10);
        ctx.quadraticCurveTo(2, -5, 0, -20);
        ctx.closePath();
        ctx.fill();
        
        // 驾驶舱
        ctx.fillStyle = '#88ddff';
        ctx.beginPath();
        ctx.ellipse(0, -8, 7, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ccffff';
        ctx.beginPath();
        ctx.ellipse(-2, -10, 3, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 机翼（前装饰）
        ctx.strokeStyle = '#66aaff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-16, 5);
        ctx.lineTo(-32, 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(16, 5);
        ctx.lineTo(32, 20);
        ctx.stroke();
        
        ctx.restore();
    }
}

let player = new Player();

// 连击系统
function addCombo() {
    combo++;
    comboTimer = 120;
    if (combo > maxCombo) maxCombo = combo;
    if (combo > 1 && combo % 5 === 0) playSound('combo');
}

function updateCombo() {
    if (comboTimer > 0) {
        comboTimer--;
    } else {
        combo = 0;
    }
}


// 敌机
class Enemy {
    constructor(type) {
        this.type = type;
        this.active = true;
        this.w = 30; this.h = 30;
        this.x = rand(this.w, GAME_WIDTH - this.w);
        this.y = -50;
        this.vx = 0; this.vy = 2;
        this.hp = 3;
        this.maxHp = 3;
        this.score = 100;
        this.color = '#ff4444';
        this.shootTimer = rand(40, 100);
        this.angle = 0;
        this.phase = 0;
        this.bobOffset = rand(0, Math.PI * 2);
        this.flash = 0;
        
        const theme = getChapterTheme(chapter);
        
        switch (type) {
            case 1: // 突击机 - 菱形高速
                this.w = 28; this.h = 30;
                this.vy = 2.5 + level * 0.3 + chapter * 0.2;
                this.hp = 2 + level + Math.floor(chapter / 2);
                this.score = 100;
                this.color = '#ff6666';
                break;
            case 2: // 游荡机 - 正弦轨迹
                this.w = 26; this.h = 26;
                this.vy = 2 + level * 0.2;
                this.vx = rand(-1.5, 1.5);
                this.hp = 2 + Math.floor(level / 2) + Math.floor(chapter / 2);
                this.score = 150;
                this.color = '#ffaa44';
                break;
            case 3: // 坦克机 - 六边形厚血
                this.w = 44; this.h = 40;
                this.vy = 1 + level * 0.1;
                this.hp = 10 + level * 3 + chapter * 5;
                this.score = 350;
                this.color = '#ff4444';
                break;
            case 4: // 狙击机 - 圆形追踪弹
                this.w = 32; this.h = 32;
                this.vy = 1.5 + level * 0.15;
                this.hp = 4 + level * 2 + chapter;
                this.score = 280;
                this.color = '#ff66aa';
                break;
            case 5: // 干扰机 - 快速穿插
                this.w = 24; this.h = 28;
                this.vy = 3.5 + level * 0.3;
                this.vx = rand(-2, 2);
                this.hp = 2 + Math.floor(level / 3);
                this.score = 200;
                this.color = '#ffcc00';
                break;
            case 6: // 章节 Boss
                this.w = 90; this.h = 80;
                this.vy = 0.3;
                this.vx = 1.2;
                this.hp = 60 + level * 25 + chapter * 40;
                this.score = 3000;
                this.color = '#aa00ff';
                this.x = GAME_WIDTH / 2;
                this.y = -90;
                this.phase = 1;
                break;
        }
        this.maxHp = this.hp;
    }
    update() {
        const theme = getChapterTheme(chapter);
        this.angle += 0.03;
        this.bobOffset += 0.05;
        
        if (this.type === 2) {
            this.vx = Math.sin(this.angle * 2.5) * 2.5;
        } else if (this.type === 5) {
            this.vx = Math.sin(this.bobOffset * 2) * 3;
            if (this.y > GAME_HEIGHT * 0.4) this.vy = -1;
            if (this.y < 50) this.vy = 2;
        } else if (this.type === 6) {
            this.vx = Math.sin(this.angle * 0.6) * 2.5;
            this.y = clamp(this.y, 60, 180);
            // Boss 阶段切换
            if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
                this.phase = 2;
                this.shootTimer = 0;
                spawnExplosion(this.x, this.y, '#ff00ff', 30);
            }
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.x < this.w / 2 || this.x > GAME_WIDTH - this.w / 2) this.vx *= -1;
        
        // 射击
        this.shootTimer--;
        if (this.shootTimer <= 0 && this.y > 0 && this.y < GAME_HEIGHT - 80) {
            this.shoot();
            let baseInterval = 80;
            if (this.type === 6) baseInterval = this.phase === 1 ? 30 : 15;
            else if (this.type === 4) baseInterval = 50;
            else if (this.type === 3) baseInterval = 100;
            this.shootTimer = Math.max(15, baseInterval - level * 2);
        }
        
        if (this.y > GAME_HEIGHT + 60) this.active = false;
        if (this.flash > 0) this.flash--;
    }
    shoot() {
        const bx = this.x;
        const by = this.y + this.h / 2;
        if (this.type === 6) {
            if (this.phase === 1) {
                for (let i = -2; i <= 2; i++) {
                    bullets.push(new Bullet(bx + i * 18, by, i * 1.2, 4, false));
                }
            } else {
                // 狂暴阶段 - 环形弹幕
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + this.angle;
                    bullets.push(new Bullet(bx, by, Math.cos(a) * 4, Math.sin(a) * 4, false));
                }
                bullets.push(new Bullet(bx, by, 0, 5, false, 1, 'heavy'));
            }
        } else if (this.type === 4) {
            const angle = Math.atan2(player.y - by, player.x - bx);
            bullets.push(new Bullet(bx, by, Math.cos(angle) * 5, Math.sin(angle) * 5, false));
        } else if (this.type === 3) {
            bullets.push(new Bullet(bx - 12, by, 0, 3, false));
            bullets.push(new Bullet(bx + 12, by, 0, 3, false));
        } else {
            bullets.push(new Bullet(bx, by, 0, 4, false));
        }
    }
    hit(damage) {
        this.hp -= damage;
        this.flash = 5;
        if (this.hp <= 0) {
            this.active = false;
            const mul = player.doubleScore > 0 ? 2 : 1;
            const pts = this.score * mul * (1 + combo * 0.1);
            score += Math.floor(pts);
            spawnExplosion(this.x, this.y, this.color, this.type === 6 ? 60 : 20);
            playSound('explosion');
            addCombo();
            totalKills++;
            
            if (this.type === 6 || Math.random() < 0.22 + level * 0.015) {
                const r = Math.random();
                let itemType;
                if (r < 0.22) itemType = 'power';
                else if (r < 0.38) itemType = 'life';
                else if (r < 0.52) itemType = 'bomb';
                else if (r < 0.65) itemType = 'energy';
                else if (r < 0.76) itemType = 'magnet';
                else if (r < 0.86) itemType = 'double';
                else itemType = 'slow';
                items.push(new Item(this.x, this.y, itemType));
            }
            if (this.type === 6) player.energy = Math.min(100, player.energy + 40);
            checkLevelUp();
        } else {
            particles.push(new Particle(this.x + rand(-10, 10), this.y + rand(-10, 10), '#ffffff', 2, 8, 2));
            playSound('hit');
        }
    }
    draw() {
        const theme = getChapterTheme(chapter);
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.flash > 0) {
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.flash * 2);
        }
        
        // HP bar
        if (this.maxHp > 5 || this.type === 6) {
            const barW = this.w + 14;
            const barH = 5;
            ctx.fillStyle = '#222';
            ctx.fillRect(-barW / 2, -this.h / 2 - 14, barW, barH);
            const hpRatio = this.hp / this.maxHp;
            ctx.fillStyle = hpRatio > 0.5 ? '#00ff66' : hpRatio > 0.25 ? '#ffcc00' : '#ff2222';
            ctx.fillRect(-barW / 2, -this.h / 2 - 14, barW * hpRatio, barH);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.strokeRect(-barW / 2, -this.h / 2 - 14, barW, barH);
        }
        
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        
        if (this.type === 1) {
            // 突击机 - 尖锐菱形
            ctx.beginPath();
            ctx.moveTo(0, this.h / 2);
            ctx.lineTo(this.w / 2, -5);
            ctx.lineTo(0, -this.h / 2);
            ctx.lineTo(-this.w / 2, -5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff8888';
            ctx.beginPath();
            ctx.moveTo(0, this.h / 2 - 6);
            ctx.lineTo(4, -2);
            ctx.lineTo(0, -this.h / 2 + 8);
            ctx.lineTo(-4, -2);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 2) {
            // 游荡机 - 三角翼
            ctx.beginPath();
            ctx.moveTo(0, this.h / 2);
            ctx.lineTo(this.w / 2, -this.h / 2 + 5);
            ctx.lineTo(0, -this.h / 2 + 12);
            ctx.lineTo(-this.w / 2, -this.h / 2 + 5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffdd66';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 3) {
            // 坦克机 - 厚重六边形
            ctx.shadowBlur = 12;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? this.w / 2 : this.w / 2.8;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff8888';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 4) {
            // 狙击机 - 圆形带瞄准器
            ctx.beginPath();
            ctx.arc(0, 0, this.w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 5) {
            // 干扰机 - 闪电形
            ctx.beginPath();
            ctx.moveTo(0, this.h / 2);
            ctx.lineTo(8, 5);
            ctx.lineTo(3, 0);
            ctx.lineTo(10, -8);
            ctx.lineTo(0, -this.h / 2);
            ctx.lineTo(-10, -8);
            ctx.lineTo(-3, 0);
            ctx.lineTo(-8, 5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffff88';
            ctx.beginPath();
            ctx.moveTo(0, 6);
            ctx.lineTo(3, 0);
            ctx.lineTo(0, -6);
            ctx.lineTo(-3, 0);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 6) {
            // Boss - 机械战舰
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.phase === 2 ? '#ff00ff' : '#aa00ff';
            ctx.fillStyle = this.phase === 2 ? '#550077' : '#330055';
            ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
            // 装甲板
            ctx.fillStyle = this.phase === 2 ? '#7700aa' : '#550088';
            ctx.fillRect(-this.w / 2 + 6, -this.h / 2 + 6, this.w - 12, this.h - 12);
            // 核心
            const corePulse = 15 + Math.sin(frameCount * 0.1) * 5;
            ctx.fillStyle = this.phase === 2 ? '#ff00ff' : '#aa00ff';
            ctx.shadowColor = ctx.fillStyle;
            ctx.beginPath();
            ctx.arc(0, 0, corePulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            // 炮管
            ctx.fillStyle = '#440066';
            ctx.fillRect(-this.w / 2 - 10, -8, 14, 16);
            ctx.fillRect(this.w / 2 - 4, -8, 14, 16);
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(-this.w / 2 - 8, -4, 8, 8);
            ctx.fillRect(this.w / 2 - 2, -4, 8, 8);
            // 阶段标识
            if (this.phase === 2) {
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 28 + Math.sin(frameCount * 0.2) * 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
}

let enemies = [];

// 道具
class Item {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.w = 22; this.h = 22;
        this.vy = 2;
        this.active = true;
        this.bob = 0;
        this.rot = 0;
    }
    update() {
        this.y += this.vy;
        this.bob += 0.08;
        this.rot += 0.03;
        
        // 磁铁效果
        if (player.magnet > 0 && this.active) {
            const d = dist(this.x, this.y, player.x, player.y);
            if (d < 150) {
                this.x += (player.x - this.x) * 0.06;
                this.y += (player.y - this.y) * 0.06;
            }
        }
        
        if (this.y > GAME_HEIGHT + 30) this.active = false;
    }
    draw() {
        const theme = getChapterTheme(chapter);
        ctx.save();
        const bobY = Math.sin(this.bob) * 4;
        ctx.translate(this.x, this.y + bobY);
        ctx.rotate(this.rot);
        
        let color, glow;
        switch (this.type) {
            case 'power': color = '#ff6600'; glow = '#ff8844'; break;
            case 'life': color = '#ff2244'; glow = '#ff4466'; break;
            case 'bomb': color = '#ffcc00'; glow = '#ffdd44'; break;
            case 'energy': color = '#00ff88'; glow = '#44ffaa'; break;
            case 'magnet': color = '#4488ff'; glow = '#66aaff'; break;
            case 'double': color = '#ff66ff'; glow = '#ff88ff'; break;
            case 'slow': color = '#00ccff'; glow = '#44ddff'; break;
            default: color = '#fff'; glow = '#fff';
        }
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = glow;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        ctx.rotate(-this.rot);
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        
        let icon;
        switch (this.type) {
            case 'power': icon = 'P'; break;
            case 'life': icon = '♥'; break;
            case 'bomb': icon = 'B'; break;
            case 'energy': icon = 'E'; break;
            case 'magnet': icon = 'M'; break;
            case 'double': icon = 'x2'; break;
            case 'slow': icon = 'S'; break;
            default: icon = '?';
        }
        ctx.fillText(icon, 0, 0);
        ctx.restore();
    }
    collect() {
        playSound('powerup');
        switch (this.type) {
            case 'power': if (player.power < 5) player.power++; break;
            case 'life': player.lives = Math.min(5, player.lives + 1); break;
            case 'bomb': player.bombs = Math.min(5, player.bombs + 1); break;
            case 'energy': player.energy = Math.min(100, player.energy + 25); break;
            case 'magnet': player.magnet = 600; break;
            case 'double': player.doubleScore = 900; break;
            case 'slow': player.slowMo = 600; break;
        }
        spawnExplosion(this.x, this.y, '#00ff88', 10);
        updateHUD();
    }
}

let items = [];

// 关卡系统
let enemiesKilledInLevel = 0;
let bossSpawned = false;
let levelProgress = 0;
const LEVEL_KILLS_NEEDED = 15;

function checkLevelUp() {
    enemiesKilledInLevel++;
    levelProgress = enemiesKilledInLevel / LEVEL_KILLS_NEEDED;
    
    if (enemiesKilledInLevel >= LEVEL_KILLS_NEEDED && !bossSpawned) {
        enemies.push(new Enemy(6));
        bossSpawned = true;
    }
}

function nextLevel() {
    level++;
    if (level % 5 === 1 && level > 1) {
        chapter++;
    }
    enemiesKilledInLevel = 0;
    bossSpawned = false;
    levelProgress = 0;
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
    if (bossSpawned) return;
    spawnTimer--;
    if (spawnTimer <= 0) {
        const maxTypes = Math.min(5, 1 + Math.floor(level / 2) + Math.floor((chapter - 1) / 2));
        const type = Math.floor(rand(1, maxTypes + 1));
        enemies.push(new Enemy(type));
        spawnTimer = Math.max(18, 55 - level * 3 - chapter * 2);
    }
}


// 碰撞检测
function checkCollisions() {
    const px = player.x - player.w / 2, py = player.y - player.h / 2;
    
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
    
    for (const b of bullets) {
        if (!b.active || b.isPlayer) continue;
        if (b.x > px && b.x < px + player.w && b.y > py && b.y < py + player.h) {
            b.active = false;
            player.hit();
        }
    }
    
    for (const e of enemies) {
        if (!e.active) continue;
        const ex = e.x - e.w / 2, ey = e.y - e.h / 2;
        if (px < ex + e.w && px + player.w > ex && py < ey + e.h && py + player.h > ey) {
            e.active = false;
            e.hit(999);
            player.hit();
        }
    }
    
    for (const item of items) {
        if (!item.active) continue;
        if (dist(item.x, item.y, player.x, player.y) < 28) {
            item.active = false;
            item.collect();
        }
    }
}

// HUD
function updateHUD() {
    document.getElementById('lives').textContent = player.lives;
    document.getElementById('power').textContent = player.power;
    document.getElementById('score').textContent = Math.floor(score);
    document.getElementById('level').textContent = level;
    document.getElementById('chapter').textContent = chapter;
    document.getElementById('bombs').textContent = player.bombs;
    document.getElementById('energy').textContent = Math.floor(player.energy);
    document.getElementById('combo').textContent = combo;
    
    const energyBar = document.getElementById('energy-bar');
    if (energyBar) energyBar.style.width = player.energy + '%';
    
    const progressBar = document.getElementById('level-progress');
    if (progressBar) progressBar.style.width = (levelProgress * 100) + '%';
    
    const hud = document.getElementById('hud');
    if (player.doubleScore > 0) hud.classList.add('double-score');
    else hud.classList.remove('double-score');
}

function applyShake() {
    if (shakeTimer > 0) {
        shakeTimer--;
        ctx.translate(rand(-5, 5), rand(-5, 5));
    }
}

// 浮动文字
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color;
        this.life = 40;
        this.vy = -1.5;
    }
    update() {
        this.y += this.vy;
        this.life--;
    }
    draw() {
        ctx.globalAlpha = clamp(this.life / 40, 0, 1);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}
let floatingTexts = [];

// 游戏主循环
function gameLoop() {
    requestAnimationFrame(gameLoop);
    const theme = getChapterTheme(chapter);
    
    // 背景绘制（所有状态）
    ctx.fillStyle = theme.bg1;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, theme.bg1);
    g.addColorStop(1, theme.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    for (const s of starLayers) {
        s.update();
        s.draw();
    }
    
    if (gameState !== STATE.MENU && gameState !== STATE.GAMEOVER) {
        if (rand(0, 1) < 0.01) nebulas.push(new Nebula());
        for (const n of nebulas) { n.update(); n.draw(); }
        nebulas = nebulas.filter(n => n.active);
    }
    
    if (gameState === STATE.MENU || gameState === STATE.GAMEOVER) return;
    
    ctx.save();
    applyShake();
    
    if (gameState === STATE.PLAYING) {
        frameCount++;
        updateCombo();
        
        player.update();
        player.draw();
        
        for (const b of bullets) { b.update(); b.draw(); }
        bullets = bullets.filter(b => b.active);
        
        spawnEnemies();
        for (const e of enemies) { e.update(); e.draw(); }
        enemies = enemies.filter(e => e.active);
        
        for (const item of items) { item.update(); item.draw(); }
        items = items.filter(i => i.active);
        
        checkCollisions();
        
        for (const p of particles) { p.update(); p.draw(); }
        particles = particles.filter(p => p.life > 0);
        
        for (const ft of floatingTexts) { ft.update(); ft.draw(); }
        floatingTexts = floatingTexts.filter(ft => ft.life > 0);
        
        if (bossSpawned && enemies.filter(e => e.type === 6).length === 0) {
            nextLevel();
        }
        
        // 连击显示
        if (combo > 1 && comboTimer > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 215, 0, ${clamp(comboTimer / 60, 0, 1)})`;
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffd700';
            ctx.fillText(`${combo} 连击!`, GAME_WIDTH / 2, 120);
            ctx.restore();
        }
        
        // 状态效果提示
        if (player.magnet > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(68, 136, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(player.x, player.y, 150, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        if (frameCount % 10 === 0) updateHUD();
    }
    
    ctx.restore();
}

// 游戏控制
function startGame() {
    initAudio();
    gameState = STATE.PLAYING;
    score = 0; level = 1; chapter = 1;
    frameCount = 0;
    enemiesKilledInLevel = 0;
    bossSpawned = false;
    levelProgress = 0;
    combo = 0; comboTimer = 0; maxCombo = 0; totalKills = 0;
    bullets = []; enemies = []; items = []; particles = []; nebulas = []; floatingTexts = [];
    player = new Player();
    
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    updateHUD();
}

function gameOver() {
    gameState = STATE.GAMEOVER;
    document.getElementById('final-score').textContent = Math.floor(score);
    document.getElementById('final-level').textContent = level;
    document.getElementById('final-chapter').textContent = chapter;
    document.getElementById('final-combo').textContent = maxCombo;
    document.getElementById('final-kills').textContent = totalKills;
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

function selectUpgrade(type) {
    switch (type) {
        case 'power': if (player.power < 5) player.power++; break;
        case 'speed': player.speed = Math.min(10, player.speed + 0.8); player.shootInterval = Math.max(5, player.shootInterval - 1); break;
        case 'shield': player.shield = Math.min(3, player.shield + 1); break;
        case 'bomb': player.bombs = Math.min(5, player.bombs + 2); break;
    }
    hideUpgradeScreen();
    gameState = STATE.PLAYING;
    updateHUD();
}

// 事件
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
    if (e.code === 'KeyB' && gameState === STATE.PLAYING) player.useBomb();
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousedown', e => {
    mouseDown = true; mouseX = e.clientX; mouseY = e.clientY; touchActive = false;
});
window.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchActive = true; mouseDown = true;
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
    if (gameState === STATE.MENU) startGame();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
}, { passive: false });
canvas.addEventListener('touchend', e => {
    e.preventDefault(); touchActive = false; mouseDown = false;
});

requestAnimationFrame(gameLoop);
