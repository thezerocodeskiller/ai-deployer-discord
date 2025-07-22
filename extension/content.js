//
// ----------------- START OF content.js -----------------
//

/*
   Uxento AI Sniper v32 – Discord Edition (Correct Fallback Logic)
   This version implements the correct, two-stage image handling:
   1. AI Analysis: Uses ONLY the main tweet image (or null if none exists).
   2. API Creation: Uses the AI-generated image, BUT falls back to the author's
      profile picture if generation fails, ensuring the API call always succeeds.
*/
console.log('🚀 Uxento AI Sniper v32 – Correct Fallback Logic ACTIVE');

// ---------- Helper Functions ----------
function simulateTyping(inputElement, text) {
    if (!inputElement) return;
    inputElement.focus();
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

function parseUrlFromProxy(proxyHref) {
    if (!proxyHref || !proxyHref.startsWith('http')) return null;
    try {
        const url = new URL(proxyHref);
        const originalUrl = url.searchParams.get('url');
        if (originalUrl && originalUrl.startsWith('http')) {
            return decodeURIComponent(originalUrl);
        }
    } catch (e) { /* Ignore parsing errors */ }
    return proxyHref;
}

// ---------- Data Extraction (Separates image sources) ----------
function extractDataFromDiscord(messageListItem) {
    const embedArticle = messageListItem.querySelector('article[class*="embedFull"]');
    if (!embedArticle) return null;

    const data = {
        mainText: embedArticle.querySelector('div[class*="embedDescription"]')?.innerText.trim() || '',
        author: embedArticle.querySelector('a[class*="embedAuthorNameLink"]')?.textContent.trim().replace('@', '').toLowerCase() || null,
        twitterUrl: null,
        tweetImageUrl: null,
        authorImageUrl: null
    };

    const authorIcon = embedArticle.querySelector('img[class*="embedAuthorIcon"]');
    if (authorIcon?.src) data.authorImageUrl = authorIcon.src;

    const titleLink = embedArticle.querySelector('a[class*="embedTitleLink"]');
    const authorLink = embedArticle.querySelector('a[class*="embedAuthorNameLink"]');
    if (titleLink?.href) data.twitterUrl = titleLink.href;
    else if (authorLink?.href) data.twitterUrl = authorLink.href;

    const mediaWrapperLink = embedArticle.querySelector('a[class*="originalLink"]');
    if (mediaWrapperLink?.href) data.tweetImageUrl = parseUrlFromProxy(mediaWrapperLink.href);
    
    if (!data.twitterUrl && !data.tweetImageUrl) return null;
    if (!data.author) data.author = messageListItem.querySelector('h3[class*="header"] span[class*="username"]')?.textContent.trim().toLowerCase() || 'unknown';

    return data;
}

// ---------- UI and API Logic ----------
const cardFireState = {};
function getPanelTemplate(cardId) {
    return `
    <div class="uxento-panel" style="width: 280px; flex-shrink: 0; padding: 12px; background: #2b2d31; border-left: 1px solid #404249; display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: #f2f3f5;">
      <button id="insta-${cardId}" style="background: #be185d; color: #fff; border: none; border-radius: 4px; padding: 10px; cursor: pointer; font-weight: 600;">Insta-Snipe Top Suggestion</button>
      <div><label style="color: #b5bac1; font-size: 11px; display: block; margin-bottom: 4px;">Name</label><input id="name-${cardId}" placeholder="Waiting for AI..." style="box-sizing: border-box; width:100%;background:#383a40;border:1px solid #5c5f66;border-radius:4px;color:#f2f3f5;padding:8px;"></div>
      <div><label style="color: #b5bac1; font-size: 11px; display: block; margin-bottom: 4px;">Ticker</label><input id="ticker-${cardId}" placeholder="..." style="box-sizing: border-box; width:100%;background:#383a40;border:1px solid #5c5f66;border-radius:4px;color:#f2f3f5;padding:8px;"></div>
      <div style="flex:1; overflow-y:auto; max-height:400px; display:flex; flex-direction:column; gap:6px;">
        <ul id="sugg-${cardId}" style="list-style:none; padding:0; margin:0;"><li style="color:#a1a1aa;text-align:center;padding:10px;">✨ Consulting Oracle…</li></ul>
      </div>
      <div><label style="color: #b5bac1; font-size: 11px; display: block; margin-bottom: 4px;">Buy Amount (SOL)</label><input id="amt-${cardId}" value="1" style="box-sizing: border-box; width:100%;background:#383a40;border:1px solid #5c5f66;border-radius:4px;color:#f2f3f5;padding:8px;"></div>
      <button id="create-${cardId}" disabled style="background: #3f3f46; color: #a1a1aa; border: none; border-radius: 4px; padding: 10px; cursor: not-allowed; font-weight: 600;">Create Manually</button>
    </div>
  `;
}
function createCoin(cardId, tweetData, name, symbol, amount) {
    if (cardFireState[cardId]) return;
    cardFireState[cardId] = true;
    const instaButton = document.getElementById(`insta-${cardId}`);
    const createButton = document.getElementById(`create-${cardId}`);
    instaButton.disabled = true; createButton.disabled = true;
    instaButton.textContent = 'FIRING...'; instaButton.style.backgroundColor = '#d97706';
    createButton.textContent = 'DEPLOYING...';

    const imageForApi = tweetData.finalImageUrl; 
    console.log(`Sending final data to API. Image being used: ${imageForApi}`);

    chrome.runtime.sendMessage({
        action: 'CREATE_COIN',
        payload: { name, symbol, twitter: tweetData.twitterUrl, image: imageForApi, amount: parseFloat(amount), astralTip: 0.002 }
    }, (response) => {
        if (response?.ok) {
            instaButton.textContent = '✅ SNIPE SUCCESSFUL!'; createButton.textContent = '✅ CREATED';
            instaButton.style.backgroundColor = '#16a34a';
        } else {
            instaButton.textContent = '❌ API FAILED'; createButton.textContent = '❌ FAILED';
            instaButton.style.backgroundColor = '#ef4444';
            instaButton.disabled = false; createButton.disabled = false;
            cardFireState[cardId] = false;
        }
    });
}

// ---------- Core Processing Logic ----------
async function processMessage(messageListItem) {
    if (messageListItem.dataset.aiProcessed) return;
    messageListItem.dataset.aiProcessed = 'true';

    setTimeout(async () => {
        const tweetData = extractDataFromDiscord(messageListItem);
        if (!tweetData) return;

        console.log("Processing NEW Embed:", tweetData);
        const cardId = 'discord-' + Date.now() + Math.random().toString(36).slice(2, 7);
        const accessoriesContainer = messageListItem.querySelector('div[id^="message-accessories"]');
        if (!accessoriesContainer) return;
        
        accessoriesContainer.style.display = 'flex';
        accessoriesContainer.style.alignItems = 'flex-start';
        accessoriesContainer.style.gap = '16px';
        accessoriesContainer.querySelectorAll('article[class*="embedFull"]').forEach(embed => {
            embed.style.flex = '1'; embed.style.minWidth = '0'; embed.style.order = '1';
        });
        const panelDiv = document.createElement('div');
        panelDiv.innerHTML = getPanelTemplate(cardId);
        const panelElement = panelDiv.firstElementChild;
        panelElement.style.order = '99';
        accessoriesContainer.appendChild(panelElement);
        const instaBtn = document.getElementById(`insta-${cardId}`), createBtn = document.getElementById(`create-${cardId}`), nameIn = document.getElementById(`name-${cardId}`), tickIn = document.getElementById(`ticker-${cardId}`), amtIn = document.getElementById(`amt-${cardId}`), suggUl = document.getElementById(`sugg-${cardId}`);
        instaBtn.onclick = () => createCoin(cardId, tweetData, nameIn.value, tickIn.value, amtIn.value);
        createBtn.onclick = () => createCoin(cardId, tweetData, nameIn.value, tickIn.value, amtIn.value);
        
        try {
            const bodyForAI = {
                mainText: tweetData.mainText,
                mainImageUrl: tweetData.tweetImageUrl 
            };
            console.log("Sending data to Vercel for name/image generation:", bodyForAI);
            
        const response = await fetch('https://ai-deployer-discord.vercel.app/api/generate-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyForAI)
            });
            if (!response.ok) throw new Error(`AI API Error: ${response.status}`);

            const aiResponse = await response.json();
            const suggestions = aiResponse.suggestions;
            
            tweetData.finalImageUrl = aiResponse.generatedImageUrl || tweetData.authorImageUrl;
            
            suggUl.innerHTML = '';
            suggestions.forEach((s, index) => {
                const li = document.createElement('li');
                li.style.cssText = 'padding: 8px; border: 1px solid #52525b; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; transition: all 0.2s;';
                li.innerHTML = `<span>${s.name}</span><span style="color:#a1a1aa">$${s.ticker}</span>`;
                li.onmouseenter = () => li.style.borderColor = '#4f46e5';
                li.onmouseleave = () => li.style.borderColor = '#52525b';
                li.onclick = () => {
                    simulateTyping(nameIn, s.name);
                    simulateTyping(tickIn, s.ticker);
                    createCoin(cardId, tweetData, s.name, s.ticker, amtIn.value);
                };
                suggUl.appendChild(li);
                if (index === 0) {
                    simulateTyping(nameIn, s.name);
                    simulateTyping(tickIn, s.ticker);
                    createBtn.disabled = false;
                    createBtn.style.backgroundColor = '#4f46e5';
                    createBtn.style.color = '#fff';
                    createBtn.style.cursor = 'pointer';
                }
            });
        } catch (e) {
            console.error("AI suggestion/image generation failed:", e);
            suggUl.innerHTML = `<li style="color:#ef4444; text-align: center; padding: 10px;">AI generation failed.</li>`;
            instaBtn.disabled = true; instaBtn.textContent = 'AI FAILED'; instaBtn.style.backgroundColor = '#ef4444';
        }
    }, 250);
}

// ---------- Event-Driven Observer Logic (Stable) ----------
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.matches('li[class*="messageListItem"]')) {
                processMessage(node);
            }
            const newMessages = node.querySelectorAll('li[class*="messageListItem"]');
            if (newMessages.length > 0) {
                newMessages.forEach(processMessage);
            }
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });
console.log("Observer is now watching for new messages...");

//
// -----------------  END OF content.js  -----------------
//