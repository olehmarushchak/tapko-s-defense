/**
 * PixiJS render layer for Protect Tapko.
 * Reads GameState from props — gameEngine is never touched.
 * Real sprites loaded from TexturePacker-style atlas; falls back to
 * Graphics placeholders while assets are loading.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Application,
  Assets,
  AnimatedSprite,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Circle,
} from 'pixi.js';
import type { GameState, MascotState, Wolf } from '@/lib/gameEngine';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bgEdge:   0x1a1628,
  tree:     0x16132a,
  treeDark: 0x110e22,
  ground:   0x1f1b30,
  glow:     0xf2a65a,
  ember:    0xffbe6e,
} as const;

const PARTICLE_COLORS = [0xffe566, 0xff9a30, 0xffffff, 0xff5533];

// ─── Atlas frame-count manifest ───────────────────────────────────────────────
const FRAME_COUNTS: Record<string, number> = {
  mascot_idle:    8,
  mascot_fear:    8,
  mascot_hit:     6,
  mascot_victory: 8,
  mascot_defeat:  6,
  wolf_walk:      8,
  wolf_dying:     6,
};

const ANIM_FPS: Record<string, number> = {
  mascot_idle:    8,
  mascot_fear:    14,
  mascot_hit:     12,
  mascot_victory: 8,
  mascot_defeat:  6,
  wolf_walk:      10,
  wolf_dying:     12,
};

const LOOP: Record<string, boolean> = {
  mascot_idle:    true,
  mascot_fear:    true,
  mascot_hit:     false,
  mascot_victory: true,
  mascot_defeat:  false,
  wolf_walk:      true,
  wolf_dying:     false,
};

// ─── Internal types ───────────────────────────────────────────────────────────
interface Ember {
  gfx: Graphics;
  life: number;
  maxLife: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
}

interface HitEffect {
  particles: Array<{ gfx: Graphics; vx: number; vy: number }>;
  popup: Text;
  life: number;
  maxLife: number;
}

interface WolfEntry {
  id: number;
  container: Container;
  sprite: AnimatedSprite | null;
  glowSprite: Sprite;
  currentState: 'walk' | 'dying';
}

interface SpriteFrames {
  mascot: Record<MascotState, Texture[]>;
  wolfWalk:  Texture[];
  wolfDying: Texture[];
}

interface Scene {
  app: Application;
  glowSprite: Sprite;
  mascotContainer: Container;
  mascotSprite: AnimatedSprite | null;
  mascotState: MascotState;
  mascotStateTimer: number;
  wolvesContainer: Container;
  wolfMap: Map<number, WolfEntry>;
  embers: Ember[];
  embersLayer: Container;
  effectsLayer: Container;
  hitEffects: HitEffect[];
  shake: { remaining: number; amplitude: number };
  menaceGlowTex: Texture;
  time: number;
  spriteFrames: SpriteFrames | null;
  onHit: (id: number) => void;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function pct(v: number, dim: number) { return (v / 100) * dim; }

function getFrames(prefix: string): Texture[] {
  const n = FRAME_COUNTS[prefix] ?? 4;
  return Array.from({ length: n }, (_, i) =>
    Texture.from(`${prefix}_${String(i).padStart(4, '0')}.png`)
  );
}

function makeAnimSprite(prefix: string): AnimatedSprite {
  const frames = getFrames(prefix);
  const s = new AnimatedSprite(frames);
  s.anchor.set(0.5);
  s.animationSpeed = (ANIM_FPS[prefix] ?? 8) / 60;
  s.loop = LOOP[prefix] ?? true;
  return s;
}

// ─── Canvas / background helpers ──────────────────────────────────────────────
function buildBgTexture(W: number, H: number): Texture {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const r = Math.sqrt(W * W + H * H) * 0.62;
  const gr = ctx.createRadialGradient(W/2, H*0.52, 0, W/2, H*0.52, r);
  gr.addColorStop(0,    '#3d3352');
  gr.addColorStop(0.42, '#2b2438');
  gr.addColorStop(0.78, '#221d38');
  gr.addColorStop(1,    '#1a1628');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  return Texture.from(cv);
}

function buildGlowTexture(radius: number): Texture {
  const d = Math.ceil(radius * 2);
  const cv = document.createElement('canvas');
  cv.width = d; cv.height = d;
  const ctx = cv.getContext('2d')!;
  const gr = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gr.addColorStop(0,    'rgba(242,166,90,1)');
  gr.addColorStop(0.25, 'rgba(242,166,90,0.7)');
  gr.addColorStop(0.55, 'rgba(242,166,90,0.25)');
  gr.addColorStop(1,    'rgba(242,166,90,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, d, d);
  return Texture.from(cv);
}

// Red radial glow used as wolf menace aura (shared texture, nominal radius = 64px)
function buildMenaceGlowTexture(radius: number): Texture {
  const d = Math.ceil(radius * 2);
  const cv = document.createElement('canvas');
  cv.width = d; cv.height = d;
  const ctx = cv.getContext('2d')!;
  const gr = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gr.addColorStop(0,   'rgba(180, 10, 10, 0.75)');
  gr.addColorStop(0.4, 'rgba(140,  6,  6, 0.32)');
  gr.addColorStop(0.7, 'rgba(100,  0,  0, 0.10)');
  gr.addColorStop(1,   'rgba( 60,  0,  0, 0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, d, d);
  return Texture.from(cv);
}

// Vary a value by ±spread (default ±16%) — called once at scene init
function vary(n: number, spread = 0.16): number {
  return n * (1 + (Math.random() - 0.5) * spread);
}

function drawTrees(gfx: Graphics, W: number, H: number): void {
  const baseY = H * 0.805;
  gfx.rect(0, baseY, W, H - baseY).fill(C.ground);
  const defs: [number, number, number][] = [
    [-12,    vary(80),    vary(0.52, 0.22)],
    [34,     vary(60),    vary(0.40, 0.22)],
    [68,     vary(50),    vary(0.45, 0.22)],
    [W-70,   vary(80),    vary(0.50, 0.22)],
    [W-115,  vary(60),    vary(0.38, 0.22)],
    [W-148,  vary(52),    vary(0.44, 0.22)],
    [W*0.22, vary(55),    vary(0.29, 0.22)],
    [W*0.66, vary(55),    vary(0.27, 0.22)],
    [W*0.40, vary(38),    vary(0.20, 0.22)],
    [W*0.58, vary(38),    vary(0.22, 0.22)],
  ];
  for (const [x, w, hf] of defs) {
    const th = H * hf, mid = x + w/2;
    gfx.poly([x, baseY, mid, baseY-th, x+w, baseY], true).fill(C.tree);
    gfx.poly([x+w*0.18, baseY, mid, baseY-th*0.55, x+w*0.82, baseY], true).fill(C.treeDark);
  }
}

// ─── Ember particles ──────────────────────────────────────────────────────────
function makeEmber(layer: Container, W: number, H: number): Ember {
  const cx = W/2, cy = H/2;
  const size = 1.2 + Math.random() * 2.2;
  const gfx = new Graphics();
  gfx.circle(0, 0, size).fill(C.ember);
  (gfx as Graphics & { blendMode: string }).blendMode = 'add';
  layer.addChild(gfx);
  return {
    gfx, life: 0,
    maxLife: 1.6 + Math.random() * 1.8,
    x0: cx + (Math.random() - 0.5) * W * 0.17,
    y0: cy + (Math.random() * 0.08 - 0.01) * H,
    vx: (Math.random() - 0.5) * 24,
    vy: -(16 + Math.random() * 32),
  };
}

function resetEmber(e: Ember, W: number, H: number): void {
  const cx = W/2, cy = H/2;
  e.life = 0; e.maxLife = 1.6 + Math.random() * 1.8;
  e.x0 = cx + (Math.random()-0.5)*W*0.17;
  e.y0 = cy + (Math.random()*0.08-0.01)*H;
  e.vx = (Math.random()-0.5)*24;
  e.vy = -(16+Math.random()*32);
}

// ─── Hit feedback ─────────────────────────────────────────────────────────────
function triggerHitEffect(scene: Scene, x: number, y: number): void {
  const { effectsLayer } = scene;
  const count = 8;
  const particles: HitEffect['particles'] = [];

  for (let i = 0; i < count; i++) {
    const angle  = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const speed  = 55 + Math.random() * 75;
    const size   = 2.5 + Math.random() * 3;
    const color  = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]!;
    const gfx    = new Graphics();
    gfx.circle(0, 0, size).fill(color);
    (gfx as Graphics & { blendMode: string }).blendMode = 'add';
    gfx.x = x; gfx.y = y;
    effectsLayer.addChild(gfx);
    particles.push({ gfx, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }

  const popup = new Text({
    text: '+1',
    style: {
      fill: '#ffe566',
      fontSize: 32,
      fontWeight: '800',
      fontFamily: 'Arial, sans-serif',
    },
  });
  popup.anchor.set(0.5);
  popup.x = x;
  popup.y = y - 28;
  effectsLayer.addChild(popup);

  scene.hitEffects.push({ particles, popup, life: 0, maxLife: 0.55 });
}

function triggerShake(scene: Scene): void {
  scene.shake.remaining = 0.18;
  scene.shake.amplitude = 5;
}

// ─── Wolf helpers ─────────────────────────────────────────────────────────────
function buildWolfGlow(wolfR: number, menaceGlowTex: Texture): Sprite {
  const glow = new Sprite(menaceGlowTex);
  glow.anchor.set(0.5);
  glow.scale.set((wolfR * 2.8) / 64); // tex was drawn at radius=64
  glow.y = -wolfR * 0.1;
  (glow as Sprite & { blendMode: string }).blendMode = 'add';
  glow.alpha = 0.35;
  return glow;
}

function buildWolfEntry(
  wolf: Wolf,
  W: number,
  H: number,
  frames: SpriteFrames,
  menaceGlowTex: Texture,
  onHit: (id: number) => void,
): WolfEntry {
  const scale = Math.min(W, H);
  const wolfR = scale * 0.082;

  const sprite = new AnimatedSprite(frames.wolfWalk);
  sprite.anchor.set(0.5, 0.6);
  sprite.scale.set((wolfR * 2.2) / 192); // 192 = atlas frame size for wolves
  sprite.animationSpeed = (ANIM_FPS['wolf_walk'] ?? 10) / 60;
  sprite.loop = true;
  sprite.play();

  const cnt = new Container();
  cnt.eventMode = 'static';
  cnt.hitArea = new Circle(0, 0, wolfR * 1.3);
  cnt.cursor = 'pointer';
  cnt.on('pointerdown', (e) => { e.stopPropagation(); onHit(wolf.id); });

  // Glow at index 0 (behind sprite)
  const glowSprite = buildWolfGlow(wolfR, menaceGlowTex);
  cnt.addChild(glowSprite);
  cnt.addChild(sprite);

  const prog = wolf.state === 'dying' ? Math.min(wolf.dyingFor / 0.28, 1) : 0;
  cnt.x = pct(wolf.x + wolf.knockX * prog, W);
  cnt.y = pct(wolf.y + wolf.knockY * prog, H);
  cnt.alpha = wolf.state === 'dying' ? 1 - prog : 1;

  return { id: wolf.id, container: cnt, sprite, glowSprite, currentState: 'walk' };
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function installTicker(scene: Scene): void {
  const { app, glowSprite, embers } = scene;

  app.ticker.add((ticker) => {
    const dt = ticker.elapsedMS / 1000;
    scene.time += dt;
    scene.mascotStateTimer += dt;
    const t = scene.time;
    const W = app.screen.width, H = app.screen.height;
    const cx = W/2, cy = H/2;
    const ms = scene.mascotState;

    // ── Glow pulse ──
    const pulse = Math.sin(t * 2.35);
    glowSprite.alpha = 0.42 + pulse * 0.13;
    glowSprite.scale.set(0.87 + pulse * 0.08);

    // ── Embers ──
    for (const e of embers) {
      e.life += dt;
      const p = e.life / e.maxLife;
      if (p >= 1) { resetEmber(e, W, H); continue; }
      e.gfx.x = e.x0 + e.vx * e.life;
      e.gfx.y = e.y0 + e.vy * e.life + 10 * e.life * e.life;
      const fadeIn  = Math.min(p / 0.2, 1);
      const fadeOut = 1 - Math.max((p - 0.25) / 0.75, 0);
      e.gfx.alpha = 0.9 * fadeIn * fadeOut;
    }

    // ── Wolf glow pulse (per-wolf phase offset for organic feel) ──
    for (const [, entry] of scene.wolfMap) {
      if (entry.currentState === 'walk') {
        entry.glowSprite.alpha = 0.28 + Math.sin(t * 2.2 + entry.id * 1.7) * 0.14;
      }
    }

    // ── Screen shake ──
    if (scene.shake.remaining > 0) {
      const p = scene.shake.remaining / 0.18;
      app.stage.x = Math.sin(t * 44) * scene.shake.amplitude * p;
      app.stage.y = Math.cos(t * 44) * scene.shake.amplitude * 0.5 * p;
      scene.shake.remaining -= dt;
      if (scene.shake.remaining <= 0) {
        scene.shake.remaining = 0;
        app.stage.x = 0;
        app.stage.y = 0;
      }
    }

    // ── Hit effects (particles + popup) ──
    for (let i = scene.hitEffects.length - 1; i >= 0; i--) {
      const ef = scene.hitEffects[i]!;
      ef.life += dt;
      const p = ef.life / ef.maxLife;
      if (p >= 1) {
        for (const part of ef.particles) scene.effectsLayer.removeChild(part.gfx);
        scene.effectsLayer.removeChild(ef.popup);
        scene.hitEffects.splice(i, 1);
        continue;
      }
      for (const part of ef.particles) {
        part.gfx.x += part.vx * dt;
        part.gfx.y += part.vy * dt + 180 * ef.life * ef.life;
        part.gfx.alpha = 1 - p;
        part.gfx.scale.set(1 - p * 0.6);
      }
      ef.popup.y -= 32 * dt;
      ef.popup.alpha = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
    }

    // ── Mascot container position ──
    const st = scene.mascotStateTimer;
    const mc = scene.mascotContainer;

    // On end screens, shift mascot upward to sit above the bottom card overlay
    const isEndState = ms === 'victory' || ms === 'defeat';
    const baseY = isEndState ? H * 0.36 : cy;

    if (ms === 'idle') {
      mc.x = cx;
      mc.y = baseY + Math.sin(t * 1.8) * 5;
      mc.rotation = 0;
      mc.scale.set(1);
    } else if (ms === 'fear') {
      mc.x = cx;
      mc.y = baseY;
      mc.rotation = 0;
      mc.scale.set(1);
    } else if (ms === 'hit') {
      const decay = Math.max(0, 1 - st * 4);
      mc.x = cx + Math.sin(st * 38) * 6 * decay;
      mc.y = baseY;
      mc.scale.set(1 + decay * 0.05);
      mc.rotation = 0;
    } else if (ms === 'victory') {
      mc.x = cx;
      mc.y = baseY - Math.abs(Math.sin(t * 5)) * 10;
      mc.scale.set(1);
      mc.rotation = 0;
    } else { // defeat
      mc.x = cx;
      mc.y = baseY;
      mc.scale.set(1);
      mc.rotation = 0;
    }

    // Warm glow follows mascot on end screens
    glowSprite.x = cx;
    glowSprite.y = isEndState ? mc.y : cy;
  });
}

// ─── Scene init ───────────────────────────────────────────────────────────────
async function buildScene(
  el: HTMLDivElement,
  onHit: (id: number) => void,
): Promise<Scene> {
  const app = new Application();
  await app.init({
    resizeTo: el,
    resolution: Math.min(window.devicePixelRatio, 2),
    backgroundColor: C.bgEdge,
    antialias: false,
    powerPreference: 'low-power',
  });
  Object.assign(app.canvas.style, {
    position: 'absolute', inset: '0',
    width: '100%', height: '100%', touchAction: 'manipulation',
  });
  el.appendChild(app.canvas);

  const W = app.screen.width, H = app.screen.height;
  const s = Math.min(W, H);

  // Background
  app.stage.addChild(new Sprite(buildBgTexture(W, H)));
  const trees = new Graphics(); drawTrees(trees, W, H);
  app.stage.addChild(trees);

  // Warm glow (position updated by ticker on end screens)
  const glowTex = buildGlowTexture(s * 0.40);
  const glowSprite = new Sprite(glowTex);
  glowSprite.anchor.set(0.5);
  glowSprite.x = W/2; glowSprite.y = H/2;
  (glowSprite as Sprite & { blendMode: string }).blendMode = 'add';
  glowSprite.alpha = 0.50;
  app.stage.addChild(glowSprite);

  // Embers
  const embersLayer = new Container();
  app.stage.addChild(embersLayer);
  const embers: Ember[] = Array.from({ length: 14 }, (_, i) => {
    const e = makeEmber(embersLayer, W, H);
    e.life = (i / 14) * e.maxLife;
    return e;
  });

  // Mascot container
  const mascotContainer = new Container();
  mascotContainer.x = W/2; mascotContainer.y = H/2;
  app.stage.addChild(mascotContainer);

  // Wolves container
  const wolvesContainer = new Container();
  app.stage.addChild(wolvesContainer);

  // Effects layer (particles, +1 popups) — topmost
  const effectsLayer = new Container();
  app.stage.addChild(effectsLayer);

  // Shared menace glow texture for wolves (one canvas, many sprites)
  const menaceGlowTex = buildMenaceGlowTexture(64);

  const scene: Scene = {
    app, glowSprite, mascotContainer,
    mascotSprite: null, mascotState: 'idle', mascotStateTimer: 0,
    wolvesContainer, wolfMap: new Map(),
    embers, embersLayer,
    effectsLayer, hitEffects: [],
    shake: { remaining: 0, amplitude: 5 },
    menaceGlowTex,
    time: 0,
    spriteFrames: null, onHit,
  };

  installTicker(scene);

  // Load atlases non-blocking — sprites swap in once ready
  Assets.load(['/assets/mascot@2x.json', '/assets/wolves@2x.json']).then(() => {
    const sf: SpriteFrames = {
      mascot: {
        idle:    getFrames('mascot_idle'),
        fear:    getFrames('mascot_fear'),
        hit:     getFrames('mascot_hit'),
        victory: getFrames('mascot_victory'),
        defeat:  getFrames('mascot_defeat'),
      },
      wolfWalk:  getFrames('wolf_walk'),
      wolfDying: getFrames('wolf_dying'),
    };
    scene.spriteFrames = sf;

    const mascotScale = (s * 0.23) / 384;
    const ms = makeAnimSprite('mascot_idle');
    ms.scale.set(mascotScale);
    ms.play();
    mascotContainer.addChild(ms);
    scene.mascotSprite = ms;

    for (const [, entry] of scene.wolfMap) {
      swapWolfSprite(entry, sf, Math.min(W, H));
    }
  });

  return scene;
}

function swapWolfSprite(entry: WolfEntry, sf: SpriteFrames, scale: number): void {
  const wolfR = scale * 0.082;
  const frames = entry.currentState === 'walk' ? sf.wolfWalk : sf.wolfDying;
  const newSprite = new AnimatedSprite(frames);
  newSprite.anchor.set(0.5, 0.6);
  newSprite.scale.set((wolfR * 2.2) / 192);
  newSprite.animationSpeed = (entry.currentState === 'walk'
    ? (ANIM_FPS['wolf_walk'] ?? 10)
    : (ANIM_FPS['wolf_dying'] ?? 12)) / 60;
  newSprite.loop = entry.currentState === 'walk';
  newSprite.play();
  // Glow is always at index 0; remove everything after it
  while (entry.container.children.length > 1) {
    entry.container.removeChildAt(1);
  }
  entry.container.addChild(newSprite);
  entry.sprite = newSprite;
}

// ─── Per-frame sync ───────────────────────────────────────────────────────────
const KNOCKBACK_DUR = 0.28;

function syncScene(scene: Scene, gs: GameState): void {
  const { app, wolvesContainer, wolfMap, spriteFrames } = scene;
  const W = app.screen.width, H = app.screen.height;
  const s = Math.min(W, H);

  // ── Mascot state ──
  if (gs.mascotState !== scene.mascotState) {
    scene.mascotState = gs.mascotState;
    scene.mascotStateTimer = 0;

    if (scene.mascotSprite && spriteFrames) {
      scene.mascotSprite.textures = spriteFrames.mascot[gs.mascotState];
      scene.mascotSprite.animationSpeed = (ANIM_FPS[`mascot_${gs.mascotState}`] ?? 8) / 60;
      scene.mascotSprite.loop = LOOP[`mascot_${gs.mascotState}`] ?? true;
      scene.mascotSprite.gotoAndPlay(0);
    }
  }

  // ── Wolves ──
  const liveIds = new Set(gs.wolves.map(w => w.id));

  for (const [id, entry] of wolfMap) {
    if (!liveIds.has(id)) {
      wolvesContainer.removeChild(entry.container);
      entry.container.destroy({ children: true });
      wolfMap.delete(id);
    }
  }

  for (const wolf of gs.wolves) {
    let entry = wolfMap.get(wolf.id);

    if (!entry) {
      entry = spriteFrames
        ? buildWolfEntry(wolf, W, H, spriteFrames, scene.menaceGlowTex, scene.onHit)
        : buildPlaceholderWolf(wolf, W, H, s, scene.menaceGlowTex, scene.onHit);
      wolvesContainer.addChild(entry.container);
      wolfMap.set(wolf.id, entry);
    }

    // Walk → dying: trigger hit feedback, swap sprite, kill glow
    if (wolf.state === 'dying' && entry.currentState === 'walk') {
      entry.currentState = 'dying';
      entry.container.eventMode = 'none';
      entry.glowSprite.alpha = 0;

      triggerHitEffect(scene, entry.container.x, entry.container.y);
      triggerShake(scene);

      if (spriteFrames) {
        const dying = new AnimatedSprite(spriteFrames.wolfDying);
        dying.anchor.set(0.5, 0.6);
        dying.scale.set((s * 0.082 * 2.2) / 192);
        dying.animationSpeed = (ANIM_FPS['wolf_dying'] ?? 12) / 60;
        dying.loop = false;
        dying.play();
        while (entry.container.children.length > 1) {
          entry.container.removeChildAt(1);
        }
        entry.container.addChild(dying);
        entry.sprite = dying;
      }
    }

    // Position & opacity
    const prog = wolf.state === 'dying' ? Math.min(wolf.dyingFor / KNOCKBACK_DUR, 1) : 0;
    entry.container.x = pct(wolf.x + wolf.knockX * prog, W);
    entry.container.y = pct(wolf.y + wolf.knockY * prog, H);
    entry.container.alpha = wolf.state === 'dying' ? 1 - prog : 1;
    if (wolf.state !== 'dying') entry.container.eventMode = 'static';
  }

  // Mascot scale responsive to canvas size (handles orientation change)
  if (scene.mascotSprite) {
    scene.mascotSprite.scale.set((s * 0.23) / 384);
  }
}

// Placeholder wolf (Graphics) shown while atlas loads
function buildPlaceholderWolf(
  wolf: Wolf, W: number, H: number, scale: number,
  menaceGlowTex: Texture,
  onHit: (id: number) => void,
): WolfEntry {
  const wr = scale * 0.082;
  const gfx = new Graphics();
  gfx.ellipse(0, wr*0.08, wr, wr*0.91).fill(0x4a4550);
  for (const [ex, rot] of [[-wr*0.37,-0.35],[wr*0.37,0.35]] as [number,number][]) {
    const e = new Graphics();
    e.ellipse(ex, -wr*0.68, wr*0.30, wr*0.52).fill(0x4a4550);
    e.rotation = rot;
    gfx.addChild(e);
  }
  for (const ex of [-wr*0.32, wr*0.32]) {
    const e = new Graphics();
    e.circle(ex, -wr*0.08, wr*0.165).fill(0xd4534c);
    gfx.addChild(e);
  }
  const cnt = new Container();
  cnt.eventMode = 'static';
  cnt.hitArea = new Circle(0, 0, wr*1.25);
  cnt.cursor = 'pointer';
  cnt.on('pointerdown', (e) => { e.stopPropagation(); onHit(wolf.id); });

  // Glow at index 0 (behind the wolf body graphic)
  const glowSprite = buildWolfGlow(wr, menaceGlowTex);
  cnt.addChild(glowSprite);
  cnt.addChild(gfx);

  const prog = wolf.state === 'dying' ? Math.min(wolf.dyingFor / KNOCKBACK_DUR, 1) : 0;
  cnt.x = pct(wolf.x + wolf.knockX * prog, W);
  cnt.y = pct(wolf.y + wolf.knockY * prog, H);
  cnt.alpha = wolf.state === 'dying' ? 1-prog : 1;

  return { id: wolf.id, container: cnt, sprite: null, glowSprite, currentState: 'walk' };
}

// ─── React component ──────────────────────────────────────────────────────────
interface PixiFieldProps {
  state: GameState;
  onHit: (id: number) => void;
}

export function PixiField({ state, onHit }: PixiFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef     = useRef<Scene | null>(null);
  const onHitRef     = useRef(onHit);
  onHitRef.current   = onHit;

  useEffect(() => {
    const el = containerRef.current!;
    let dead = false, scene: Scene | null = null;
    buildScene(el, (id) => onHitRef.current(id)).then(s => {
      if (dead) { s.app.destroy(true); return; }
      sceneRef.current = scene = s;
    });
    return () => {
      dead = true;
      if (scene) { scene.app.destroy(true); sceneRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (sceneRef.current) syncScene(sceneRef.current, state);
  });

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
}
