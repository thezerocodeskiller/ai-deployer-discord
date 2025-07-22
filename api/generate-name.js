// This is a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-1.5-flash-latest"; // Using the latest Flash model

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
    model: MODEL_NAME,
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

/**
 * **UPDATED FUNCTION TO FIX IMAGE DOWNLOADS**
 * Fetches an image from a URL, adding a browser User-Agent to prevent being blocked by CDNs like Discord's.
 * @param {string} imageUrl The URL of the image to fetch.
 * @returns {Promise<Object|null>} A formatted image object for the AI, or null if it fails.
 */
async function fetchAndProcessImage(imageUrl) {
    console.log(`Attempting to fetch and process image: ${imageUrl}`);
    try {
        // **THE FIX:** Add a browser-like User-Agent to the request headers.
        // This makes our backend request look like it's from a normal browser,
        // bypassing CDN blocks.
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            },
            timeout: 8000 // 8-second timeout for slow images
        });

        if (!response.data || response.data.length === 0) {
            throw new Error("Downloaded image data is empty.");
        }

        console.log(`Successfully downloaded image (${(response.data.length / 1024).toFixed(2)} KB). Processing with Sharp...`);
        
        const processedImageBuffer = await sharp(response.data)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
            
        console.log("Image successfully processed. Returning base64 data.");
        
        return {
            inlineData: {
                data: processedImageBuffer.toString('base64'),
                mimeType: 'image/jpeg'
            }
        };
    } catch (error) {
        // Log detailed errors if fetching fails for any reason
        console.error("--- IMAGE PROCESSING FAILED ---");
        if (error.response) {
            console.error(`Error: Server responded with status ${error.response.status}`);
        } else if (error.request) {
            console.error("Error: No response received from image server. Is the URL correct and public?");
        } else {
            console.error('Error:', error.message);
        }
        return null; // IMPORTANT: Return null on failure
    }
}

// --- MAIN HANDLER FUNCTION ---
module.exports = async (req, res) => {
    await runMiddleware(req, res, corsMiddleware);
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const tweetData = req.body;
    console.log("Received data for AI analysis:", tweetData);

    try {
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
Take the first few words from the tweet text to meet your 10-suggestion quota.

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
        Execute your directives. Prioritize creative fusion but guarantee 10 concrete, literal results that adhere strictly to the character limits. Your first 3 suggestions are your strongest.
        
        JSON Output:
        `;
        
        
        userContentParts.push({ text: textPayload });

        // This is where the fix makes a difference. If mainImageUrl exists, we now successfully fetch it.
        if (tweetData.mainImageUrl) {
            const imagePart = await fetchAndProcessImage(tweetData.mainImageUrl);
            if (imagePart) {
                userContentParts.push(imagePart);
            }
        }
        
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemInstructions }] },
                { role: "model", parts: [{ text: "Awaiting data. I will analyze both image and text to create 10 memecoin suggestions in the specified JSON format." }] }
            ]
        });

        console.log("Sending final prompt parts to Gemini...");
        const result = await chat.sendMessage(userContentParts);
        const responseText = result.response.text();
        console.log("Received from Gemini:", responseText);

        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (!jsonMatch) { throw new Error("AI did not return a valid JSON array. Response was: " + responseText); }

        const aiResponse = JSON.parse(jsonMatch[0]);
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Full error during AI generation:", error); 
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};