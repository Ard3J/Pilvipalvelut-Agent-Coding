import { Player, Projectile, Enemy, EnemyProjectile } from './entities.js';

class InputHandler {
    constructor() {
        this.keys = new Set();
        window.addEventListener('keydown', e => this.keys.add(e.code));
        window.addEventListener('keyup', e => this.keys.delete(e.code));
    }
}

class SoundHandler {
    constructor() {
        this.ctx = null;
        this.musicStarted = false;
        this.droneOscs = [];
        this.melody = [110, 130.81, 146.83, 164.81];
        this.noteIndex = 0;
    }
    _play(freq, type, duration, volume, endFreq) {
        try {
            // Initialize AudioContext on first interaction
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
            
            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) { console.warn("Audio Context failed to start:", e); }
    }
    shoot() { this._play(800, 'triangle', 0.1, 0.1, 100); }
    asteroidExplosion(volumeScale = 1) { this._play(150, 'sawtooth', 0.3, 0.2 * volumeScale, 40); }
    alienExplosion(volumeScale = 1) { this._play(600, 'sine', 0.2, 0.15 * volumeScale, 200); }
    hit() { this._play(100, 'square', 0.2, 0.2, 50); }
    alienShoot() { this._play(400, 'sine', 0.15, 0.1, 600); }

