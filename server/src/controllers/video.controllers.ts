import type { Request, Response } from "express";
import {pool} from "../db/db.js";

export const localUpload = async (req: Request, res: Response): Promise<any> => {
    try {
        if(!req.file){
            return res.status(400).json({error: "No video asset was provided."});
        }
        const originalName = req.file.originalname;
        const localPath = req.file.path;

        const result = await pool.query(
            `INSERT INTO videos(original_filename, local_filepath) VALUES($1, $2) RETURNING *;`, [originalName, localPath]
        );

        return res.status(201).json({message: "Asset uploaded and recorded successfully.", video: result.rows[0]});

        
    } catch (error) {
        console.error("Controller Error [localUpload]:", error);
        return res.status(500).json({ error: "Internal server error during upload."});
    }
};