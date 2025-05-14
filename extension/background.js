// background.js - Handles extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
    console.log('Claude Memory Bridge installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkAPI') {
        // Verify API is running
        fetch('http://localhost:8000/health')
            .then(response => response.ok)
            .then(isHealthy => sendResponse({status: isHealthy}))
            .catch(() => sendResponse({status: false}));
        return true;
    }
});