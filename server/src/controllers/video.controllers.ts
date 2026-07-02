import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response } from "express";

import { uploadToCloudinary } from '../services/cloudinary.service.js';
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
    let inputPath = '';

    try{
        const {videoId} = req.body;

        if(!videoId){
            return res.status(400).json({error: 'Missing videoId'});
        }

        const result = await pool.query('SELECT local_filepath FROM videos WHERE id = $1', [videoId]);

        if(result.rows.length === 0){
            return res.status(404).json({error: 'Video record not found'});
        }

        const relativePath = result.rows[0].local_filepath;
        inputPath = path.join(__dirname, '../../', relativePath);

        if(!fs.existsSync(inputPath)){
            return res.status(404).json({error: 'Source video file is missing!!'});
        }

        const processedDir = path.join(__dirname, '../../uploads/processed');
        fs.mkdirSync(processedDir, {recursive: true});

        const outputFilename = `processed-${Date.now()}.mp4`;
        const outputPath = path.join(processedDir, outputFilename);

        console.log(`FFmpeg Processing Started for video: ${videoId}`);
        await processVideo(inputPath, outputPath);
        console.log('FFmpeg Processing Complete.');

        console.log('Uploading finalized asset to Cloudinary...');
        const cloudinaryUrl = await uploadToCloudinary(outputPath);
        console.log(`Cloudinary Upload Complete: ${cloudinaryUrl}`);

        await pool.query(
            'UPDATE videos SET cloudinary_url = $1, processing_status = $2 WHERE id = $3', [cloudinaryUrl, 'completed', videoId]
        );

        if(fs.existsSync(inputPath)){
            fs.unlinkSync(inputPath);
            console.log('Local stagin files cleaned.');
        }

        res.status(200).json({
            message: 'Pipeline executed successfully',
            status: 'completed',
            cloudUrl: cloudinaryUrl
        });
        

    } catch(error){
        console.error('Pipeline Execution Failed:', error);

        if(inputPath && fs.existsSync(inputPath)){
            fs.unlinkSync(inputPath);
        }
        res.status(500).json({error: 'Internal server error during video processing'});
    }
};