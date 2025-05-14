# api_bridge.py - Enhanced with monetization and better tracking
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from core.memory import MemorySystem
import uvicorn
from typing import Optional, List
from datetime import datetime, timedelta
import hmac
import hashlib
import secrets
import json
import redis
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import stripe

# Configuration
REDIS_URL = "redis://localhost:6379"
DATABASE_URL = "sqlite:///./claudupgrade.db"
STRIPE_SECRET_KEY = "your_stripe_secret_key"
LICENSE_PRICE_EUR = 100  # €1.00 in cents
HMAC_SECRET = secrets.token_hex(32)

# Initialize
app = FastAPI(title="ClaudUpgrade API", version="2.0")
security = HTTPBearer()
stripe.api_key = STRIPE_SECRET_KEY

# Initialize Redis with fallback
try:
    redis_client = redis.from_url(REDIS_URL)
    redis_client.ping()
    redis_enabled = True
except:
    redis_client = None
    redis_enabled = False
    print("Redis not available, using database only")

memory_system = MemorySystem()

# Database setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class License(Base):
    __tablename__ = "licenses"

    key = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    stripe_session_id = Column(String)

Base.metadata.create_all(bind=engine)

# Pydantic models
class MemoryRequest(BaseModel):
    content: str
    user_id: str
    importance: float = 0.5
    emotional_context: Optional[str] = None
    timestamp: Optional[float] = None
    metadata: Optional[dict] = None

class LicenseRequest(BaseModel):
    email: str
    success_url: str
    cancel_url: str

class LicenseValidation(BaseModel):
    key: str

class ConversationSummaryRequest(BaseModel):
    user_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    include_metadata: bool = True

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://claude.ai", "chrome-extension://*", "http://localhost:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependencies
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# API Routes
@app.get("/")
async def root():
    return {
        "message": "ClaudUpgrade API v2.0",
        "features": ["Persistent Memory", "License Management", "Conversation Tracking"],
        "redis_enabled": redis_enabled
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": "connected",
        "redis": "connected" if redis_enabled else "disabled"
    }

# Memory endpoints
@app.post("/remember")
async def create_memory(memory: MemoryRequest):
    """Store a new memory with enhanced metadata"""
    try:
        # Use provided timestamp or generate new one
        timestamp = memory.timestamp or datetime.now().timestamp()

        # Store in database
        stored_timestamp = memory_system.remember(
            content=memory.content,
            user_id=memory.user_id,
            importance=memory.importance,
            emotional_context=memory.emotional_context,
            metadata=memory.metadata,
            timestamp=timestamp
        )

        # Also store in Redis for fast retrieval (if available)
        if redis_enabled:
            try:
                redis_key = f"conversation:{memory.user_id}:{datetime.now().strftime('%Y%m%d')}"
                redis_client.rpush(redis_key, json.dumps({
                    "content": memory.content,
                    "timestamp": stored_timestamp,
                    "importance": memory.importance,
                    "emotional_context": memory.emotional_context
                }))
                redis_client.expire(redis_key, 86400 * 30)  # 30 days
            except Exception as e:
                print(f"Redis error (non-critical): {e}")

        return {
            "status": "success",
            "timestamp": stored_timestamp,
            "message": "Memory stored successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recall/{user_id}")
