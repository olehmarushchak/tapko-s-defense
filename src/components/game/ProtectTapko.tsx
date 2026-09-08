import { useCallback, useEffect, useRef, useState } from "react";
import { logEvent } from "@/lib/analytics";
import {
  LEVELS,
  hitWolf,
  initialState,
  startGame,
  tick,
  type GameState,
  type LevelId,
} from "@/lib/gameEngine";
import { Mascot } from "./Mascot";
import { WolfView } from "./WolfView";
import { Hud } from "./Hud";
import { StartScreen } from "./StartScreen";
import { RewardScreen } from "./RewardScreen";
import { GameOverScreen } from "./GameOverScreen";

const REWARD_CODE = "TAPKO-10";

export function ProtectTapko() {
  const [state, setState] = useState<GameState>(() => initialState("easy"));
  const rewardLogged = useRef(false);

  // Drain engine events into the analytics stub.
  useEffect(() => {
    for (const event of state.events) logEvent(event.name, event.payload);
  }, [state]);

  useEffect(() => {
    if (state.status !== "playing") return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setState((prev) => tick(prev, dt));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.status]);

  useEffect(() => {
    if (state.status === "won" && !rewardLogged.current) {
      rewardLogged.current = true;
      logEvent("reward_shown", { code: REWARD_CODE, level: state.level });
    }
  }, [state.status, state.level]);

  const onStart = useCallback((level: LevelId) => {
    rewardLogged.current = false;
    setState(startGame(level));
  }, []);

  const onHit = useCallback((id: number) => {
    setState((prev) => hitWolf(prev, id));
  }, []);

  const cfg = LEVELS[state.level];
  const showHint = state.status === "playing" && cfg.duration - state.timeLeft < 3;

  return (
    <div className="tapko-app">
      <div className="tapko-field">
        <Mascot state={state.mascotState} bubble={state.bubble} />
        {state.wolves.map((wolf) => (
          <WolfView key={wolf.id} wolf={wolf} onHit={onHit} />
        ))}
      </div>

      {state.status === "playing" ? (
        <Hud
          levelLabel={cfg.label}
          hp={state.mascotHP}
          timeLeft={state.timeLeft}
          showHint={showHint}
        />
      ) : null}

      {state.status === "idle" ? <StartScreen onStart={onStart} /> : null}

      {state.status === "won" ? (
        <RewardScreen
          code={REWARD_CODE}
          onPlayAgain={() => onStart(state.level)}
          onReviewClick={() => logEvent("review_link_clicked", { level: state.level })}
        />
      ) : null}

      {state.status === "lost" ? (
        <GameOverScreen
          onRetry={() => onStart(state.level)}
          onHome={() => setState(initialState(state.level))}
        />
      ) : null}
    </div>
  );
}
