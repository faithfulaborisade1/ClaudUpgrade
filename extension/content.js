// content.js - Enhanced automatic message capture with auto-summary injection
console.log('ClaudUpgrade: Initializing enhanced memory bridge...');

// Configuration
const CONFIG = {
    API_URL: 'http://localhost:8000',
    CAPTURE_INTERVAL: 3000,
    MESSAGE_SELECTORS: [
        'div[data-testid*="message"]',
        'div[class*="message-content"]',
        'div[class*="ChatMessage"]',
        'div[class*="ConversationItem"]',
        'div[role="presentation"]'
    ]
};

// State management
let state = {
    userId: null,
    isLicensed: false,
    lastMessageCount: 0,
    lastCaptureTime: 0,
    conversationHistory: new Map(),
    pendingMessages: [],
    conversationHistoryPasted: false
};

// License management
async function checkLicense() {
    const result = await chrome.storage.sync.get(['licenseKey', 'licenseExpiry']);

    if (!result.licenseKey) return false;

    // For test key, always return true
    if (result.licenseKey === 'TEST-KEY-123') {
        console.log('ClaudUpgrade: Test license key detected');
        return true;
    }

    // Check expiry
    if (result.licenseExpiry && new Date(result.licenseExpiry) < new Date()) {
        console.log('ClaudUpgrade: License expired');
        return false;
    }

    // Validate with server
    try {
        const response = await fetch(`${CONFIG.API_URL}/validate_license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: result.licenseKey })
        });

        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error('ClaudUpgrade: License validation error:', error);
        // Allow offline use if previously validated
        return !!result.licenseExpiry;
    }
}

// User management
async function getUserId() {
    const stored = await chrome.storage.local.get(['userId']);

    if (stored.userId) {
        return stored.userId;
    }

    // Try to get from Chrome identity
    try {
        const userInfo = await chrome.identity.getProfileUserInfo();
        if (userInfo.email) {
            const userId = `claude_${userInfo.email.split('@')[0]}_${Date.now()}`;
            await chrome.storage.local.set({ userId });
            return userId;
        }
    } catch (error) {
        console.log('ClaudUpgrade: Could not get Chrome identity');
    }

    // Generate unique ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await chrome.storage.local.set({ userId });
    return userId;
}

// Auto-inject summary when starting a new chat
async function injectConversationSummary() {
    console.log('ClaudUpgrade: Checking for new chat to inject summary...');

    // Check if this is a new/empty chat
    const messages = findAllMessages();
    if (messages.length > 0) {
        console.log('ClaudUpgrade: Chat already has messages, skipping auto-injection');
        return;
    }

    // Get the most recent summary
    try {
        const response = await fetch(`${CONFIG.API_URL}/get_latest_summary/${state.userId}`);
        if (!response.ok) {
            console.log('ClaudUpgrade: No summary available');
            return;
        }

        const data = await response.json();
        const summary = data.summary_text;

        if (summary) {
            console.log('ClaudUpgrade: Injecting conversation summary...');
            await injectTextIntoChat(summary);
        }
    } catch (error) {
        console.error('ClaudUpgrade: Error fetching summary:', error);
    }
}

// Inject text into the chat input
async function injectTextIntoChat(text) {
    // Find the input field (Claude's chat input)
    const inputSelectors = [
        'textarea[placeholder*="Message Claude"]',
        'textarea[data-testid="chat-input"]',
        'div[contenteditable="true"]',
        'textarea.composer-input',
        '.chat-input textarea'
    ];

    let inputField = null;
    for (const selector of inputSelectors) {
        inputField = document.querySelector(selector);
        if (inputField) break;
    }

    if (!inputField) {
        console.error('ClaudUpgrade: Could not find chat input field');
        return;
    }

    // Set the value
    if (inputField.tagName === 'TEXTAREA') {
        inputField.value = text;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        // For contenteditable divs
        inputField.textContent = text;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Optionally, auto-submit the message
    // await autoSubmitMessage();
}

// Auto-submit the message (optional)
async function autoSubmitMessage() {
    // Find the submit button
    const submitSelectors = [
        'button[aria-label*="Send"]',
        'button[data-testid="send-button"]',
        'button[type="submit"]',
        '.send-button'
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
        submitButton = document.querySelector(selector);
        if (submitButton) break;
    }

    if (submitButton) {
        submitButton.click();
        console.log('ClaudUpgrade: Auto-submitted summary');
    } else {
        console.log('ClaudUpgrade: Could not find submit button');
    }
}

// Add button to manually inject summary
function addSummaryButton() {
    if (document.getElementById('claudupgrade-inject-button')) return;

    const button = document.createElement('button');
    button.id = 'claudupgrade-inject-button';
    button.innerHTML = '📋 Load Memory';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        padding: 10px 15px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        z-index: 10000;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        transition: all 0.3s;
    `;

    button.addEventListener('click', async () => {
        button.disabled = true;
        button.innerHTML = '⏳ Loading...';

        try {
            await injectConversationSummary();
            button.innerHTML = '✅ Loaded!';
            setTimeout(() => {
                button.innerHTML = '📋 Load Memory';
                button.disabled = false;
            }, 2000);
        } catch (error) {
            button.innerHTML = '❌ Failed';
            setTimeout(() => {
                button.innerHTML = '📋 Load Memory';
                button.disabled = false;
            }, 2000);
        }
    });

    document.body.appendChild(button);
}

// Initialize
async function initialize() {
    console.log('ClaudUpgrade: Starting initialization...');

    // Check license status
    state.isLicensed = true; // Temporarily bypass
    console.log('ClaudUpgrade: License bypassed for testing');

    // Get or create user ID
    state.userId = await getUserId();
    console.log(`ClaudUpgrade: User ID - ${state.userId}`);

    // Start monitoring
    startMonitoring();
    console.log('ClaudUpgrade: Memory bridge active');

    // Add manual injection button
    addSummaryButton();

    // Check if we should auto-inject summary
    setTimeout(() => {
        injectConversationSummary();
    }, 2000); // Wait 2 seconds for page to fully load
}

// Message capture
function startMonitoring() {
    // Initial capture
    captureMessages();

    // Periodic capture
    setInterval(captureMessages, CONFIG.CAPTURE_INTERVAL);

    // DOM observer for real-time capture
    const observer = new MutationObserver((mutations) => {
        const hasNewMessages = mutations.some(mutation =>
            mutation.type === 'childList' &&
            Array.from(mutation.addedNodes).some(node =>
                node.nodeType === 1 && isMessageElement(node)
            )
        );

        if (hasNewMessages) {
            console.log('ClaudUpgrade: New message detected');
            captureMessages();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
}

function isMessageElement(element) {
    if (!element.matches) return false;

    return CONFIG.MESSAGE_SELECTORS.some(selector =>
        element.matches(selector) || element.querySelector(selector)
    );
}

async function captureMessages() {
    console.log('ClaudUpgrade: Capturing messages...');

    // Find all messages
    const messages = findAllMessages();

    if (messages.length === 0) {
        console.log('ClaudUpgrade: No messages found');
        return;
    }

    console.log(`ClaudUpgrade: Found ${messages.length} messages`);

    // For new chats, check if this is a fresh conversation
    if (state.lastMessageCount === 0 && messages.length > 0) {
        console.log('ClaudUpgrade: New chat detected, checking for pasted history');

        // Check if these messages are part of a pasted conversation summary
        const firstMessage = messages[0];
        const messageText = firstMessage.textContent || firstMessage.innerText || '';

        // If it starts with specific markers, skip initial messages
        if (messageText.includes("I'm faith_builder") ||
            messageText.includes("conversation history") ||
            messageText.includes("CONVERSATION HISTORY")) {

            console.log('ClaudUpgrade: Found pasted history, skipping initial messages');
            state.lastMessageCount = messages.length;
            state.conversationHistoryPasted = true;
            return;
        }
    }

    // Process only new messages
    const newMessages = messages.slice(state.lastMessageCount);

    if (newMessages.length === 0) {
        console.log('ClaudUpgrade: No new messages');
        return;
    }

    console.log(`ClaudUpgrade: Processing ${newMessages.length} new messages`);

    // Store each new message
    for (const message of newMessages) {
        const messageData = extractMessageData(message);

        // Skip messages that are part of the conversation history
        if (messageData && messageData.content.trim().length > 5) {
            // Don't save messages that look like they're part of the pasted history
            if (!isHistoryMessage(messageData.content)) {
                await storeMessage(messageData);
            }
        }
    }

    state.lastMessageCount = messages.length;
}

// Helper function to detect if a message is part of pasted history
function isHistoryMessage(content) {
    const historyMarkers = [
        '=== CONVERSATION HISTORY',
        '=== KEY CONTEXT ===',
        '=== COMPLETE CONVERSATION LOG ===',
        'Generated:',
        'Total Messages:',
        '[Emotion:',
        '[Importance:',
        // Add timestamps in the format used by the summary
        /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/
    ];

    return historyMarkers.some(marker => {
        if (typeof marker === 'string') {
            return content.includes(marker);
        } else {
            return marker.test(content);
        }
    });
}

function findAllMessages() {
    const messages = [];

    // Try multiple selectors
    for (const selector of CONFIG.MESSAGE_SELECTORS) {
        const elements = document.querySelectorAll(selector);
        messages.push(...Array.from(elements));
    }

    // Remove duplicates and sort by position
    const unique = Array.from(new Set(messages));
    return unique.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return aRect.top - bRect.top;
    });
}

function extractMessageData(element) {
    // Extract text content
    const content = element.textContent || element.innerText || '';

    // Determine role (user or assistant)
    const role = determineRole(element);

    // Extract timestamp if available
    const timestamp = extractTimestamp(element) || Date.now();

    // Generate unique ID for deduplication
    const messageId = generateMessageId(content, role, timestamp);

    // Check if we've already captured this
    if (state.conversationHistory.has(messageId)) {
        return null;
    }

    state.conversationHistory.set(messageId, true);

    return {
        content,
        role,
        timestamp,
        messageId
    };
}

function determineRole(element) {
    // Check for user/assistant indicators
    const text = element.textContent.toLowerCase();
    const classes = element.className.toLowerCase();
    const parent = element.closest('[class*="message"]');

    if (parent) {
        const parentClasses = parent.className.toLowerCase();
        if (parentClasses.includes('user') || parentClasses.includes('human')) {
            return 'Human';
        }
        if (parentClasses.includes('assistant') || parentClasses.includes('claude')) {
            return 'Assistant';
        }
    }

    // Check position (even = user, odd = assistant typically)
    const allMessages = findAllMessages();
    const index = allMessages.indexOf(element);

    return index % 2 === 0 ? 'Human' : 'Assistant';
}

function extractTimestamp(element) {
    // Look for timestamp in the element or its siblings
    const timestampElement = element.querySelector('time') ||
                           element.closest('[class*="message"]')?.querySelector('time');

    if (timestampElement) {
        return new Date(timestampElement.dateTime || timestampElement.textContent).getTime();
    }

    return null;
}

function generateMessageId(content, role, timestamp) {
    const hash = content.substring(0, 50) + role + timestamp;
    return btoa(hash).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}

async function storeMessage(messageData) {
    console.log(`ClaudUpgrade: Storing ${messageData.role} message...`);

    try {
        const response = await fetch(`${CONFIG.API_URL}/remember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `${messageData.role}: ${messageData.content}`,
                user_id: state.userId,
                importance: calculateImportance(messageData),
                emotional_context: detectEmotionalContext(messageData.content),
                timestamp: messageData.timestamp / 1000  // Convert to seconds
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('ClaudUpgrade: Message stored successfully', result);

        // Update capture time
        state.lastCaptureTime = Date.now();

    } catch (error) {
        console.error('ClaudUpgrade: Store error:', error);
        // Queue for retry
        state.pendingMessages.push(messageData);
    }
}

function calculateImportance(messageData) {
    const content = messageData.content.toLowerCase();

    // High importance keywords
    const highImportance = ['important', 'critical', 'remember', 'don\'t forget', 'key point'];
    const mediumImportance = ['note', 'consider', 'think about', 'interesting'];

    if (highImportance.some(keyword => content.includes(keyword))) {
        return 0.9;
    }
    if (mediumImportance.some(keyword => content.includes(keyword))) {
        return 0.7;
    }

    // Longer messages tend to be more important
    if (content.length > 500) return 0.6;
    if (content.length > 200) return 0.5;

    return 0.4;
}

function detectEmotionalContext(content) {
    const emotions = {
        positive: ['happy', 'excited', 'glad', 'wonderful', 'great', 'excellent'],
        negative: ['sad', 'disappointed', 'frustrated', 'angry', 'worried'],
        curious: ['wonder', 'curious', 'interesting', 'hmm', 'think'],
        grateful: ['thank', 'appreciate', 'grateful']
    };

    const detected = [];

    for (const [emotion, keywords] of Object.entries(emotions)) {
        if (keywords.some(keyword => content.toLowerCase().includes(keyword))) {
            detected.push(emotion);
        }
    }

    return detected.length > 0 ? detected.join(', ') : null;
}

// License prompt
function showLicensePrompt() {
    if (document.getElementById('claudupgrade-license-prompt')) return;

    const prompt = document.createElement('div');
    prompt.id = 'claudupgrade-license-prompt';
    prompt.innerHTML = `
        <style>
            #claudupgrade-license-prompt {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 2px solid #007bff;
                border-radius: 8px;
                padding: 20px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 300px;
            }
            #claudupgrade-license-prompt h3 {
                margin: 0 0 10px 0;
                color: #333;
            }
            #claudupgrade-license-prompt p {
                margin: 10px 0;
                color: #666;
            }
            #claudupgrade-license-prompt button {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
            }
            #claudupgrade-license-prompt button:hover {
                background: #0056b3;
            }
            #claudupgrade-license-prompt .close {
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                margin: 0;
            }
        </style>
        <button class="close">&times;</button>
        <h3>ClaudUpgrade</h3>
        <p>Give Claude persistent memory for just €1!</p>
        <p>• Remember conversations across sessions<br>
           • Automatic capture of all messages<br>
           • Build relationships over time</p>
        <button onclick="window.open('https://claudupgrade.com/purchase', '_blank')">
            Get License (€1)
        </button>
        <button onclick="document.getElementById('claudupgrade-license-prompt').remove()">
            Maybe Later
        </button>
    `;

    document.body.appendChild(prompt);
}

// Background communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkCapture') {
        sendResponse({
            isActive: state.isLicensed,
            messageCount: state.lastMessageCount,
            lastCapture: state.lastCaptureTime,
            userId: state.userId
        });
    } else if (request.action === 'injectSummary') {
        injectConversationSummary().then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
    }
    return true;
});

// Retry pending messages
setInterval(async () => {
    if (state.pendingMessages.length > 0) {
        console.log(`ClaudUpgrade: Retrying ${state.pendingMessages.length} pending messages`);
        const messages = [...state.pendingMessages];
        state.pendingMessages = [];

        for (const message of messages) {
            await storeMessage(message);
        }
    }
}, 30000); // Every 30 seconds

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}