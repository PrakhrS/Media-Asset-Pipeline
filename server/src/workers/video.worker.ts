import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'bullmq';

import { redisConnection } from '../config/redis.config.js';
import { pool } from '../db/db.js';
import { io } from '../index.js';
import { extractScoutFrame, processVideo, extractVideoFrames } from '../services/video.service.js';
import { uploadToCloudinary, uploadMultipleFiles } from '../services/cloudinary.service.js';
import { getSubjectCoordinates, generateMarketingMetadata } from '../services/ai.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolves to server/ root (2 levels up from src/workers/)
const SERVER_ROOT = path.join(__dirname, '../../');

export const initVideoWorker = () => {
    const worker = new Worker(
        'video-processing-queue',
        async (job) => {
            const { videoId } = job.data as { videoId: string };

            // Paths that need cleanup in the finally block
            let inputPath = '';
            let scoutFramePath = '';
            let outputPath = '';
            let framePaths: string[] = [];

            try {
                // ─────────────────────────────────────────────────────────────
                // STEP 1 — Mark as processing in DB
                // ─────────────────────────────────────────────────────────────
                await pool.query(
                    `UPDATE videos SET processing_status = 'processing' WHERE id = $1`,
                    [videoId]
                );
                console.log(`[Worker] Job ${job.id} | videoId: ${videoId} | Status → processing`);

                // ─────────────────────────────────────────────────────────────
                // STEP 2 — Socket Emit @ 15%
                // ─────────────────────────────────────────────────────────────
                io.emit('pipeline-update', {
                    status: 'processing',
                    progress: 15,
                    message: 'Scouting spatial coordinates...',
                });

                // ─────────────────────────────────────────────────────────────
                // STEP 3 — Scout Extract & AI Coordinate Analysis
                // ─────────────────────────────────────────────────────────────
                const dbResult = await pool.query(
                    `SELECT local_filepath FROM videos WHERE id = $1`,
                    [videoId]
                );

                const relativePath = dbResult.rows[0]?.local_filepath as string;
                inputPath = path.join(SERVER_ROOT, relativePath);

                const processedDir = path.join(SERVER_ROOT, 'uploads/processed');
                fs.mkdirSync(processedDir, { recursive: true });

                const outputFilename = `processed-${Date.now()}.mp4`;
                outputPath = path.join(processedDir, outputFilename);

                let centerX = 50;

                try {
                    console.log(`[Worker] Job ${job.id} | Extracting scout frame...`);
                    scoutFramePath = await extractScoutFrame(inputPath, processedDir);

                    console.log(`[Worker] Job ${job.id} | Uploading scout frame to Cloudinary...`);
                    // uploadMultipleFiles uses default resource_type:'image' — correct for JPEG scout frames.
                    // uploadToCloudinary hardcodes resource_type:'video' which rejects JPEGs.
                    // Note: uploadMultipleFiles does NOT auto-delete local files, so scoutFramePath
                    // remains live for the janitor to clean up in the finally block.
                    const scoutUrls = await uploadMultipleFiles([scoutFramePath]);
                    const scoutCloudinaryUrl = scoutUrls[0];
                    if (!scoutCloudinaryUrl) throw new Error('Scout frame Cloudinary upload returned no URL.');

                    console.log(`[Worker] Job ${job.id} | Fetching subject coordinates from AI...`);
                    const aiCoords = await getSubjectCoordinates(scoutCloudinaryUrl);
                    centerX = aiCoords.centerX;
                } catch (scoutError) {
                    console.error(
                        `[Worker] Job ${job.id} | Scouting phase failed, defaulting to center crop (50):`,
                        scoutError
                    );
                    centerX = 50;
                }

                // ─────────────────────────────────────────────────────────────
                // STEP 4 — Socket Emit @ 35%
                // ─────────────────────────────────────────────────────────────
                io.emit('pipeline-update', {
                    status: 'scouting',
                    progress: 35,
                    message: `Smart cropping subject at X-axis: ${centerX}%`,
                    data: { centerX },
                });

                // ─────────────────────────────────────────────────────────────
                // STEP 5 — Smart Crop via FFmpeg
                // ─────────────────────────────────────────────────────────────
                console.log(`[Worker] Job ${job.id} | FFmpeg smart crop starting (centerX: ${centerX})...`);
                await processVideo(inputPath, outputPath, centerX);
                console.log(`[Worker] Job ${job.id} | FFmpeg processing complete.`);

                // ─────────────────────────────────────────────────────────────
                // STEP 6 — Socket Emit @ 60%
                // ─────────────────────────────────────────────────────────────
                io.emit('pipeline-update', {
                    status: 'transcoding',
                    progress: 60,
                    message: 'Extracting keyframes and batch uploading...',
                });

                // ─────────────────────────────────────────────────────────────
                // STEP 7 — Extract 3 Keyframes + Batch Upload to Cloudinary
                // ─────────────────────────────────────────────────────────────
                console.log(`[Worker] Job ${job.id} | Extracting 3 keyframes...`);
                framePaths = await extractVideoFrames(outputPath, processedDir);

                console.log(`[Worker] Job ${job.id} | Batch uploading video + frames to Cloudinary...`);
                const [videoUrl, frameUrls] = await Promise.all([
                    uploadToCloudinary(outputPath),
                    uploadMultipleFiles(framePaths),
                ]);
                // uploadToCloudinary deletes outputPath locally — clear ref
                outputPath = '';
                console.log(`[Worker] Job ${job.id} | Cloudinary upload complete. URL: ${videoUrl}`);

                // ─────────────────────────────────────────────────────────────
                // STEP 8 — Socket Emit @ 85%
                // ─────────────────────────────────────────────────────────────
                io.emit('pipeline-update', {
                    status: 'analyzing',
                    progress: 85,
                    message: 'Generating AI metadata...',
                });

                // ─────────────────────────────────────────────────────────────
                // STEP 9 — AI Vision + DB Finalize
                // ─────────────────────────────────────────────────────────────
                console.log(`[Worker] Job ${job.id} | Generating marketing metadata via AI...`);
                const aiMetadata = await generateMarketingMetadata(frameUrls);

                const updateQuery = `
                    UPDATE videos
                    SET cloudinary_url      = $1,
                        processing_status   = 'completed',
                        ai_caption          = $2,
                        ai_tags             = $3
                    WHERE id = $4
                    RETURNING *;
                `;
                const updatedVideo = await pool.query(updateQuery, [
                    videoUrl,
                    aiMetadata.caption,
                    aiMetadata.tags,
                    videoId,
                ]);
                console.log(`[Worker] Job ${job.id} | DB updated — pipeline completed for videoId: ${videoId}`);

                const finalRow = updatedVideo.rows[0];

                // ─────────────────────────────────────────────────────────────
                // STEP 10 — Socket Emit @ 100% — unlock the UI
                // ─────────────────────────────────────────────────────────────
                io.emit('pipeline-update', {
                    status: 'completed',
                    progress: 100,
                    message: 'Pipeline complete!',
                    data: {
                        id: videoId,
                        video_url: videoUrl,
                        ai_caption: aiMetadata.caption,
                        ai_tags: aiMetadata.tags ?? [],
                        ...finalRow,
                    },
                });

            } finally {
                // ─────────────────────────────────────────────────────────────
                // STEP 11 — The Janitor: delete all local temp files
                // Guarded with existsSync because uploadToCloudinary already
                // deletes files internally — double-delete would crash the worker.
                // ─────────────────────────────────────────────────────────────
                try {
                    const candidates = [scoutFramePath, inputPath, outputPath, ...framePaths];
                    for (const filePath of candidates) {
                        if (filePath && fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`[Worker] Janitor deleted: ${filePath}`);
                        }
                    }
                    console.log(`[Worker] Job ${job.id} | Temp file cleanup complete. Disk usage → 0 bytes.`);
                } catch (cleanupError) {
                    // Never let cleanup errors crash the worker or fail the job
                    console.error(`[Worker] Job ${job.id} | Non-fatal cleanup error:`, cleanupError);
                }
            }
        },
        {
            connection: redisConnection,
            concurrency: 2,
        }
    );

    worker.on('completed', (job) => {
        console.log(`[Worker] ✅ Job ${job.id} completed successfully.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] ❌ Job ${job?.id} failed after all retries:`, err.message);
    });

    console.log('[Worker] Video worker initialized and listening for jobs on "video-processing-queue"...');

    return worker;
};
