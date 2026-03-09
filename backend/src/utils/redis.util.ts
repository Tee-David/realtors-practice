import Redis from "ioredis";
import { config } from "dotenv";

config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

class RedisClientClass {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on("connect", () => {
        this.isConnected = true;
      });

      this.client.on("error", (err) => {
        this.isConnected = false;
        console.error("Redis Connection Error:", err.message);
      });
    } catch (err) {
      console.error("Failed to initialize Redis client:", err);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      console.error(`Redis GET error for key ${key}:`, err);
      return null;
    }
  }

  async set(key: string, value: string, expireSeconds?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      if (expireSeconds) {
        await this.client.setex(key, expireSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      console.error(`Redis SET error for key ${key}:`, err);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      console.error(`Redis DEL error for key ${key}:`, err);
    }
  }
}

export const RedisClient = new RedisClientClass();
