/*
   Uxento AI Sniper v24 – Discord Edition (Correct Layout & Stable)
   This version uses the CSS 'order' property to definitively force the UI panel
   to the right of the embed, fixing the layout issue while retaining all
   performance and stability improvements.
*/
console.log('🚀 Uxento AI Sniper v24 – Layout Fix ACTIVE');

// ---------- Helper Functions (Unchanged) ----------
function simulateTyping(inputElement, text) {
    if (!inputElement) return;
    inputElement.focus();
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------- Data Extraction (Unchanged, robust) ----------
function extractDataFromDiscord(messageListItem) {
    const data = {
        mainText: '',
        quotedText: '',
        author: '',
        twitterUrl: '',
        mainImageUrl: null,
    };
    const embedAuthor = messageListItem.querySelector('a[class*="embedAuthorNameLink"]');
    if (embedAuthor) data.author = embedAuthor.textContent.trim().replace('@', '').toLowerCase();
    const embedTitleLink = messageListItem.querySelector('a[class*="embedTitleLink"]');
    if (embedTitleLink) data.twitterUrl = embedTitleLink.href;
    if (!data.twitterUrl) {
       const authorLink = messageListItem.querySelector('a[class*="embedAuthorNameLink"]');
       if (authorLink && (authorLink.href.includes('twitter.com') || authorLink.href.includes('x.com') || authorLink.href.includes('instagram.com'))) {
           data.twitterUrl = authorLink.href;
       }
    }
    const embedDescription = messageListItem.querySelector('div[class*="embedDescription"]');
    if (embedDescription) data.mainText = embedDescription.innerText.trim();
    const blockquote = embedDescription?.querySelector('blockquote');
    if (blockquote) {
        data.quotedText = blockquote.innerText.trim();
        data.mainText = data.mainText.replace(data.quotedText, '').trim();
    }
    const image = messageListItem.querySelector('div[class*="embedImage"] img, div[class*="embedVideo"] video');
    if (image) data.mainImageUrl = image.src || image.poster;
    return data.twitterUrl ? data : null;
}

// ---------- UI and API Logic (Unchanged) ----------
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
    instaButton.disabled = true;
    createButton.disabled = true;
    instaButton.textContent = 'FIRING...';
    instaButton.style.backgroundColor = '#d97706';
    chrome.runtime.sendMessage({ action: 'CREATE_COIN', payload: { name, symbol, twitter: tweetData.twitterUrl, image: tweetData.mainImageUrl, amount: parseFloat(amount), astralTip: 0.002 } }, (response) => {
        if (response?.ok) {
            instaButton.textContent = '✅ SNIPE SUCCESSFUL!';
            createButton.textContent = '✅ CREATED';
            instaButton.style.backgroundColor = '#16a34a';
        } else {
            instaButton.textContent = '❌ API FAILED';
            createButton.textContent = '❌ FAILED';
            instaButton.style.backgroundColor = '#ef4444';
            instaButton.disabled = false;
            createButton.disabled = false;
            cardFireState[cardId] = false;
        }
    });
}

// ---------- Core Processing Logic for a Single Message ----------
async function processMessage(messageListItem) {
    if (messageListItem.dataset.aiProcessed === 'true') return;
    const embedArticle = messageListItem.querySelector('article[class*="embedFull"]');
    if (!embedArticle) return;
    const tweetData = extractDataFromDiscord(messageListItem);
    if (!tweetData) {
        messageListItem.dataset.aiProcessed = 'true';
        return;
    }

    messageListItem.dataset.aiProcessed = 'true';
    console.log("Processing NEW Embed:", tweetData.twitterUrl);
    const cardId = 'discord-' + Date.now() + Math.random().toString(36).slice(2, 7);

    // **DEFINITIVE LAYOUT FIX**
    const accessoriesContainer = messageListItem.querySelector('div[id^="message-accessories"]');
    if (!accessoriesContainer) return;
    
    // 1. Set the container to use Flexbox
    accessoriesContainer.style.display = 'flex';
    accessoriesContainer.style.alignItems = 'flex-start';
    accessoriesContainer.style.gap = '16px'; // Optional: adds space between embed and panel

    // 2. Ensure the original embed doesn't overflow and has a low order number
    accessoriesContainer.querySelectorAll('article[class*="embedFull"]').forEach(embed => {
        embed.style.flex = '1';
        embed.style.minWidth = '0';
        embed.style.order = '1'; // Tell it to be on the left
    });

    // 3. Create the panel and give it a high order number to force it to the right
    const panelDiv = document.createElement('div');
    panelDiv.innerHTML = getPanelTemplate(cardId);
    const panelElement = panelDiv.firstElementChild;
    panelElement.style.order = '99'; // Tell our panel to be on the right
    
    accessoriesContainer.appendChild(panelElement);

    // Wire up UI
    const instaBtn = document.getElementById(`insta-${cardId}`);
    const createBtn = document.getElementById(`create-${cardId}`);
    const nameIn = document.getElementById(`name-${cardId}`);
    const tickIn = document.getElementById(`ticker-${cardId}`);
    const amtIn = document.getElementById(`amt-${cardId}`);
    const suggUl = document.getElementById(`sugg-${cardId}`);
    instaBtn.onclick = () => createCoin(cardId, tweetData, nameIn.value, tickIn.value, amtIn.value);
    createBtn.onclick = () => createCoin(cardId, tweetData, nameIn.value, tickIn.value, amtIn.value);

    // Fetch AI suggestions (Unchanged)
    try {
        const response = await fetch('https://ai-deployer-discord.vercel.app/api/generate-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mainText: tweetData.mainText, quotedText: tweetData.quotedText, mainImageUrl: tweetData.mainImageUrl })
        });
        if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
        const suggestions = await response.json();
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
                createBtn.disabled = false;
                createBtn.style.cssText = 'background:#4f46e5;color:#fff;border:none;border-radius:4px;padding:10px;cursor:pointer;font-weight:600;';
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
        console.error("AI suggestion fetch failed:", e);
        suggUl.innerHTML = `<li style="color:#ef4444; text-align: center; padding: 10px;">AI suggestion failed.</li>`;
        instaBtn.disabled = true;
        instaBtn.textContent = 'AI FAILED';
        instaBtn.style.backgroundColor = '#ef4444';
    }
}


// ---------- Event-Driven Observer Logic (Unchanged and Performant) ----------
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

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("Observer is now watching for new messages...");