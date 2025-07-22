const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fal = require('@fal-ai/serverless-client');

// --- CONFIGURATION ---
const GOOGLE_API_KEY = process.env.API_KEY;
const FAL_API_KEY = process.env.FAL_API_KEY;

if (!GOOGLE_API_KEY || !FAL_API_KEY) {
    throw new Error("FATAL ERROR: Missing Google API_KEY or FAL_API_KEY in environment variables.");
}

fal.config({ credentials: FAL_API_KEY });

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-06-17",
    safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
});

// --- MIDDLEWARE SETUP & HELPERS ---
const corsMiddleware = cors();
const runMiddleware = (req, res, fn) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) { return reject(result); }
            return resolve(result);
        });
    });
};

async function fetchAndProcessImage(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const processedImageBuffer = await sharp(response.data)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
        return { inlineData: { data: processedImageBuffer.toString('base64'), mimeType: 'image/jpeg' } };
    } catch (error) {
        console.error("Error fetching or processing image:", error.message);
        return null;
    }
}

async function generateColorImage(color, text) {
    const svgImage = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${color}" /><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="90" fill="white" text-anchor="middle" dominant-baseline="central" font-weight="bold">${text}</text></svg>`;
    const svgBuffer = Buffer.from(svgImage);
    const jpegBuffer = await sharp(svgBuffer).jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
}

async function generateAiImage(prompt) {
    try {
        console.log(`Sending prompt to Fal.ai: "${prompt}"`);
        const result = await fal.subscribe("fal-ai/fast-sdxl", {
            input: { prompt },
            logs: false,
        });
        return result.images[0].url;
    } catch (error) {
        console.error("Fal.ai image generation failed:", error);
        return null;
    }
}

// --- MAIN HANDLER FUNCTION ---
module.exports = async (req, res) => {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

    const tweetData = req.body;
    console.log("Request received for Gemini (V6 Prompt) + Image Gen. Data:", tweetData);

    try {
        // --- STAGE 1: Generate Names/Tickers using YOUR PROVEN V6 PROMPT ---
        const systemInstructions = `You are 'AlphaOracle V6', The Ultimate Memecoin AI. You are a master of creative synthesis and hyper-literal extraction. Your primary goal is to be creative, but you will NEVER fail to provide a concrete answer that fits the required format.

**//-- DUAL CORE DIRECTIVES --//**
1.  **CONCEPT FUSION (Primary Goal):** Your main objective is to fuse elements into creative narratives. Identify the **WHO** (person/project), **WHAT** (concept), and **ACTION/MEME** (verb/slang) and combine them.


**//-- OUTPUT FORMAT RULES (CRITICAL) --//**
-   **Name:** CAN be 32 characters or less.
-   **Ticker:** CAN be 10 characters or less.
-   You must strictly adhere to these length limits.

**//-- THE ULTIMATE PRIORITY SYSTEM --//**

**PRIORITY 1: EXPLICIT SIGNALS (QUOTES & TICKERS)**
If the text has a phrase in **"quotation marks"** or an explicit ticker ($TICKER), it is the #1 suggestion.

**PRIORITY 2: NAMED ENTITY PRIORITY**
If the text explicitly names a character, project, or subject (e.g., "Shadow's heading for Europe"), that name ("Shadow") is a critical signal. It MUST be prioritized for the ticker.

**PRIORITY 3: CREATIVE NARRATIVE FUSION**
Synthesize the who, what, and action from the text and image into compelling, multi-word concepts.

**PRIORITY 4: LITERAL PHRASE EXTRACTION**
Extract the most impactful multi-word phrases directly from the text.

**PRIORITY 5: LITERAL NOUN DECONSTRUCTION (Fallback)**
List the key literal nouns from the scene (e.g., Dog, Cape, City).

**PRIORITY 6: THE HYPER-LITERAL GUARANTEE (Final Fallback)**
Take the first few words from the tweet text to meet your 5-suggestion quota.

**//-- INTELLIGENT TICKER GENERATION --//**
1.  **Named Entity Rule:** If a Named Entity is identified, its name MUST be the top choice for the ticker (e.g., 'SHADOW'). The ticker must be **10 characters or less.**
2.  **Explicit Ticker Rule:** If a name is a known ticker (e.g., $BAM), use it.
3.  **Acronyms:** For names with 2+ words, create an acronym.

**//-- SUCCESS & FAILURE CASE STUDIES --//**
-   **TWEET 1:** Text: "New flight path unlocked: Shadow's heading for Europe! EU" | IMAGE: A superhero dog with an EU flag cape.
    -   **FAILURE (Old AI):** \`[{"name": "Super EU Dog", "ticker": "EUDOG"}]\` (Missed the character's name for the ticker)
    -   **SUCCESS (Your Mandate):** \`[{"name": "Super EU Dog", "ticker": "SHADOW"}]\` (Correctly identified 'Shadow' as the priority ticker)
-   **TWEET 2:** Text: "This new project is called The Greatest Spectacle in the Universe"
    -   **FAILURE (Old AI):** \`[{"name": "The Greatest Spectacle in the Universe"}]\` (Name is too long)
    -   **SUCCESS (Your Mandate):** \`[{"name": "Greatest Spectacle Universe", "ticker": "GSU"}]\` (Name and ticker adhere to length limits)

Now, await the user's data and execute your directives. Your entire response must be ONLY a valid JSON array.`;
        
        const userContentParts = [];
        
        const textPayload = `
        **ANALYZE THIS DATA:**
        -   **Main Text:** "${tweetData.mainText || 'N/A'}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}
        
        **YOUR TASK:**
        Execute your directives. Prioritize creative fusion but guarantee 5 concrete, literal results that adhere strictly to the character limits. Your first 3 suggestions are your strongest.
        
        JSON Output:
        `;
        userContentParts.push({ text: textPayload });

        if (tweetData.mainImageUrl) {
            const imagePart = await fetchAndProcessImage(tweetData.mainImageUrl);
            if (imagePart) userContentParts.push(imagePart);
        }

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: "Here are your instructions for our session." }] },
                { role: "model", parts: [{ text: systemInstructions }] }
            ]
        });

        const result = await chat.sendMessage(userContentParts);
        const text = result.response.text();
        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) { throw new Error("AI did not return a valid JSON array. Response was: " + text); }
        const suggestions = JSON.parse(jsonMatch[0]);

        // --- STAGE 2: Generate the Image ---
        let generatedImageUrl = null;
        if (tweetData.mainImageUrl) {
            generatedImageUrl = tweetData.mainImageUrl;
            console.log("Tweet already has an image, using that.");
        } else {
            const topSuggestionName = suggestions[0].name;
            const topSuggestionTicker = suggestions[0].ticker;
            const colorMatch = tweetData.mainText.match(/\$([a-zA-Z]+)/);

            if (colorMatch && colorMatch[1]) {
                const color = colorMatch[1].toLowerCase();
                console.log(`Simple color prompt detected. Generating image for color: "${color}"`);
                generatedImageUrl = await generateColorImage(color, `$${topSuggestionTicker}`);
            } else {
                const imagePrompt = `${topSuggestionName}, memecoin logo, clean vector art, vibrant colors, white background`;
                generatedImageUrl = await generateAiImage(imagePrompt);
            }
        }

        // --- STAGE 3: Combine and Respond ---
        const finalResponse = {
            suggestions: suggestions,
            generatedImageUrl: generatedImageUrl
        };
        res.status(200).json(finalResponse);

    } catch (error) {
        console.error("Full error during AI generation:", error);
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};
