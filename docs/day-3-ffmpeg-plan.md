# Day 3: Local Video Processing Pipeline (FFmpeg)

##  Objective
Bypass the cloud upload step temporarily and implement the core video manipulation logic. We will use FFmpeg to take the raw video from the `uploads/temp` directory, process it (e.g., change the aspect ratio), and save the new asset locally.

##  Architecture & Flow
1. **Trigger:** The React frontend hits a new `POST /api/videos/process` endpoint, passing the `id` of the video we just saved in the database.
2. **Retrieval:** The backend queries PostgreSQL to find the `local_filepath` of that video.
3. **Processing:** The backend spawns an FFmpeg child process to transcode the video and adjust its aspect ratio (e.g., cropping to 9:16 for social media).
4. **Storage & Update:** The processed video is saved to `uploads/processed`. The database is updated with the new file path and the `processing_status` changes from 'uploaded' to 'completed'.

##  Step-by-Step Implementation Plan

### Phase 3.1: Install FFmpeg Dependencies
* Install FFmpeg physically on your operating system (Mac: `brew install ffmpeg`, Windows: via `winget` or direct download, Linux: `apt install ffmpeg`).
* Install the Node.js wrapper: Run `npm install fluent-ffmpeg` and `npm install -D @types/fluent-ffmpeg` in the server directory.
* Create an `uploads/processed` folder in your backend to store the finished files.

### Phase 3.2: Create the Processing Service
* Create a new file: `src/services/video.service.ts`.
* Write a function `processVideo(inputPath: string, outputPath: string)` that wraps `fluent-ffmpeg` in a JavaScript Promise, applying a standard 9:16 crop filter.

### Phase 3.3: Build the Controller & Route
* Add a `processVideoAsset` function to `src/controllers/video.controller.ts`.
* Extract the database `id` from the request body.
* Query the database to get the raw file path.
* Pass the path to your new `processVideo` service.
* Upon successful processing, run an `UPDATE` raw SQL query to update the database row.
* Expose this controller on a new route in `src/routes/video.routes.ts`.