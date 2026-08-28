import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response } from "express";

import { uploadToCloudinary, uploadMultipleFiles } from '../services/cloudinary.service.js';
import { pool } from "../db/db.js";
import { processVideo, extractVideoFrames, extractScoutFrame } from "../services/video.service.js";
import { generateMarketingMetadata, getSubjectCoordinates } from '../services/ai.service.js';



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
    let inputPath = '';
    let scoutFramePath = '';
    const io = req.app.get('io');

    try {
        // Db lookup
        const { videoId } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId' });
        }

        const result = await pool.query('SELECT local_filepath FROM videos WHERE id = $1', [videoId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video record not found' });
        }

        const relativePath = result.rows[0].local_filepath;
        inputPath = path.join(__dirname, '../../', relativePath);

        if (!fs.existsSync(inputPath)) {
            return res.status(404).json({ error: 'Source video file is missing!!' });
        }

        const processedDir = path.join(__dirname, '../../uploads/processed');
        fs.mkdirSync(processedDir, { recursive: true });

        const outputFilename = `processed-${Date.now()}.mp4`;
        const outputPath = path.join(processedDir, outputFilename);

        let centerX = 50;

        try {
            io.emit('pipeline-update', {
                status: 'scouting',
                progress: 15,
                message: 'Scouting spatial coordinates...'
            });

            console.log('Extracting scout frame...');
            scoutFramePath = await extractScoutFrame(inputPath, processedDir);
            
            console.log('Uploading scout frame to Cloudinary...');
            const scoutCloudinaryUrl = await uploadToCloudinary(scoutFramePath);
            
            console.log('Fetching subject coordinates from AI...');
            const aiCoords = await getSubjectCoordinates(scoutCloudinaryUrl);
            centerX = aiCoords.centerX;

            io.emit('pipeline-update', {
                status: 'scouting',
                progress: 25,
                message: `Smart cropping subject at X-axis: ${centerX}%`
            });
        } catch (scoutError) {
            console.error('Scouting phase failed, defaulting to center crop (50):', scoutError);
            centerX = 50;
        }

        io.emit('pipeline-update', {
            status: 'trascoding',
            progress: 25,
            message: 'Cropping and extracting frames...'
        });

        //FFmpeg processing
        console.log(`FFmpeg Processing Started for video: ${videoId}`);
        await processVideo(inputPath, outputPath, centerX);

        const tempDir = path.dirname(outputPath);
        const framePaths = await extractVideoFrames(outputPath, tempDir);

        console.log('FFmpeg Processing Complete.');

        io.emit('pipeline-update', {
            status: 'uploading',
            progress: 50,
            message: 'Syncing assets to Cloudinary...'
        });


        //Cloudinary Upload
        console.log('Uploading finalized asset to Cloudinary...');
        const cloudinaryUrl = await uploadToCloudinary(outputPath);
        const frameUrls = await uploadMultipleFiles(framePaths);
        console.log(`Cloudinary Upload Complete: ${cloudinaryUrl}`);

        io.emit('pipeline-update', {
            status: 'analyzing',
            progress: 75,
            message: 'Analyzing visual with Gemini...'
        });

        //AI Service and Db Save
        const aiMetadata = await generateMarketingMetadata(frameUrls);
        console.log('AI Analysis Complete.');

        const updateQuery = `
        UPDATE videos
        SET cloudinary_url = $1,
        processing_status = 'completed',
        ai_caption = $2,
        ai_tags = $3
        WHERE id = $4
        RETURNING *;`;

        const updatedVideo = await pool.query(updateQuery, [
            cloudinaryUrl,
            aiMetadata.caption,
            aiMetadata.tags,
            videoId
        ]);

        io.emit('pipeline-update', {
            status: 'completed',
            progress: 100,
            message: 'Pipeline complete!',
            data: {
                id: videoId,
                video_url: cloudinaryUrl,
                ai_caption: aiMetadata.caption,
                ai_tags: aiMetadata.tags || [],
            }
        });

        //Cleanup
        if (inputPath && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        if (scoutFramePath && fs.existsSync(scoutFramePath)) {
            fs.unlinkSync(scoutFramePath);
        }
        if (framePaths.length > 0) {
            framePaths.forEach(frame => fs.unlinkSync(frame));
            console.log('Local stagin files cleaned.');
        }

        res.status(200).json({
            message: 'Video processed and analyzed successfully ',
            status: 'completed',
            data: updatedVideo.rows[0]
        });


    } catch (error) {
        console.error('Pipeline Execution Failed:', error);

        if (inputPath && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
        if (scoutFramePath && fs.existsSync(scoutFramePath)) {
            fs.unlinkSync(scoutFramePath);
        }
        res.status(500).json({ error: 'Internal server error during video processing' });
    }
};