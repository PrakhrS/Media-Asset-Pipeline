import {v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export const uploadToCloudinary = async(localFilePath: string): Promise<string> => {
    try{
        if(!localFilePath){
            throw new Error('Cloudinary Service Error: Missing local file path. ');
        }

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'video',
            folder: 'media_pipeline/raw_uploads',
        });

        if(fs.existsSync(localFilePath)){
            fs.unlinkSync(localFilePath);
        }

        return response.secure_url;
    } catch(error){
        if(fs.existsSync(localFilePath)){
            fs.unlinkSync(localFilePath);
        }
        console.error('Cloudinary Upload Service Failed: ', error);
        throw error;
    }
};


/**
 * Uploads multiple files to Cloudinary concurrently.
 * @param filePaths - Array of absolute local file paths to upload
 * @returns Array of secure Cloudinary URLs
 */

export const uploadMultipleFiles = async(filePaths: string[]): Promise<string[]> =>{
    try{
        console.log(`Transmitting ${filePaths.length} visual frames to Cloudinary...`);

        const uploadPromises = filePaths.map((filePath) => {
            return cloudinary.uploader.upload(filePath, { folder: 'media_pipeline/frames' });
        });

        const results = await Promise.all(uploadPromises);

        console.log(`Successfully uploaded ${results.length} frames to the cloud!`);

        return results.map(result => result.secure_url);

    } catch(error){
        console.error('Error during batch Cloudinary upload:', error);
        throw error;
    }
};