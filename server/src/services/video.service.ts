import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

/**
 * Processes a video to apply a standard 9:16 aspect ratio crop.
 * 
 * The crop filter uses '2*trunc(ih*9/32):2*trunc(ih/2)' to:
 * 1. Crop width to 9/16 of the height.
 * 2. Ensure both output width and height are divisible by 2 (required by H.264 encoders).
 * 3. Centered horizontally by default in FFmpeg if x and y offsets are omitted.
 * 
 * @param inputPath - Absolute path to the source video file in uploads/temp
 * @param outputPath - Absolute path where the processed video should be saved in uploads/processed
 * @param centerX - Center coordinate of the focal subject as a percentage (default 50)
 */
export const processVideo = (inputPath: string, outputPath: string, centerX: number = 50): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`crop=w='2*trunc(ih*9/32)':h='2*trunc(ih/2)':x='2*trunc(max(0, min(iw-(ih*9/16), (iw*${centerX}/100)-(ih*9/32)))/2)':y=0`)
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('end', () => {
        console.log('FFmpeg processing finished successfully.');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error during FFmpeg processing:', err);
        reject(err);
      })
      .save(outputPath);
  });
};


/**
 * Extracts 3 frames from a video at 25%, 50%, and 75% of its duration.
 * @param inputPath - Absolute path to the processed video
 * @param outputDir - Absolute path to the folder where frames should be saved
 * @returns Array of absolute file paths to the extracted images
 */

export const extractVideoFrames = (inputPath: string, outputDir: string): Promise<string[]> =>{
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if(err){
        console.error('Error probing video duration:', err);
        return reject(err);
      }

      const duration = metadata.format.duration;
      if(!duration){
        return reject(new Error('Could not determine video duration.'));
      }

      const timestamps = [
        duration * 0.25,
        duration * 0.50,
        duration * 0.75
      ];

      console.log(`Video duration: ${duration}s. Extractiing frames at: ${timestamps.map(t=> t.toFixed(2)).join(', ')}s`);

      const extractedFiles: string[] = [];

      ffmpeg(inputPath)
      .on('filenames', (filenames: string[]) => {
        filenames.forEach((filename) => {
          extractedFiles.push(path.join(outputDir, filename));
        });
      })
      .on('end', () => {
        console.log('SuccessFully extracted 3 frames!');
        resolve(extractedFiles);
      })
      .screenshots({
        timestamps: timestamps,
        filename: 'frame-%b-%s.jpeg',
        folder: outputDir,
        size: '1080x1920'
      });
    });
  });
};

/**
 * Extracts a single scout frame from the video at the 50% mark.
 * @param inputPath - Absolute path to the source video file
 * @param outputFolder - Absolute path to the output folder
 * @returns Absolute path to the generated scout frame
 */
export const extractScoutFrame = (inputPath: string, outputFolder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const filename = `scout-${timestamp}.jpg`;
    
    ffmpeg(inputPath)
      .on('end', () => {
        console.log(`Scout frame extracted successfully: ${filename}`);
        resolve(path.join(outputFolder, filename));
      })
      .on('error', (err) => {
        console.error('Error extracting scout frame:', err);
        reject(err);
      })
      .screenshots({
        timestamps: ['50%'],
        filename: filename,
        folder: outputFolder,
      });
  });
};