async def get_memories(
    user_id: str,
    limit: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Retrieve memories with date filtering"""
    try:
        # Parse dates if provided
        start = datetime.fromisoformat(start_date) if start_date else None
        // popup.js - Enhanced with license management and better UI
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:8000';

    // State
    let state = {
        isLicensed: false,
        userId: null,
        apiConnected: false,
        captureActive: false,
        messageCount: 0,
        lastCapture: null
    };

    // Elements
    const elements = {
        loading: document.getElementById('loading'),
        mainContent: document.getElementById('main-content'),
        licenseStatus: document.getElementById('license-status'),
        apiStatus: document.getElementById('api-status'),
        apiIndicator: document.getElementById('api-indicator'),
        captureStatus: document.getElementById('capture-status'),
        captureIndicator: document.getElementById('capture-indicator'),
        messageCount: document.getElementById('message-count'),
        lastCapture: document.getElementById('last-capture'),
        userId: document.getElementById('user-id'),
        totalMemories: document.getElementById('total-memories'),
        memoryList: document.getElementById('memory-list'),
        purchaseButton: document.getElementById('purchase-license'),
        enterLicenseButton: document.getElementById('enter-license')
    };

    // Initialize
    await initialize();

    async function initialize() {
        try {
            // Check license
            const { licenseKey } = await chrome.storage.sync.get(['licenseKey']);
            if (licenseKey) {
                state.isLicensed = await validateLicense(licenseKey);
            }

            // Get user ID
            const { userId } = await chrome.storage.local.get(['userId']);
            state.userId = userId;

            // Check API connection
            state.apiConnected = await checkAPIConnection();

            // Get capture status
            const captureData = await getCaptureStatus();
            if (captureData) {
                state.captureActive = captureData.isActive;
                state.messageCount = captureData.messageCount;
                state.lastCapture = captureData.lastCapture;
            }

            updateUI();

        } catch (error) {
            console.error('Initialization error:', error);
            showError('Failed to initialize extension');
        } finally {
            elements.loading.style.display = 'none';
            elements.mainContent.style.display = 'block';
        }
    }

    // License management
    async function validateLicense(key) {
        try {
            const response = await fetch(`${API_URL}/validate_license`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key })
            });

            const data = await response.json();
            return data.valid;
        } catch (error) {
            console.error('License validation error:', error);
            return false;
        }
    }

    function updateLicenseUI() {
        if (state.isLicensed) {
            elements.licenseStatus.className = 'license-status valid';
            elements.licenseStatus.innerHTML = `
                <h3>License Status</h3>
                <div class="license-info">
                    <span class="icon">✓</span>
                    Licensed - Memory capture enabled
                </div>
            `;
            elements.purchaseButton.style.display = 'none';
            elements.enterLicenseButton.style.display = 'none';
        } else {
            elements.licenseStatus.className = 'license-status invalid';
            elements.licenseStatus.innerHTML = `
                <h3>License Status</h3>
                <div class="license-info">
                    <span class="icon">⚠</span>
                    No valid license - Memory capture disabled
                </div>
            `;
            elements.purchaseButton.style.display = 'block';
            elements.enterLicenseButton.style.display = 'block';
        }
    }

    // API connection
    async function checkAPIConnection() {
        try {
            const response = await fetch(`${API_URL}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Capture status
    async function getCaptureStatus() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.url?.includes('claude.ai')) {
                const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'checkCapture' });
                return response;
            }
        } catch (error) {
            console.error('Capture status error:', error);
        }
        return null;
    }

    // UI updates
    function updateUI() {
        updateLicenseUI();

        // API status
        elements.apiStatus.textContent = state.apiConnected ? 'Connected' : 'Disconnected';
        elements.apiIndicator.className = `status-indicator ${state.apiConnected ? 'active' : 'inactive'}`;

        // Capture status
        elements.captureStatus.textContent = state.captureActive ? 'Active' : 'Inactive';
        elements.captureIndicator.className = `status-indicator ${state.captureActive ? 'active' : 'inactive'}`;

        // Message count
        elements.messageCount.textContent = state.messageCount;

        // Last capture
        if (state.lastCapture) {
            const date = new Date(state.lastCapture);
            elements.lastCapture.textContent = formatTime(date);
        } else {
            elements.lastCapture.textContent = 'Never';
        }

        // User ID
        elements.userId.textContent = state.userId || 'Not set';
    }

    // Memory loading
    async function loadMemories() {
        if (!state.userId) {
            showError('No user ID set');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/recall/${state.userId}?limit=10`);
            const data = await response.json();

            elements.totalMemories.textContent = data.count;
            displayMemories(data.memories);

        } catch (error) {
            console.error('Load memories error:', error);
            showError('Failed to load memories');
        }
    }

    function displayMemories(memories) {
        elements.memoryList.innerHTML = '';
        elements.memoryList.style.display = 'block';

        if (memories.length === 0) {
            elements.memoryList.innerHTML = '<div class="loading">No memories found</div>';
            return;
        }

        memories.forEach(memory => {
            const div = document.createElement('div');
            div.className = 'memory-item';

            const timestamp = new Date(memory.timestamp * 1000);
            const content = memory.content.substring(0, 200) + (memory.content.length > 200 ? '...' : '');

            div.innerHTML = `
                <div class="timestamp">${formatTime(timestamp)}</div>
                <div class="content">${escapeHtml(content)}</div>
                <div class="meta">
                    <span>Importance: ${(memory.importance * 100).toFixed(0)}%</span>
                    ${memory.emotional_context ? `<span>Emotion: ${memory.emotional_context}</span>` : ''}
                </div>
            `;

            elements.memoryList.appendChild(div);
        });
    }

    // Summary generation
    async function generateSummary() {
        if (!state.userId) {
            showError('No user ID set');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/summarize_conversation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: state.userId,
                    include_metadata: true
                })
            });

            const data = await response.json();

            // Create and download summary
            const blob = new Blob([data.summary_text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `claude_conversation_${state.userId}_${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);

            showSuccess('Summary downloaded successfully');

        } catch (error) {
            console.error('Summary generation error:', error);
            showError('Failed to generate summary');
        }
    }

    // Event handlers
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;

            // Update tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            e.target.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    document.getElementById('test-connection').addEventListener('click', async () => {
        const connected = await checkAPIConnection();
        if (connected) {
            showSuccess('Connection successful!');
        } else {
            showError('Connection failed');
        }
    });

    document.getElementById('load-memories').addEventListener('click', loadMemories);
    document.getElementById('generate-summary').addEventListener('click', generateSummary);

    document.getElementById('purchase-license').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://claudupgrade.com/purchase' });
    });

    document.getElementById('enter-license').addEventListener('click', async () => {
        const key = prompt('Enter your license key:');
        if (key) {
            const valid = await validateLicense(key);
            if (valid) {
                await chrome.storage.sync.set({ licenseKey: key });
                state.isLicensed = true;
                updateUI();
                showSuccess('License activated successfully!');
            } else {
                showError('Invalid license key');
            }
        }
    });

    document.getElementById('clear-data').addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all local data?')) {
            await chrome.storage.local.clear();
            showSuccess('Local data cleared');
            setTimeout(() => location.reload(), 1000);
        }
    });

    document.getElementById('export-memories').addEventListener('click', async () => {
        if (!state.userId) {
            showError('No user ID set');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/recall/${state.userId}?limit=10000`);
            const data = await response.json();

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `claude_memories_${state.userId}_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            showSuccess('Memories exported successfully');

        } catch (error) {
            console.error('Export error:', error);
            showError('Failed to export memories');
        }
    });

    // Utility functions
    function formatTime(date) {
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;

        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        const error = document.createElement('div');
        error.className = 'error-message';
        error.textContent = message;
        elements.mainContent.insertBefore(error, elements.mainContent.firstChild);
        setTimeout(() => error.remove(), 5000);
    }

    function showSuccess(message) {
        const success = document.createElement('div');
        success.className = 'error-message';
        success.style.background = '#d4edda';
        success.style.border = '1px solid #c3e6cb';
        success.style.color = '#155724';
        success.textContent = message;
        elements.mainContent.insertBefore(success, elements.mainContent.firstChild);
        setTimeout(() => success.remove(), 5000);
    }

    // Auto-refresh
    setInterval(async () => {
        state.apiConnected = await checkAPIConnection();
        const captureData = await getCaptureStatus();
        if (captureData) {
            state.captureActive = captureData.isActive;
            state.messageCount = captureData.messageCount;
            state.lastCapture = captureData.lastCapture;
        }
        updateUI();
    }, 5000);
});