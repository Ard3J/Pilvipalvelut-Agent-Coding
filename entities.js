class GameObject {
    constructor(x, y, width, height, speed) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.markedForDeletion = false;
    }
    isColliding(other) {
        return (
            this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y
        );
    }
}

export class Player extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        super(canvasWidth / 2 - 20, canvasHeight - 80, 40, 40, 6);
        this.health = 5;
        this.maxHealth = 5; // Maximum health for the player
        this.color = '#00f2ff'; // Player's color
        this.cooldown = 0;
    }
    draw(ctx) {
        // Engine Exhaust (flickering flame)
        const flameH = 10 + Math.random() * 10;
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width * 0.4, this.y + this.height * 0.9);
        ctx.lineTo(this.x + this.width * 0.5, this.y + this.height * 0.9 + flameH);
        ctx.lineTo(this.x + this.width * 0.6, this.y + this.height * 0.9);
        ctx.fill();

        // Wings - Using player color
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height * 0.3);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height * 0.8);
        ctx.fill();

        // Main Fuselage (Body)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width * 0.3, this.y + this.height * 0.9);
        ctx.lineTo(this.x + this.width * 0.7, this.y + this.height * 0.9);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#001a33';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height * 0.4, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    update(input, canvasWidth, canvasHeight) {
        if ((input.keys.has('ArrowLeft') || input.keys.has('KeyA')) && this.x > 0) this.x -= this.speed;
        if ((input.keys.has('ArrowRight') || input.keys.has('KeyD')) && this.x < canvasWidth - this.width) this.x += this.speed;
        if ((input.keys.has('ArrowUp') || input.keys.has('KeyW')) && this.y > 0) this.y -= this.speed;
        if ((input.keys.has('ArrowDown') || input.keys.has('KeyS')) && this.y < canvasHeight - this.height) this.y += this.speed;
        if (this.cooldown > 0) this.cooldown--;
    }
}

export class Projectile extends GameObject {
    constructor(x, y) {
        super(x - 2, y, 4, 12, 8);
    }
    update() {
        this.y -= this.speed;
        if (this.y < -this.height) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.fillStyle = '#fffb00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

export class Enemy extends GameObject {
    constructor(canvasWidth) {
        const size = Math.random() * 30 + 20;
        super(Math.random() * (canvasWidth - size), -size, size, size, Math.random() * 2 + 2);
        this.type = Math.random() > 0.7 ? 'alien' : 'asteroid';
        // Health based on size: 1 hit for small, up to 3 for large
        this.maxHealth = Math.ceil((this.width - 15) / 10);
        this.health = this.maxHealth;
        // Points based on size and type
        this.points = Math.floor(this.width * (this.type === 'alien' ? 5 : 3));
        this.fireTimer = Math.random() * 100; // Offset firing start

        // Pre-calculate asteroid vertices and craters for irregular shape
        if (this.type === 'asteroid') {
            this.vertices = [];
            const sides = 6 + Math.floor(Math.random() * 4);
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * Math.PI * 2;
                const variance = Math.random() * 0.4 + 0.8; // 80% to 120% of radius
                this.vertices.push({
                    x: Math.cos(angle) * (this.width / 2) * variance,
                    y: Math.sin(angle) * (this.height / 2) * variance
                });
            }
            this.craters = [];
            const craterCount = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < craterCount; i++) {
                this.craters.push({
                    x: (Math.random() - 0.5) * (this.width * 0.5),
                    y: (Math.random() - 0.5) * (this.height * 0.5),
                    r: Math.random() * (this.width * 0.1) + 2
                });
            }
        }
    }
    update(canvasHeight, playerX, createEnemyProjectile) {
        this.y += this.speed;
        if (this.y > canvasHeight) this.markedForDeletion = true;

        // Aliens fire towards player occasionally
        if (this.type === 'alien') {
            this.fireTimer++;
            if (this.fireTimer >= 120) { // Fires roughly every 2 seconds
                createEnemyProjectile(this.x + this.width / 2, this.y + this.height);
                this.fireTimer = 0;
            }
        }
    }
    draw(ctx) {
        // Visual feedback for health: darker as they take damage
        ctx.globalAlpha = 0.4 + (this.health / this.maxHealth) * 0.6;

        if (this.type === 'alien') {
            // Anti-gravity Beam (flickering)
            const beamH = 5 + Math.random() * 10;
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width * 0.3, this.y + this.height * 0.7);
            ctx.lineTo(this.x + this.width * 0.5, this.y + this.height * 0.8 + beamH);
            ctx.lineTo(this.x + this.width * 0.7, this.y + this.height * 0.7);
            ctx.fill();

            // Flying Saucer Body
            ctx.fillStyle = '#ff2d55';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, this.y + this.height * 0.65, this.width / 2, this.height / 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Saucer Rim Lights (flashing)
            const time = Date.now() * 0.005;
            ctx.fillStyle = Math.floor(time * 3) % 2 === 0 ? '#ffffff' : '#ffea00';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(this.x + this.width * (0.25 + i * 0.25), this.y + this.height * 0.65, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Saucer Dome (translucent)
            ctx.fillStyle = 'rgba(100, 230, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height * 0.55, this.width / 4, Math.PI, 0);
            ctx.fill();

            // Pilot head
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height * 0.5, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Irregular Asteroid Shape
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2 + this.vertices[0].x, this.y + this.height / 2 + this.vertices[0].y);
            for (let i = 1; i < this.vertices.length; i++) {
                ctx.lineTo(this.x + this.width / 2 + this.vertices[i].x, this.y + this.height / 2 + this.vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();

            // Asteroid Surface Details (Craters)
            ctx.fillStyle = '#666';
            this.craters.forEach(c => {
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2 + c.x, this.y + this.height / 2 + c.y, c.r, 0, Math.PI * 2);
                ctx.fill();
            });

            // Shading effect (outline)
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        // Draw a small health bar for tough enemies
        if (this.maxHealth > 1) {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y - 5, this.width, 3);
            ctx.fillStyle = 'lime';
            ctx.fillRect(this.x, this.y - 5, this.width * (this.health / this.maxHealth), 3);
        }
    }
}

export class EnemyProjectile extends GameObject {
    constructor(x, y, targetX) {
        super(x - 3, y, 6, 6, 4);
        // Calculate simple trajectory towards player's X at time of firing
        this.vx = (targetX - x) * 0.01; 
    }
    update(canvasHeight) {
        this.y += this.speed;
        this.x += this.vx;
        if (this.y > canvasHeight) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}