export interface BusinessConfig {
  rewardEnabled: boolean;
  rewardText: string;
  reviewCallToAction: string;
  pleadingText: string;
}

// In production: populate from the NFC tag payload or a Supabase edge function.
// Toggle rewardEnabled to false to skip the reward section entirely.
export const businessConfig: BusinessConfig = {
  rewardEnabled: true,
  rewardText: '-5% off your next visit',
  reviewCallToAction: 'Tell them Tapko sent you!',
  pleadingText: 'Please leave us a review!',
};
