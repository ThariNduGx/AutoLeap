// Create test file: src/scripts/test-redis.ts
import { lockSlot, isSlotLocked, unlockSlot } from '../lib/infrastructure/redis';

async function testRedis() {
  console.log('Testing Redis...');
  
  const testKey = 'test-business-id';
  const testDate = '2025-11-25';
  const testTime = '10:00';
  
  // Test lock
  const locked = await lockSlot(testKey, testDate, testTime, 10);
  console.log('Lock acquired:', locked);
  
  // Test check
  const isLocked = await isSlotLocked(testKey, testDate, testTime);
  console.log('Is locked:', isLocked);
  
  // Test unlock
  await unlockSlot(testKey, testDate, testTime);
  console.log('Unlocked');
  
  // Verify unlock
  const stillLocked = await isSlotLocked(testKey, testDate, testTime);
  console.log('Still locked:', stillLocked);
}

testRedis();