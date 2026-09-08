/**
 * Pure game-state module. No DOM, no React, no CSS.
 * Coordinates are percentages of the playfield (0-100). Center is (50, 50).
 */

export type LevelId = "easy" | "hard";
export type GameStatus = "idle" | "playing" | "won" | "lost";
export type WolfState = "walking" | "dying";
export type MascotState = "idle" | "fear" | "hit" | "victory" | "defeat";

export interface Wolf {
  id: number;
  x: number;
  y: number;
  speed: number;
  state: WolfState;
  dyingFor: number;
  knockX: number;
  knockY: number;
}

export interface GameEvent {
  name: string;
  payload: Record<string, unknown>;
}

export interface GameState {
  mascotHP: number;
  wolves: Wolf[];
  level: LevelId;
  status: GameStatus;
  timeLeft: number;
  mascotState: MascotState;
  bubble: string | null;
  bubbleFor: number;
  stateFor: number;
  spawnTimer: number;
  nextId: number;
  score: number;
  events: GameEvent[];
}

export interface LevelConfig {
  label: string;
  duration: number;
  spawnInterval: number;
  speedMin: number;
  speedMax: number;
  maxWolves: number;
}

export const LEVELS: Record<LevelId, LevelConfig> = {
  easy: {
    label: "Level 1 · Easy",
    duration: 18,
    spawnInterval: 1.5,
    speedMin: 6,
    speedMax: 9,
    maxWolves: 3,
  },
  hard: {
    label: "Level 2 · Hard",
    duration: 35,
    spawnInterval: 0.8,
    speedMin: 11,
    speedMax: 16,
    maxWolves: 6,
  },
};

const LINES: Record<"fear" | "hit" | "victory" | "defeat", string[]> = {
  fear: ["Uh-oh!", "Watch out!"],
  hit: ["Ouch!", "That hurt..."],
  victory: ["We did it!", "You're my hero!"],
  defeat: ["Oh no..."],
};

const MAX_HP = 3;
const HIT_RADIUS = 11;
const FEAR_RADIUS = 24;
const KNOCKBACK_TIME = 0.28;

function pickLine(kind: keyof typeof LINES): string {
  const options = LINES[kind];
  return options[Math.floor(Math.random() * options.length)] ?? options[0]!;
}

export function startGame(level: LevelId): GameState {
  return {
    mascotHP: MAX_HP,
    wolves: [],
    level,
    status: "playing",
    timeLeft: LEVELS[level].duration,
    mascotState: "idle",
    bubble: null,
    bubbleFor: 0,
    stateFor: 0,
    spawnTimer: 0.6,
    nextId: 1,
    score: 0,
    events: [{ name: "game_started", payload: { level } }],
  };
}

export function initialState(level: LevelId = "easy"): GameState {
  return { ...startGame(level), status: "idle", events: [] };
}

function spawnWolf(state: GameState): Wolf {
  const cfg = LEVELS[state.level];
  const edge = Math.floor(Math.random() * 4);
  const t = 8 + Math.random() * 84;
  let x = 50;
  let y = 50;
  if (edge === 0) {
    x = t;
    y = -6;
  } else if (edge === 1) {
    x = 106;
    y = t;
  } else if (edge === 2) {
    x = t;
    y = 106;
  } else {
    x = -6;
    y = t;
  }
  return {
    id: state.nextId,
    x,
    y,
    speed: cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin),
    state: "walking",
    dyingFor: 0,
    knockX: 0,
    knockY: 0,
  };
}

function setMascot(state: GameState, next: MascotState, line: string | null): void {
  state.mascotState = next;
  state.stateFor = 0;
  if (line) {
    state.bubble = line;
    state.bubbleFor = 0;
  }
}

/** Advances the game by deltaTime seconds and returns a NEW state object. */
export function tick(prev: GameState, deltaTime: number): GameState {
  if (prev.status !== "playing") return prev;
  const dt = Math.min(Math.max(deltaTime, 0), 0.1);
  const cfg = LEVELS[prev.level];

  const state: GameState = {
    ...prev,
    wolves: prev.wolves.map((w) => ({ ...w })),
    events: [],
  };

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  state.stateFor += dt;
  state.bubbleFor += dt;
  if (state.bubble && state.bubbleFor > 1.4) state.bubble = null;

  // spawning
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const alive = state.wolves.filter((w) => w.state === "walking").length;
    if (alive < cfg.maxWolves && state.timeLeft > 1) {
      state.wolves.push(spawnWolf(state));
      state.nextId += 1;
    }
    state.spawnTimer = cfg.spawnInterval * (0.75 + Math.random() * 0.5);
  }

  let damaged = 0;
  let nearest = Infinity;
  const remaining: Wolf[] = [];

  for (const wolf of state.wolves) {
    if (wolf.state === "dying") {
      wolf.dyingFor += dt;
      if (wolf.dyingFor < KNOCKBACK_TIME) remaining.push(wolf);
      continue;
    }
    const dx = 50 - wolf.x;
    const dy = 50 - wolf.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist <= HIT_RADIUS) {
      damaged += 1;
      continue;
    }
    wolf.x += (dx / dist) * wolf.speed * dt;
    wolf.y += (dy / dist) * wolf.speed * dt;
    nearest = Math.min(nearest, dist);
    remaining.push(wolf);
  }
  state.wolves = remaining;

  if (damaged > 0) {
    state.mascotHP = Math.max(0, state.mascotHP - damaged);
    setMascot(state, "hit", pickLine("hit"));
    state.events.push({
      name: "mascot_damaged",
      payload: { hp: state.mascotHP, level: state.level },
    });
  } else if (state.mascotState === "hit" && state.stateFor < 0.5) {
    // keep hit state briefly
  } else if (nearest <= FEAR_RADIUS) {
    if (state.mascotState !== "fear") setMascot(state, "fear", pickLine("fear"));
  } else if (state.mascotState !== "idle") {
    setMascot(state, "idle", null);
  }

  if (state.mascotHP <= 0) {
    state.status = "lost";
    state.wolves = [];
    setMascot(state, "defeat", pickLine("defeat"));
    state.events.push({ name: "game_lost", payload: { level: state.level, score: state.score } });
  } else if (state.timeLeft <= 0) {
    state.status = "won";
    state.wolves = [];
    setMascot(state, "victory", pickLine("victory"));
    state.events.push({ name: "game_won", payload: { level: state.level, score: state.score } });
  }

  return state;
}

/** Marks a wolf as knocked back; it disappears shortly after. */
export function hitWolf(prev: GameState, wolfId: number): GameState {
  if (prev.status !== "playing") return prev;
  const target = prev.wolves.find((w) => w.id === wolfId && w.state === "walking");
  if (!target) return prev;

  const dx = target.x - 50;
  const dy = target.y - 50;
  const dist = Math.hypot(dx, dy) || 1;

  return {
    ...prev,
    score: prev.score + 1,
    wolves: prev.wolves.map((w) =>
      w.id === wolfId
        ? {
            ...w,
            state: "dying" as WolfState,
            dyingFor: 0,
            knockX: (dx / dist) * 9,
            knockY: (dy / dist) * 9,
          }
        : w,
    ),
    events: [{ name: "wolf_hit", payload: { wolfId, level: prev.level, score: prev.score + 1 } }],
  };
}

export const MASCOT_MAX_HP = MAX_HP;
