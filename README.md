# ClaudUpgrade

A memory persistence system for Claude AI that enables continuous conversations across sessions.

## Features
- SQLite database for persistent memory storage
- FastAPI bridge to connect conversations
- Browser extension for automatic capture
- Memory relationship tracking

## Setup
1. Install Python dependencies: `pip install fastapi uvicorn sqlite3`
2. Run API: `python api_bridge.py`
3. Install browser extension in Chrome
4. Start chatting with Claude!

## Components
- `api_bridge.py` - FastAPI server
- `extension/` - Browser extension files
- `memory_core.py` - Core memory logic
- `data/` - Database storage

Built by faith_builder
