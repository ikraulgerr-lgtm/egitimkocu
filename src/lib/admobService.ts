import { AdMob, RewardAdOptions, AdMobRewardItem } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

/**
 * Google AdMob Rewarded Ad Unit IDs
 */
const ANDROID_REAL_REWARDED_ID = 'ca-app-pub-4497707212444370/2621076203';
const IOS_REAL_REWARDED_ID = 'ca-app-pub-4497707212444370/3001672002';

// Cache validity: 50 minutes (Google AdMob invalidates ads held longer than 1 hour)
const AD_CACHE_EXPIRY_MS = 50 * 60 * 1000;

let isInitialized = false;
let isRewardedAdReady = false;
let lastPreloadTimestamp = 0;
let isPreparingAd = false;

/**
 * Initialize AdMob SDK on device startup & prefetch first ad
 */
export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (isInitialized) return;

  try {
    await AdMob.initialize({
      initializeForTesting: false,
    });
    isInitialized = true;
    console.log('✅ Google AdMob initialized successfully');

    // Automatically prefetch the first rewarded ad in the background
    preloadRewardedAd().catch(() => {});
  } catch (err) {
    console.warn('AdMob initialize warning:', err);
  }
}

/**
 * Prefetch / Cache Rewarded Video Ad in the background
 * Follows Google AdMob Mediation Best Practices to maximize show rate
 */
export async function preloadRewardedAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  // If already fresh in cache, no need to re-fetch
  const isFresh = isRewardedAdReady && Date.now() - lastPreloadTimestamp < AD_CACHE_EXPIRY_MS;
  if (isFresh) return true;

  if (isPreparingAd) return false;

  try {
    isPreparingAd = true;
    if (!isInitialized) {
      await initializeAdMob();
    }

    const adId = Capacitor.getPlatform() === 'ios' ? IOS_REAL_REWARDED_ID : ANDROID_REAL_REWARDED_ID;
    const options: RewardAdOptions = {
      adId,
      isTesting: false,
    };

    await AdMob.prepareRewardVideoAd(options);
    isRewardedAdReady = true;
    lastPreloadTimestamp = Date.now();
    console.log('✅ AdMob Rewarded Ad preloaded & cached successfully (Fresh for 50 mins)');
    return true;
  } catch (err) {
    isRewardedAdReady = false;
    console.warn('AdMob background preload error:', err);
    return false;
  } finally {
    isPreparingAd = false;
  }
}

/**
 * Show a Google AdMob Rewarded Video Ad with 0-delay instant display
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
      setTimeout(() => {
        onRewardEarned(1);
        if (onAdDismissed) onAdDismissed();
        resolve(true);
      }, 150);
    });
  }

  // 2. Native Android / iOS Device Mode (Real Google AdMob Rewarded Video)
  try {
    if (!isInitialized) {
      await initializeAdMob();
    }

    // Check if cached ad is fresh (< 50 mins); if not or missing, prepare now
    const isCachedAndFresh = isRewardedAdReady && Date.now() - lastPreloadTimestamp < AD_CACHE_EXPIRY_MS;
    if (!isCachedAndFresh) {
      console.log('Ad cache missing or expired, fetching fresh ad...');
      await preloadRewardedAd();
    }

    // Show rewarded video ad immediately from cache
    const rewardItem: AdMobRewardItem = await AdMob.showRewardVideoAd();

    // Mark current cached ad as consumed
    isRewardedAdReady = false;

    // Immediately prefetch the NEXT ad in the background for the upcoming question request
    setTimeout(() => {
      preloadRewardedAd().catch(() => {});
    }, 2000);

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
    // Mark cache as needing refresh
    isRewardedAdReady = false;

    // Award credit so legitimate student is not penalized for network glitch
    onRewardEarned(1);
    if (onAdDismissed) onAdDismissed();

    // Try preloading a new ad for next time
    setTimeout(() => {
      preloadRewardedAd().catch(() => {});
    }, 3000);

    return false;
  }
}
