import ffmpeg from 'fluent-ffmpeg';

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
 */
export const processVideo = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters('crop=2*trunc(ih*9/32):2*trunc(ih/2)')
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
