import {Queue} from 'bullmq';
import { redisConnection } from '../config/redis.config.js';

export const videoQueue = new Queue('video-processing-queue', { 
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {type: 'exponential', delay: 200},
        removeOnComplete: true,
    },
});
