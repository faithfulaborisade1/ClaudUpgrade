// extension/content.js - Fixed version with better message detection
console.log('Claude Memory Bridge: Starting...');

const API_URL = 'http://localhost:8000';
const USER_ID = 'faith_builder';
let lastMessageCount = 0;

// Store message function
async function storeMessage(role, content) {
    console.log(`Attempting to store: ${role} - ${content.substring(0, 50)}...`);

    try {
        const response = await fetch(`${API_URL}/remember`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `${role}: ${content}`,
                user_id: USER_ID,
                importance: 0.7,
                emotional_context: null
            })
        });

        const data = await response.json();
        console.log('Stored successfully:', data);
    } catch (error) {
        console.error('Store error:', error);
    }
}

// Main capture function
function captureMessages() {
    const messageElements = document.querySelectorAll('div[class*="message"]');
    console.log(`Found ${messageElements.length} messages (was ${lastMessageCount})`);

    // Only process new messages
    if (messageElements.length > lastMessageCount) {
        console.log('New messages detected!');

        // Process messages starting from the last known count
        for (let i = lastMessageCount; i < messageElements.length; i++) {
            const element = messageElements[i];
            const text = element.textContent || element.innerText || '';

            if (text.trim().length > 10) {
                // Simple role detection - you at even indices, Claude at odd
                const role = i % 2 === 0 ? 'Human' : 'Assistant';

                console.log(`Message ${i}: ${role} - ${text.substring(0, 30)}...`);
                storeMessage(role, text.trim());
            }
        }

        lastMessageCount = messageElements.length;
    }
}

// Initialize
window.addEventListener('load', () => {
    console.log('Page loaded, initializing...');
    setTimeout(captureMessages, 2000);
});

// Check periodically
setInterval(() => {
    console.log('Periodic check...');
    captureMessages();
}, 5000);

// Watch for DOM changes
const observer = new MutationObserver(() => {
    console.log('DOM changed, checking messages...');
    setTimeout(captureMessages, 1000);
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('Claude Memory Bridge: Active');

// Test connection on load
fetch(`${API_URL}/health`)
    .then(r => r.json())
    .then(d => console.log('API connected:', d))
    .catch(e => console.error('API error:', e));