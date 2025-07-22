/*
   Uxento AI Sniper v40 – Discord Edition (Ticker First UI)
   This version updates the UI to display the ticker before the name on
   suggestion pills for faster recognition, as requested by the user.
*/
console.log('🚀 Uxento AI Sniper v40 – Ticker First UI ACTIVE');

// ---------- Helper & Data Extraction (Unchanged and Stable) ----------
function parseUrlFromProxy(proxyHref) { if (!proxyHref || !proxyHref.startsWith('http')) return null; try { const url = new URL(proxyHref); const originalUrl = url.searchParams.get('url'); if (originalUrl && originalUrl.startsWith('http')) { return decodeURIComponent(originalUrl); } } catch (e) {} return proxyHref; }
function extractDataFromDiscord(messageListItem) {
    const embedArticle = messageListItem.querySelector('article[class*="embedFull"]');
    if (!embedArticle) return null;
    const data = {
        mainText: embedArticle.querySelector('div[class*="embedDescription"]')?.innerText.trim() || '',
        author: embedArticle.querySelector('a[class*="embedAuthorNameLink"]')?.textContent.trim().replace('@', '').toLowerCase() || null,
        twitterUrl: null, tweetImageUrl: null, authorImageUrl: null
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

// ---------- API Logic (Unchanged) ----------
function createCoin(sniperBar, tweetData, name, symbol, amount) {
    sniperBar.innerHTML = '';
    const statusPill = document.createElement('button');
    statusPill.disabled = true;
    statusPill.style.cssText = `
        background-color: #d97706; color: #fff; border: 1px solid #9a3412;
        border-radius: 6px; padding: 6px 10px; font-size: 13px;
        font-weight: 600; cursor: wait;
    `;
    statusPill.textContent = `FIRING: ($${symbol}) ${name}`;
    sniperBar.appendChild(statusPill);
    const imageForApi = tweetData.tweetImageUrl || tweetData.authorImageUrl;
    chrome.runtime.sendMessage({
        action: 'CREATE_COIN',
        payload: { name, symbol, twitter: tweetData.twitterUrl, image: imageForApi, amount: parseFloat(amount), astralTip: 0.002 }
    }, (response) => {
        if (response?.ok) {
            statusPill.textContent = `✅ CREATED: ($${symbol}) ${name}`;
            statusPill.style.backgroundColor = '#16a34a';
            statusPill.style.borderColor = '#14532d';
        } else {
            statusPill.textContent = `❌ FAILED: ($${symbol}) ${name}`;
            statusPill.style.backgroundColor = '#ef4444';
            statusPill.style.borderColor = '#7f1d1d';
        }
    });
}

// ---------- Core Processing Logic with Dual-Arming System ----------
async function processMessage(messageListItem) {
    if (messageListItem.dataset.aiProcessed) return;
    messageListItem.dataset.aiProcessed = 'true';

    setTimeout(async () => {
        const tweetData = extractDataFromDiscord(messageListItem);
        if (!tweetData) return;

        const cardId = 'discord-' + Date.now();
        const accessoriesContainer = messageListItem.querySelector('div[id^="message-accessories"]');
        if (!accessoriesContainer) return;

        let isArmed = false;

        const sniperBar = document.createElement('div');
        sniperBar.id = `uxento-sniper-bar-${cardId}`;
        sniperBar.style.cssText = `display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 8px; width: 100%;`;
        accessoriesContainer.prepend(sniperBar);
        
        const messageContainer = messageListItem.querySelector('div[class*="message_"]');
        
        const armSystem = () => {
            if (isArmed) return;
            isArmed = true;
            if (messageContainer) {
                messageContainer.style.cursor = 'default';
                messageContainer.onclick = null;
            }
            sniperBar.innerHTML = '';
            const armedPill = document.createElement('button');
            armedPill.disabled = true;
            armedPill.textContent = 'ARMED & WAITING FOR AI...';
            armedPill.style.cssText = `
                background-color: #d97706; color: #fff; border: 1px solid #9a3412;
                border-radius: 6px; padding: 6px 10px; font-size: 13px;
                font-weight: 600; cursor: wait;
            `;
            sniperBar.appendChild(armedPill);
        };

        for (let i = 0; i < 6; i++) {
            const placeholder = document.createElement('button');
            placeholder.innerHTML = `<span> </span>`;
            placeholder.style.cssText = `
                background-color: #383a40; border: 1px solid #5c5f66; border-radius: 6px;
                padding: 6px 10px; font-size: 13px; cursor: pointer; min-width: 100px;
                animation: pulse 1.5s infinite ease-in-out;
            `;
            placeholder.onclick = armSystem;
            sniperBar.appendChild(placeholder);
        }
        if (messageContainer) {
            messageContainer.style.cursor = 'pointer';
            messageContainer.onclick = (e) => {
                if (e.target.closest('a, button')) return;
                armSystem();
            };
        }
        if (!document.getElementById('uxento-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'uxento-pulse-style';
            style.textContent = `@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`;
            document.head.appendChild(style);
        }

        try {
            const bodyForAI = { mainText: tweetData.mainText, mainImageUrl: tweetData.tweetImageUrl };
            
            const response = await fetch('https://ai-deployer-discord.vercel.app/api/generate-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyForAI)
            });
            if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
            const suggestions = await response.json();
            
            if (isArmed) {
                if (suggestions.length > 0) {
                    const topSuggestion = suggestions[0];
                    createCoin(sniperBar, tweetData, topSuggestion.name, topSuggestion.ticker, 1.0);
                }
            } else {
                if (messageContainer) {
                    messageContainer.style.cursor = 'default';
                    messageContainer.onclick = null;
                }
                sniperBar.innerHTML = '';
                suggestions.forEach(s => {
                    const button = document.createElement('button');
                    
                    // --- THIS IS THE CHANGE ---
                    const nameSpan = `<span style="font-weight: 600;">${s.name}</span>`;
                    const tickerSpan = `<span style="color: #b5bac1; margin-right: 5px;">($${s.ticker})</span>`;
                    button.innerHTML = tickerSpan + nameSpan; // Ticker is now first
                    // --- END CHANGE ---

                    button.style.cssText = `
                        background-color: #383a40; color: #f2f3f5; border: 1px solid #5c5f66;
                        border-radius: 6px; padding: 6px 10px; font-size: 13px;
                        cursor: pointer; transition: background-color 0.2s;
                    `;
                    button.onmouseenter = () => { if (!button.disabled) button.style.backgroundColor = '#4f46e5'; };
                    button.onmouseleave = () => { if (!button.disabled) button.style.backgroundColor = '#383a40'; };
                    button.onclick = () => createCoin(sniperBar, tweetData, s.name, s.ticker, 1.0);
                    sniperBar.appendChild(button);
                });
            }
        } catch (e) {
            console.error("AI suggestion fetch failed:", e);
            sniperBar.innerHTML = `<span style="color:#ef4444; font-size: 12px;">AI suggestion failed.</span>`;
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