import type { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { pool } from "../db/db.js";
import { processVideo } from "../services/video.service.js";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export const processVideoAsset = async (req: Request, res: Response) => {
    const { videoId } = req.body;

    if (!videoId) {
        return res.status(400).json({ error: "Video ID is required" });
    }
    try {
        const fetchQuery = `SELECT * FROM videos WHERE id = $1`;
        const { rows } = await pool.query(fetchQuery, [videoId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Video not found" });
        }
        const videoRecord = rows[0];
        const rawInputPath = videoRecord.local_filepath;

        const absoluteInputPath = path.isAbsolute(rawInputPath)
            ? rawInputPath
            : path.join(__dirname, '../../', rawInputPath);

        if(!fs.existsSync(absoluteInputPath)){
            console.error(`Source file missing at ${absoluteInputPath}`);
            return res.status(400).json({
                error: "Source video file is missing."
            });
        }

        const filename = path.basename(absoluteInputPath);
        const outputPath = path.join(__dirname, '../../uploads/processed', `processed-${filename}`);

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        await pool.query(`UPDATE videos SET processing_status = 'processing' WHERE id=$1`, [videoId]);

        console.log(`Starting FFmpeg processing for video: ${videoId}...`);

        await processVideo(absoluteInputPath, outputPath);

        const relativeOutputPath = path.join('uploads/processed', `processed-${filename}`);

        const updateQuery = `
        UPDATE videos
        SET local_filepath = $1,
        processing_status = 'completed'
        WHERE id = $2
        RETURNING *;
        `;
        const updateResult = await pool.query(updateQuery, [relativeOutputPath, videoId]);

        return res.status(200).json({
            message: "Video processed successfully!",
            video: updateResult.rows[0]
        });
    } catch (error) {
        console.error("Controller Error during video processing:", error);

        await pool.query(`UPDATE videos SET processing_status = 'failed' WHERE id = $1`, [videoId]);

        return res.status(500).json({ error: "Failed to process video" });
    }
};