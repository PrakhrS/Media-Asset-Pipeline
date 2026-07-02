# Day 4: Schema Management & Cloud Storage Integration

##  Objective
Migrate from manual database management to programmatic schema initialization, and replace ephemeral local storage with permanent cloud hosting via Cloudinary.

##  Architecture & Flow
1. **Programmatic DB Initialization:** The Node.js server, upon booting, will execute a raw SQL script located in `src/models` to guarantee the `videos` table exists.
2. **Cloud Storage (Cloudinary):** After FFmpeg successfully processes the video locally, the backend will upload the processed `.mp4` to Cloudinary.
3. **Database Update:** The local file path in PostgreSQL will be overwritten with the permanent, secure Cloudinary URL.
4. **Cleanup:** The temporary local files in `uploads/temp` and `uploads/processed` will be deleted via the `fs` module to prevent the server from running out of disk space.

##  Step-by-Step Implementation Plan

### Phase 4.1: Database Schema Versioning
* Create a new folder: `src/models`.
* Create a file: `src/models/video.model.ts` (or `init.ts`).
* Write an asynchronous function that uses our `pg` pool to execute `CREATE TABLE IF NOT EXISTS videos (...)`.
* Import and call this function inside `index.ts` right after the database connects.

### Phase 4.2: Cloudinary Setup
* Install the SDK: `npm install cloudinary`.
* Create `src/config/cloudinary.ts` to initialize the Cloudinary v2 SDK using the credentials stored in your `.env` file (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).

### Phase 4.3: The Cloud Service Upload
* Create a new service function in `src/services/video.service.ts` (or a dedicated `cloudinary.service.ts`) that accepts a local file path and uploads it to Cloudinary.

### Phase 4.4: Updating the Controller & Cleanup
* Update `processVideoAsset` in your controller:
    1. Run FFmpeg (already working).
    2. Pass the output path to the new Cloudinary upload service.
    3. Run a raw SQL `UPDATE` to replace the local path with the Cloudinary `secure_url`.
    4. Use `fs.unlinkSync()` to delete the local files.