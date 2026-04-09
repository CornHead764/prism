import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isConnecting = false;
/** Timestamp (ms) when we gave up on connecting. null = not in failed state. */
let connectionFailedAt: number | null = null;
/** How long to wait before retrying after a connection failure (ms). */
const RECONNECT_RETRY_INTERVAL = 60_000;

/**
 * Shared Redis connection factory. Used by both cache and session modules
 * to avoid maintaining independent connection pools.
 *
 * After a failure, retries automatically every 60 seconds so a transient Redis
 * restart does not permanently degrade the app until a container restart.
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (connectionFailedAt !== null) {
    if (Date.now() - connectionFailedAt < RECONNECT_RETRY_INTERVAL) {
      return null;
    }
    // Retry window elapsed — reset and attempt reconnection
    console.info('Redis retry interval elapsed, attempting reconnection...');
    connectionFailedAt = null;
    redisClient = null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return redisClient?.isOpen ? redisClient : null;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL not configured');
    connectionFailedAt = Date.now();
    return null;
  }

  try {
    isConnecting = true;

    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            console.warn('Redis connection failed after 3 retries');
            connectionFailedAt = Date.now();
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 1000);
        },
      },
    });

    redisClient.on('error', (err: Error) => {
      console.error('Redis error:', err.message);
    });

    await redisClient.connect();
    isConnecting = false;

    return redisClient;
  } catch (error) {
    console.warn('Failed to connect to Redis:', error instanceof Error ? error.message : 'Unknown error');
    isConnecting = false;
    connectionFailedAt = Date.now();
    return null;
  }
}
