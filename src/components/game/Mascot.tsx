import type { MascotState } from "@/lib/gameEngine";

interface MascotProps {
  state: MascotState;
  bubble: string | null;
}

export function Mascot({ state, bubble }: MascotProps) {
  return (
    <div className="tapko-mascot-wrap">
      <div className="tapko-glow" aria-hidden="true" />
      {bubble ? <div className="tapko-bubble">{bubble}</div> : null}
      <div
        className={`tapko-mascot tapko-mascot--${state}`}
        role="img"
        aria-label={`Tapko is ${state}`}
      >
        <span className="tapko-ear left" />
        <span className="tapko-ear right" />
        <span className="tapko-eye left" />
        <span className="tapko-eye right" />
        <span className="tapko-snout" />
      </div>
    </div>
  );
}
