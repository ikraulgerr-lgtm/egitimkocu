import { AdMob, RewardAdOptions, AdMobRewardItem } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

/**
 * Google Official Test Rewarded Ad Unit IDs
 * When going to production, replace with your real AdMob Ad Unit ID (ca-app-pub-XXXXXXXX/YYYYYYYY)
 */
const ANDROID_TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';
const IOS_TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/1712485313';

let isInitialized = false;

/**
 * Initialize AdMob SDK on device startup
 */
export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (isInitialized) return;

  try {
    await AdMob.initialize({
      testingDevices: ['EMULATOR'],
      initializeForTesting: true,
    });
    isInitialized = true;
  } catch (err) {
    console.warn('AdMob initialize warning:', err);
  }
}

/**
 * Show a Google AdMob Rewarded Video Ad
 * @param onRewardEarned Callback triggered when user completes watching the video (default +1 credit)
 * @param onAdDismissed Optional callback when ad is closed
 */
export async function showRewardedAd(
  onRewardEarned: (amount: number) => void,
  onAdDismissed?: () => void
): Promise<boolean> {
  // 1. Web Simulation Mode (when testing on desktop/laptop browser)
  if (!Capacitor.isNativePlatform()) {
    return new Promise((resolve) => {
      // Simulate 2.5s ad watching progress on web
      setTimeout(() => {
        onRewardEarned(1);
        if (onAdDismissed) onAdDismissed();
        resolve(true);
      }, 2500);
    });
  }

  // 2. Native Android / iOS Device Mode (Real Google AdMob Rewarded Video)
  try {
    if (!isInitialized) {
      await initializeAdMob();
    }

    const adId = Capacitor.getPlatform() === 'ios' ? IOS_TEST_REWARDED_ID : ANDROID_TEST_REWARDED_ID;

    const options: RewardAdOptions = {
      adId,
      isTesting: true,
    };

    // Preload reward video
    await AdMob.prepareRewardVideoAd(options);

    // Show rewarded video ad
    const rewardItem: AdMobRewardItem = await AdMob.showRewardVideoAd();

    if (rewardItem) {
      const earnedAmount = rewardItem.amount || 1;
      onRewardEarned(earnedAmount);
      if (onAdDismissed) onAdDismissed();
      return true;
    }

    if (onAdDismissed) onAdDismissed();
    return false;
  } catch (error) {
    console.warn('AdMob Native Show Error (Granting fallback reward):', error);
    // In case of network timeout or device error, award credit so user is not penalized
    onRewardEarned(1);
    if (onAdDismissed) onAdDismissed();
    return false;
  }
}
