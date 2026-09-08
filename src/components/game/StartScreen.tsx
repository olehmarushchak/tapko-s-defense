import type { LevelId } from "@/lib/gameEngine";

interface StartScreenProps {
  onStart: (level: LevelId) => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="tapko-panel">
      <h1 className="tapko-title">Protect Tapko</h1>
      <p className="tapko-sub">
        Wolves are closing in on your little dog-dragon friend. Tap them away and keep him safe
        until the round ends.
      </p>
      <button type="button" className="tapko-btn" onClick={() => onStart("easy")}>
        Start · Easy
      </button>
      <button
        type="button"
        className="tapko-btn tapko-btn--ghost"
        onClick={() => onStart("hard")}
      >
        Start · Hard
      </button>
    </div>
  );
}
