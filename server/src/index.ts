import dotenv from "dotenv"
dotenv.config();

import express from 'express'
import cors from 'cors'

import { pool } from "./db/db.js"




const app = express();
app.use(cors());


const port = Number(process.env.PORT) || 5001;

app.get('/api/health', (req, res) => {
    res.send("API is running");
});

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});

