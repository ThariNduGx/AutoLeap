import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function lockSlot(
  businessId: string,
  date: string,
  time: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const key = `slot:${businessId}:${date}:${time}`;
  
  try {
    const result = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
    const success = result === 'OK';
    
    if (success) {
      console.log(`[REDIS] 🔒 Slot locked: ${date} ${time}`);
    }
    return success;
  } catch (error) {
    console.error('[REDIS] Lock failed:', error);
    return false;
  }
}

export async function isSlotLocked(
  businessId: string,
  date: string,
  time: string
): Promise<boolean> {
  const key = `slot:${businessId}:${date}:${time}`;
  
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('[REDIS] Check failed:', error);
    return false;
  }
}

export async function unlockSlot(
  businessId: string,
  date: string,
  time: string
): Promise<void> {
  const key = `slot:${businessId}:${date}:${time}`;
  
  try {
    await redis.del(key);
    console.log(`[REDIS] 🔓 Slot unlocked: ${date} ${time}`);
  } catch (error) {
    console.error('[REDIS] Unlock failed:', error);
  }
}