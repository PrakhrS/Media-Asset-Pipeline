import dotenv from "dotenv"
dotenv.config();

import express from 'express'
import cors from 'cors'

import { pool } from "./db/db.js"
import videoRoutes from "./routes/video.routes.js"

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1/video", videoRoutes);


const port = Number(process.env.PORT) || 5001;

app.get('/api/health', (req, res) => {
    res.send("API is running");
});

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});

