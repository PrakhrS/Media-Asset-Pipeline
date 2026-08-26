import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

/**
 * @param imageUrls - Array of secure Cloudinary URLs of the extracted video frames
 * @returns An object containing a generated caption and an array of hashtags
 */
export const generateMarketingMetadata = async (imageUrls: string[]) => {
    try {
        console.log(`Transmitting ${imageUrls.length} visual frames to Gemini for analysis...`);

        const model = genAI.getGenerativeModel({
            model: 'gemini-3.6-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
            },
        });

        const prompt = `You are a senior social media marketing expert.
Analyze these 3 sequential video frames from a product video. Understand the context, lighting, and product features to generate the marketing metadata.
Respond STRICTLY with a JSON object containing two keys:
"caption" (a highly engaging 2-sentence marketing caption) and 
"tags" (an array of 5 highly relevant algorithmic hashtags, omitting the # symbol).`;

        const imageParts = await Promise.all(
            imageUrls.map(async (url) => {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image from URL: ${url}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                return {
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType: 'image/jpeg',
                    },
                };
            })
        );

        const result = await model.generateContent([prompt, ...imageParts]);
        const rawContent = result.response.text();

        if (!rawContent) {
            throw new Error("AI returned an empty or invalid response.");
        }

        const metadata = JSON.parse(rawContent);

        console.log(`AI Analysis Complete! Generated ${metadata.tags?.length || 0} tags.`);

        return {
            caption: metadata.caption,
            tags: metadata.tags
        };

    } catch (error) {
        console.error('Error during AI Processing:', error);
        console.log('Returning fallback marketing metadata to prevent pipeline crash.');
        return {
            caption: "Discover our latest amazing product feature in this exclusive look!",
            tags: ["new", "product", "exclusive", "launch", "amazing"]
        };
    }
};

export interface SubjectCoordinatesResponse {
    centerX: number;
}

/**
 * Analyzes an uncropped video frame and estimates the horizontal center of the primary subject.
 * @param imageUrl - Public URL of the uncropped scout keyframe.
 * @returns Object containing centerX (0 to 100). Fallbacks to 50 on error.
 */
export const getSubjectCoordinates = async (imageUrl: string): Promise<SubjectCoordinatesResponse> => {
    try {
        console.log(`Analyzing spatial coordinates for subject in image: ${imageUrl}`);
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const imagePart = {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType: 'image/jpeg',
            },
        };

        const model = genAI.getGenerativeModel({
            model: 'gemini-3.6-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
            },
        });

        const prompt = `Analyze this uncropped video frame. Locate the primary visual focal subject (e.g., product, person, or animal). Estimate the horizontal midpoint of that subject's bounding box across the horizontal X-axis, on a scale from 0 (left edge) to 100 (right edge). Respond strictly with valid JSON in the exact schema: {"centerX": number}`;

        const result = await model.generateContent([prompt, imagePart]);
        const rawContent = result.response.text();
        
        if (!rawContent) {
            throw new Error("AI returned an empty or invalid response.");
        }

        const parsedResponse = JSON.parse(rawContent);
        
        if (typeof parsedResponse.centerX !== 'number') {
            throw new Error("Response JSON does not contain a valid 'centerX' number.");
        }

        // Clamp the returned value to ensure it remains strictly between 0 and 100
        const clampedCenterX = Math.max(0, Math.min(100, Math.round(parsedResponse.centerX)));

        console.log(`Spatial Analysis Complete! Estimated centerX: ${clampedCenterX}%`);
        
        return { centerX: clampedCenterX };

    } catch (error) {
        console.warn('Warning: AI Spatial Processing Failed.', error);
        console.log('Returning fallback center coordinates (50) to prevent pipeline crash.');
        return { centerX: 50 };
    }
};