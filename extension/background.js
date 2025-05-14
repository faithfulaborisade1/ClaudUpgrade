// background.js - Service worker for Chrome extension
const API_URL = 'http://localhost:8000';
const PRODUCTION_API_URL = 'https://api.claudupgrade.com';

// State management
let state = {
    apiUrl: API_URL,
    isProduction: false,
    licenseValid: false,
    userId: null
};

// Initialize
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('ClaudUpgrade installed/updated:', details.reason);

    // Set default values
    await chrome.storage.local.set({
        apiUrl: API_URL,
        captureEnabled: true
    });

    // Check for license
    const { licenseKey } = await chrome.storage.sync.get(['licenseKey']);
    if (licenseKey) {
        validateLicense(licenseKey);
    }

    // Create context menu items
    chrome.contextMenus.create({
        id: 'claudupgrade-capture',
        title: 'Capture this conversation',
        contexts: ['page'],
        documentUrlPatterns: ['https://claude.ai/*']
    });
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender, sendResponse);
    return true; // Keep channel open for async response
});

async function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
        case 'getApiUrl':
            sendResponse(state.apiUrl);
            break;

        case 'validateLicense':
            const isValid = await validateLicense(request.key);
            sendResponse({ valid: isValid });
            break;

        case 'checkCapture':
            // Forward to content script
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.url?.includes('claude.ai')) {
                chrome.tabs.sendMessage(tabs[0].id, request, sendResponse);
            }
            break;

        case 'captureConversation':
            await captureCurrentConversation();
            sendResponse({ success: true });
            break;

        case 'exportMemories':
            await exportMemories(request.userId);
            sendResponse({ success: true });
            break;

        default:
            sendResponse({ error: 'Unknown action' });
    }
}

// License validation
async function validateLicense(key) {
    try {
        const response = await fetch(`${state.apiUrl}/validate_license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });

        const data = await response.json();
        state.licenseValid = data.valid;

        // Update badge
        updateBadge();

        return data.valid;
    } catch (error) {
        console.error('License validation error:', error);
        return false;
    }
}

// Badge management
function updateBadge() {
    if (state.licenseValid) {
        chrome.action.setBadgeText({ text: '' });
    } else {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    }
}

// Context menu handling
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'claudupgrade-capture') {
        await captureCurrentConversation();
    }
});

// Capture current conversation
async function captureCurrentConversation() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tabs[0]?.url?.includes('claude.ai')) {
        showNotification('Please navigate to Claude.ai first');
        return;
    }

    // Send capture command to content script
    chrome.tabs.sendMessage(tabs[0].id, { action: 'forceCapture' }, (response) => {
        if (response?.success) {
            showNotification('Conversation captured successfully');
        } else {
            showNotification('Failed to capture conversation');
        }
    });
}

// Export memories
async function exportMemories(userId) {
    try {
        const response = await fetch(`${state.apiUrl}/recall/${userId}?limit=10000`);
        const data = await response.json();

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `claude_memories_${userId}_${timestamp}.json`;

        // Create blob and download
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            console.log('Download started:', downloadId);
        });

        showNotification('Memories exported successfully');

    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export memories');
    }
}

// Notification helper
function showNotification(message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'ClaudUpgrade',
        message: message
    });
}

// Check API health periodically
setInterval(async () => {
    try {
        const response = await fetch(`${state.apiUrl}/health`);
        if (!response.ok) {
            console.error('API health check failed');
        }
    } catch (error) {
        console.error('API connection error:', error);
    }
}, 60000); // Every minute

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(() => {
    console.log('Update available - will install on next restart');
});

// Handle tab activation - check if we're on Claude.ai
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (tab.url?.includes('claude.ai')) {
        // Update badge to show active
        chrome.action.setBadgeText({ text: '●' });
        chrome.action.setBadgeBackgroundColor({ color: '#00FF00' });
    } else {
        updateBadge();
    }
});

// Handle startup
chrome.runtime.onStartup.addListener(async () => {
    // Restore state
    const stored = await chrome.storage.local.get(['apiUrl', 'userId']);
    state.apiUrl = stored.apiUrl || API_URL;
    state.userId = stored.userId;

    // Check license
    const { licenseKey } = await chrome.storage.sync.get(['licenseKey']);
    if (licenseKey) {
        await validateLicense(licenseKey);
    }
});

// Production/Development toggle
async function setProductionMode(enabled) {
    state.isProduction = enabled;
    state.apiUrl = enabled ? PRODUCTION_API_URL : API_URL;

    await chrome.storage.local.set({
        apiUrl: state.apiUrl,
        isProduction: enabled
    });

    console.log(`Switched to ${enabled ? 'production' : 'development'} mode`);
}