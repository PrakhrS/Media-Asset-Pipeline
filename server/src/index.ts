import dotenv from "dotenv"
dotenv.config();

import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io';

import { initVideoModel } from "./models/video.model.js";
import { initVideoWorker } from "./workers/video.worker.js";
import videoRoutes from "./routes/video.routes.js"

const app = express();
app.use(cors({origin: "*"}));
app.use(express.json());

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

io.on('connection', (socket) =>{
  console.log('A client connected:', socket.id);
});


app.use("/api/v1/video", videoRoutes);


const port = Number(process.env.PORT) || 5001;

app.get('/api/health', (req, res) => {
    res.send("API is running");
});

const startServer = async () => {
  try {
    await initVideoModel();

    server.listen(port, () => {
      console.log(`Server running on port: ${port}`);
      initVideoWorker();
    });
  } catch (error) {
    console.error("Critical: Database or Server initialization failed:", error);
    process.exit(1);
  }
};

startServer();

