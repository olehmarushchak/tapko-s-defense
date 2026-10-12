import { useEffect, useState } from 'react';
import { PleadingMascot } from './PleadingMascot';

interface RewardScreenProps {
  rewardEnabled: boolean;
  rewardText: string;
  reviewCallToAction: string;
  pleadingText: string;
  onReviewClick: () => void;
  onPlayAgain: () => void;
}

export function RewardScreen({
  rewardEnabled,
  rewardText,
  reviewCallToAction,
  pleadingText,
  onReviewClick,
  onPlayAgain,
}: RewardScreenProps) {
  const [reviewVisible, setReviewVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReviewVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="tapko-end-card">
      {/* Mascot is absolutely positioned directly in the card so it never
          participates in the flex layout — no squeezing, no layout collision */}
      {reviewVisible && <PleadingMascot pleadingText={pleadingText} />}

      <h2 className="tapko-title">We did it! 🎉</h2>

      {rewardEnabled && (
        <div className="tapko-reward">
          <div>Your bonus is ready — show this at the counter</div>
          <div className="tapko-code">{rewardText}</div>
        </div>
      )}

      <div className="tapko-review-zone">
        <div className={`tapko-review-cta${reviewVisible ? ' tapko-review-cta--visible' : ''}`}>
          <button type="button" className="tapko-btn tapko-btn--review" onClick={onReviewClick}>
            <span aria-hidden="true">⭐</span> {reviewCallToAction}
          </button>
          <p className="tapko-optional">Totally optional — your bonus is already yours</p>
        </div>
      </div>

      <div className="tapko-divider" />

      <button type="button" className="tapko-btn tapko-btn--ghost" onClick={onPlayAgain}>
        Play again
      </button>
    </div>
  );
}
