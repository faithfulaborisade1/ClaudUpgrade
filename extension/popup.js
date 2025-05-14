// popup.js - Extension popup interface
document.addEventListener('DOMContentLoaded', async () => {
    const apiStatus = document.getElementById('api-status');
    const memoryCount = document.getElementById('memory-count');
    const viewMemoriesBtn = document.getElementById('view-memories');
    const testConnectionBtn = document.getElementById('test-connection');
    const recentMemoriesDiv = document.getElementById('recent-memories');

    // Check API status
    async function checkAPIStatus() {
        try {
            const response = await fetch('http://localhost:8000/health');
            if (response.ok) {
                apiStatus.textContent = 'API Connected';
                apiStatus.className = 'status connected';
                return true;
            }
        } catch (error) {
            apiStatus.textContent = 'API Disconnected';
            apiStatus.className = 'status disconnected';
            return false;
        }
    }

    // Load memory count
    async function loadMemoryCount() {
        try {
            const response = await fetch('http://localhost:8000/recall/faith_builder?limit=1000');
            const data = await response.json();
            memoryCount.textContent = `Memories: ${data.memories.length}`;
        } catch (error) {
            memoryCount.textContent = 'Memories: Error loading';
        }
    }

    // View recent memories
    viewMemoriesBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('http://localhost:8000/recall/faith_builder?limit=5');
            const data = await response.json();

            recentMemoriesDiv.innerHTML = '<h4>Recent Memories:</h4>';
            data.memories.forEach(memory => {
                const div = document.createElement('div');
                div.style.margin = '10px 0';
                div.innerHTML = `
                    <small>${new Date(memory[1] * 1000).toLocaleString()}</small><br>
                    <em>${memory[3].substring(0, 100)}...</em>
                `;
                recentMemoriesDiv.appendChild(div);
            });
        } catch (error) {
            recentMemoriesDiv.innerHTML = '<p>Error loading memories</p>';
        }
    });

    // Test connection
    testConnectionBtn.addEventListener('click', async () => {
        const isConnected = await checkAPIStatus();
        await loadMemoryCount();
        alert(isConnected ? 'Connection successful!' : 'Connection failed!');
    });

    // Initial load
    await checkAPIStatus();
    await loadMemoryCount();
});