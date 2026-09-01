import { pool }  from '../db/db.js';

export const initVideoModel = async(): Promise<void> => {
    const schemaQuery = `
    CREATE TABLE IF NOT EXISTS videos(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename VARCHAR(255) NOT NULL,
    local_filepath TEXT,
    cloudinary_url TEXT,
    processing_status VARCHAR(50) DEFAULT 'uploaded',
    ai_caption TEXT,
    ai_tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `;


    try {
        await pool.query(schemaQuery);
        console.log('Database Schema Verification: "videos" table is active.');
    } catch (error) {
        console.error('Database Schema Initialization Failed:', error);
        throw error;
    }
}

