import { MASCOT_MAX_HP } from "@/lib/gameEngine";

interface HudProps {
  levelLabel: string;
  hp: number;
  timeLeft: number;
  showHint: boolean;
}

export function Hud({ levelLabel, hp, timeLeft, showHint }: HudProps) {
  return (
    <div className="tapko-hud">
      <div className="tapko-hud-top">
        <span className="tapko-badge">{levelLabel}</span>
        <span className="tapko-hearts" aria-label={`${hp} of ${MASCOT_MAX_HP} hearts left`}>
          {Array.from({ length: MASCOT_MAX_HP }).map((_, i) => (
            <span
              key={i}
              className={`tapko-heart${i < hp ? "" : " tapko-heart--empty"}`}
              aria-hidden="true"
            />
          ))}
        </span>
      </div>
      <div className="tapko-timer">{Math.ceil(timeLeft)}s</div>
      {showHint ? <div className="tapko-hint">Tap the wolves to fight them off</div> : null}
    </div>
  );
}
