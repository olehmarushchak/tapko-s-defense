interface GameOverScreenProps {
  onRetry: () => void;
  onHome: () => void;
}

export function GameOverScreen({ onRetry, onHome }: GameOverScreenProps) {
  return (
    <div className="tapko-panel">
      <h2 className="tapko-title">Oh no...</h2>
      <p className="tapko-sub">The wolves got through this time. Tapko believes in a rematch.</p>
      <button type="button" className="tapko-btn" onClick={onRetry}>
        Try again
      </button>
      <button type="button" className="tapko-btn tapko-btn--ghost" onClick={onHome}>
        Pick a level
      </button>
    </div>
  );
}
