export interface BusinessConfig {
  rewardEnabled: boolean;
  rewardText: string;
  reviewCallToAction: string;
  pleadingText: string;
  /** Google Maps / Google Business review URL for this client. */
  reviewUrl: string;
}

// In production: populate from the NFC tag payload or a Supabase edge function.
// Toggle rewardEnabled to false to skip the reward section entirely.
export const businessConfig: BusinessConfig = {
  rewardEnabled: true,
  rewardText: '-5% off your next visit',
  reviewCallToAction: 'Tell them Tapko sent you!',
  pleadingText: 'Please leave us a review!',
  // ← Replace with the client's Google Business review link
  reviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
};
