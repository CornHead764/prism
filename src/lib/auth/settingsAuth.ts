import { getRedisClient } from '@/lib/cache/getRedisClient';

const SETTINGS_VERIFIED_PREFIX = 'settings_verified:';
const SETTINGS_VERIFIED_TTL = 10 * 60; // 10 minutes

export async function setSettingsVerified(sessionToken: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.setEx(`${SETTINGS_VERIFIED_PREFIX}${sessionToken}`, SETTINGS_VERIFIED_TTL, '1');
  } catch (err) {
    console.error('Failed to set settings verified:', err);
  }
}

export async function isSettingsVerified(sessionToken: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    const value = await redis.get(`${SETTINGS_VERIFIED_PREFIX}${sessionToken}`);
    return value === '1';
  } catch (err) {
    console.error('Failed to check settings verification:', err);
    return false;
  }
}
