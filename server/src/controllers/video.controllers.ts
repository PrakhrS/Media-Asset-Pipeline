import type { Request, Response } from "express";

import { pool } from "../db/db.js";
import { videoQueue } from "../queues/video.queue.js";


export const localUpload = async (req: Request, res: Response): Promise<any> => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No video asset was provided." });
        }
        const originalName = req.file.originalname;
        const localPath = req.file.path;

        const result = await pool.query(
            `INSERT INTO videos(original_filename, local_filepath) VALUES($1, $2) RETURNING *;`, [originalName, localPath]
        );

        return res.status(201).json({ message: "Asset uploaded and recorded successfully.", video: result.rows[0] });

    } catch (error) {
        console.error("Controller Error [localUpload]:", error);
        return res.status(500).json({ error: "Internal server error during upload." });
    }
};

export const processVideoAsset = async (req: Request, res: Response): Promise<any> => {
    try {
        const { videoId } = req.body;

        // Validate presence of videoId
        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId in request body.' });
        }

        // Confirm the record exists in the DB
        const result = await pool.query(
            `SELECT id FROM videos WHERE id = $1`,
            [videoId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Video record not found for id: ${videoId}` });
        }

        // Enqueue background job — all pipeline work happens in the Worker
        const job = await videoQueue.add('process-video', { videoId });

        console.log(`[Controller] Job ${job.id} enqueued for videoId: ${videoId}`);

        // Return 202 immediately — client listens on Socket.io for progress
        return res.status(202).json({
            message: 'Video processing job accepted and queued.',
            jobId: job.id,
            videoId,
        });

    } catch (error) {
        console.error('Controller Error [processVideoAsset]:', error);
        return res.status(500).json({ error: 'Internal server error while enqueuing job.' });
    }
};