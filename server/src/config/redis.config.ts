import dotenv from 'dotenv';
import type {ConnectionOptions} from 'bullmq';

dotenv.config();

export const redisConnection: ConnectionOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
};