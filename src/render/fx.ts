/**
 * Particle pool (REQ-051): at most 64 live particles, oldest is recycled.
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

export const PARTICLE_CAPACITY = 64;

export class ParticlePool {
  readonly capacity: number;
  readonly particles: Particle[];
  private cursor = 0;

  constructor(capacity: number = PARTICLE_CAPACITY) {
    this.capacity = capacity;
    this.particles = Array.from({ length: capacity }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      size: 0,
      color: '#FFFFFF',
      active: false,
    }));
  }

  get activeCount(): number {
    return this.particles.reduce((count, particle) => count + (particle.active ? 1 : 0), 0);
  }

  get allocations(): number {
    return this.particles.length;
  }

  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): Particle {
    let particle: Particle | undefined = this.particles.find((p) => !p.active);
    if (!particle) {
      particle = this.particles[this.cursor] as Particle;
      this.cursor = (this.cursor + 1) % this.capacity;
    }
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.maxLife = life;
    particle.size = size;
    particle.color = color;
    particle.active = life > 0;
    return particle;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= dtMs;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 360 * dt;
    }
  }

  clear(): void {
    for (const particle of this.particles) particle.active = false;
    this.cursor = 0;
  }
}
