interface RewardScreenProps {
  code: string;
  onReviewClick: () => void;
  onPlayAgain: () => void;
}

export function RewardScreen({ code, onReviewClick, onPlayAgain }: RewardScreenProps) {
  return (
    <div className="tapko-panel">
      <h2 className="tapko-title">We did it!</h2>
      <div className="tapko-reward">
        <div>Your bonus is ready — show this at the counter</div>
        <div className="tapko-code">{code}</div>
      </div>
      <button type="button" className="tapko-btn" onClick={onPlayAgain}>
        Play again
      </button>
      <div className="tapko-divider" />
      <p className="tapko-optional">Totally optional — your bonus is already yours</p>
      <button type="button" className="tapko-btn tapko-btn--ghost" onClick={onReviewClick}>
        Leave a review
      </button>
    </div>
  );
}
