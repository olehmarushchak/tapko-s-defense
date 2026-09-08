import type { Wolf } from "@/lib/gameEngine";

interface WolfViewProps {
  wolf: Wolf;
  onHit: (id: number) => void;
}

export function WolfView({ wolf, onHit }: WolfViewProps) {
  const x = wolf.x + (wolf.state === "dying" ? wolf.knockX : 0);
  const y = wolf.y + (wolf.state === "dying" ? wolf.knockY : 0);

  return (
    <button
      type="button"
      aria-label="Wolf"
      className={`tapko-wolf tapko-wolf--${wolf.state}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onPointerDown={(e) => {
        e.preventDefault();
        onHit(wolf.id);
      }}
    >
      <span className="tapko-wolf-ear left" />
      <span className="tapko-wolf-ear right" />
      <span className="tapko-wolf-eye left" />
      <span className="tapko-wolf-eye right" />
    </button>
  );
}
