import OpenAI from 'openai';

const aiClient = new OpenAI({
    baseURL: 'https://models.github.ai/inference',
    apiKey: process.env.GITHUB_PAT,
});

/**
 * @param imageURls - Array of secure Cloudinary URLs of the extracted video frames
 * @returns An object containing a generated caption and an array of hashtags
 */

export const generateMarketingMetadata = async(imageUrls: string[]) =>{
    try {
        console.log(`Transmitting ${imageUrls.length} visual frames to GPT-4o for analysis...`);

        const userContent: any[] = [
            {
                type: 'text',
                text: 'Analyze these 3 sequential video frames from a product video. Understand the context, lighting, and product features to generate the marketing metadata.'
            }
        ];

        imageUrls.forEach((url) => {
            userContent.push({
                type: 'image_url',
                image_url: {url: url}
            });
        });

        const response = await aiClient.chat.completions.create({
            model: 'gpt-4o',
            messages:[
                {
                    role: 'system',
                    content: `You are a senoir social media marketing expert.
                    Analyze the provided image frames from a product video.
                    Respond STRICTLY with a JSON object containing two keys:
                    "caption" (a highly engaging 2-sentence marketing caption) and 
                    "tags" (an array of 5 highly relevant algorithmic hashtags, omitting the #symbol).`
                },
                {
                    role: 'user',
                    content: userContent
                }
            ],
            response_format: {type: 'json_object'},
            temperature: 0.7,
        });

        const rawContent = response.choices[0]?.message.content;
        
        if(!rawContent){
            throw new Error("AI returned an empty or invalid response.");
        }

        const metadata = JSON.parse(rawContent);

        console.log(`AI Analysis Complete! Generated ${metadata.tags.length} tags.`);

        return {
            caption: metadata.caption,
            tags: metadata.tags
        };
        
    } catch (error) {
        console.error('Error during AI Processing:', error);
        throw error;
    }
};