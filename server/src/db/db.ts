import pkg from 'pg';
import dotenv from 'dotenv';
import { initVideoModel } from '../models/video.model.js';

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool(
  process.env.DB_URL
    ? {
        connectionString: process.env.DB_URL,
        ssl: { rejectUnauthorized: false }, // Required for Supabase cloud handshake
      }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'videodb',
      }
);

export const initDB = async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to Supabase PostgreSQL successfully.');
    client.release();

    // Auto-generates the videos table on Supabase
    await initVideoModel();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};
