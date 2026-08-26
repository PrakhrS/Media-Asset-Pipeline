import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

async function run() {
    try {
        console.log("Listing models...");
        // the sdk doesn't natively expose listModels in GoogleGenerativeAI instance easily if it's old, but wait, there is no genAI.listModels() in standard web sdk?
        // Let's just fetch it via REST API.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log(data);
    } catch (e) {
        console.error(e);
    }
}
run();