    startMusic() {
        if (this.musicStarted) return;
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.musicStarted = true;

            // Layered Ambient Drone for better audibility
            // 60Hz Fundamental (Deep hum) and 120Hz Harmonic (Tech buzz)
            const layers = [
                { freq: 60, type: 'triangle', vol: 0.03 },
                { freq: 121, type: 'sine', vol: 0.02 } // Slightly detuned for phasing
            ];

            layers.forEach(layer => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = layer.type;
                osc.frequency.setValueAtTime(layer.freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(layer.vol, this.ctx.currentTime);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                this.droneOscs.push(osc);
            });
        } catch (e) { console.warn("Ambient music failed to start:", e); }
    }
    playMelodyNote() {
        if (this.ctx && this.ctx.state === 'running' && this.musicStarted) {
            const freq = this.melody[this.noteIndex % this.melody.length];
            // The note duration remains 1.2s to create a layered "wash" of sound as tempo increases
            this._play(freq, 'sine', 1.2, 0.04, freq);
            this.noteIndex++;
        }
    }

    stopMusic() {
        this.droneOscs.forEach(osc => {
            try { osc.stop(); } catch(e) {}
            osc.disconnect();
        });
        this.droneOscs = [];
        this.musicStarted = false;
        this.noteIndex = 0;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 500;
        this.canvas.height = 700;
        this.input = new InputHandler();
        this.player = new Player(this.canvas.width, this.canvas.height);
        this.projectiles = [];
        this.enemies = [];
        this.enemyProjectiles = [];
        this.score = 0;
        this.sounds = new SoundHandler();
        this.gameStarted = false;
        this.melodyTimer = 0;
        this.spawnTimer = 0;
        this.gameOver = false;
        this.scoreElement = document.getElementById('score');
        this.healthBarContainer = document.getElementById('health-bar-container');

        // Initialize health bar segments
        for (let i = 0; i < this.player.maxHealth; i++) {
            const segment = document.createElement('div');
            segment.classList.add('health-segment');
            segment.classList.add('filled'); // Start all filled
            this.healthBarContainer.appendChild(segment);
        }
    }
    handleCollisions() {
        this.projectiles.forEach(p => {
            this.enemies.forEach(e => {
                if (p.isColliding(e)) {
                    p.markedForDeletion = true;
                    e.health--;
                    if (e.health <= 0) {
                        e.markedForDeletion = true;
                        this.score += e.points;
                        const volumeScale = e.width / 50; // Max size in Enemy constructor is 50
                        if (e.type === 'alien') {
                            this.sounds.alienExplosion(volumeScale);
                        } else {
                            this.sounds.asteroidExplosion(volumeScale);
                        }
                    }
                }
            });
        });
        this.enemies.forEach(e => {
            if (this.player.isColliding(e)) {
                this.player.health -= e.health;
                e.markedForDeletion = true;
                this.sounds.hit();
            }
        });
        this.enemyProjectiles.forEach(ep => {
            if (this.player.isColliding(ep)) {
                this.player.health -= 1;
                ep.markedForDeletion = true;
                this.sounds.hit();
            }
        });
    }
    update() {
        if (!this.gameStarted) {
            if (this.input.keys.has('Enter')) {
                this.gameStarted = true;
                this.sounds.startMusic();
            }
            return;
        }
        
        if (this.gameOver) return;
        
        this.score += 0.1; // Gain points slowly over time
        if (this.player.health <= 0) {
            this.gameOver = true;
            this.sounds.stopMusic();
        }

        // Calculate difficulty multiplier based on score (increases 10% every 1000 points)
        const difficultyMultiplier = 1 + (this.score / 10000);

        // Dynamic Melody Tempo: The 800ms base delay (~48 frames) is divided by the multiplier
        this.melodyTimer--;
        if (this.melodyTimer <= 0) {
            this.sounds.playMelodyNote();
            this.melodyTimer = Math.max(12, Math.floor(48 / difficultyMultiplier));
        }

        this.player.update(this.input, this.canvas.width, this.canvas.height);
        if (this.input.keys.has('Space') && this.player.cooldown === 0) {
            this.projectiles.push(new Projectile(this.player.x + this.player.width / 2, this.player.y));
            // Scale fire rate: lower cooldown means faster firing. 
            // Capped at 5 frames to maintain gameplay balance.
            this.player.cooldown = Math.max(5, Math.floor(15 / difficultyMultiplier));
            this.sounds.shoot();
        }

        if (this.spawnTimer <= 0) {
            const enemy = new Enemy(this.canvas.width);
            enemy.speed *= difficultyMultiplier; // Scale enemy descent speed
            this.enemies.push(enemy);
            this.spawnTimer = Math.max(15, 60 - Math.floor(this.score / 1000));
        }
        this.spawnTimer--;
        this.projectiles.forEach(p => p.update());
        this.enemies.forEach(e => e.update(this.canvas.height, this.player.x, (ex, ey) => {
            const ep = new EnemyProjectile(ex, ey, this.player.x);
            ep.speed *= (difficultyMultiplier * 0.8); // Scale enemy bullet speed slightly slower
            this.enemyProjectiles.push(ep);
            this.sounds.alienShoot();
        }));
        this.enemyProjectiles.forEach(ep => ep.update(this.canvas.height));

        this.handleCollisions();

        this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
        this.enemyProjectiles = this.enemyProjectiles.filter(ep => !ep.markedForDeletion);
        this.scoreElement.innerText = Math.floor(this.score);
        
        // Update health bar segments
        const segments = this.healthBarContainer.children;
        for (let i = 0; i < this.player.maxHealth; i++) {
            if (i < this.player.health) {
                segments[i].classList.add('filled');
                segments[i].classList.remove('empty');
            } else {
                segments[i].classList.add('empty');
                segments[i].classList.remove('filled');
            }
        }
    }
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.player.draw(this.ctx);
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.enemyProjectiles.forEach(ep => ep.draw(this.ctx));

        if (!this.gameStarted) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#00f2ff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '32px Courier New';
            this.ctx.fillText('MISSION: DEEP SPACE', this.canvas.width / 2, this.canvas.height / 2 - 30);
            this.ctx.font = '20px Courier New';
            this.ctx.fillText('PRESS ENTER TO START', this.canvas.width / 2, this.canvas.height / 2 + 30);
        }

        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#00f2ff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px Courier New';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = '24px Courier New';
            this.ctx.fillText(`FINAL SCORE: ${Math.floor(this.score)}`, this.canvas.width / 2, this.canvas.height / 2 + 30);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText('Press F5 to restart', this.canvas.width / 2, this.canvas.height / 2 + 70);
        }
    }
    run() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.run());
    }
}
const game = new Game();
game.run();