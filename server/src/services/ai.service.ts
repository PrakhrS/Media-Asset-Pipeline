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