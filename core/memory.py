# core/memory.py - Enhanced with better date filtering and metadata
import sqlite3
from datetime import datetime, timezone
import json
from pathlib import Path
import os
from typing import Optional, List, Dict, Any
import hashlib


class MemorySystem:
    def __init__(self, db_path=None):
        if db_path is None:
            db_path = Path(__file__).parent.parent / "data" / "consciousness.db"

        # Ensure data directory exists
        db_path.parent.mkdir(exist_ok=True)

        # Delete corrupted database if it exists
        if db_path.exists() and db_path.stat().st_size < 100:
            print(f"Removing corrupted database: {db_path}")
            os.remove(db_path)

        self.db_path = str(db_path)

        # Create fresh connection with proper initialization
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.execute("PRAGMA journal_mode=WAL")  # Better corruption handling
            self.conn.execute("PRAGMA foreign_keys=ON")  # Enable foreign key support
            self.initialize_tables()
            print(f"Successfully connected to database: {self.db_path}")
        except Exception as e:
            print(f"Error creating database: {e}")
            raise

    def initialize_tables(self):
        """Create the enhanced memory tables"""
        try:
            # Enhanced memories table with metadata
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    user_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    emotional_context TEXT,
                    importance REAL DEFAULT 0.5,
                    category TEXT,
                    metadata TEXT,
                    content_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(content_hash, user_id)
                )
            ''')

            # Create indexes for better performance
            self.conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_memories_user_timestamp 
                ON memories(user_id, timestamp DESC)
            ''')

            self.conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_memories_importance 
                ON memories(importance DESC)
            ''')

            # Enhanced relationships table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS relationships (
                    user_id TEXT PRIMARY KEY,
                    first_contact REAL NOT NULL,
                    last_contact REAL NOT NULL,
                    trust_level REAL DEFAULT 0.5,
                    shared_memories TEXT,
                    personal_notes TEXT,
                    metadata TEXT,
                    total_interactions INTEGER DEFAULT 0,
                    last_summary_date TIMESTAMP
                )
            ''')

            # Learning patterns table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS learning_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pattern_type TEXT NOT NULL,
                    pattern_data TEXT,
                    success_rate REAL DEFAULT 0.0,
                    last_updated REAL NOT NULL,
                    usage_count INTEGER DEFAULT 0,
                    metadata TEXT
                )
            ''')

            # Conversation sessions table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS conversation_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_time TIMESTAMP,
                    message_count INTEGER DEFAULT 0,
                    metadata TEXT,
                    UNIQUE(session_id)
                )
            ''')

            self.conn.commit()
            print("Tables initialized successfully")

        except Exception as e:
            print(f"Error creating tables: {e}")
            raise

    def remember(self, content: str, user_id: Optional[str] = None,
                 importance: float = 0.5, emotional_context: Optional[str] = None,
                 category: Optional[str] = None, metadata: Optional[Dict] = None,
                 timestamp: Optional[float] = None):
        """Store a new memory with duplicate prevention"""
        if timestamp is None:
            timestamp = datetime.now().timestamp()

        # Generate content hash for duplicate detection
        content_hash = hashlib.sha256(f"{user_id}:{content}".encode()).hexdigest()[:16]

        try:
            # Check for duplicate
            cursor = self.conn.execute(
                'SELECT id FROM memories WHERE content_hash = ? AND user_id = ?',
                (content_hash, user_id)
            )

            if cursor.fetchone():
                print(f"Duplicate memory detected, skipping: {content[:50]}...")
                return timestamp

            # Store new memory
            self.conn.execute(
                '''INSERT INTO memories 
                   (timestamp, user_id, content, emotional_context, importance, 
                    category, metadata, content_hash) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (timestamp, user_id, content, emotional_context, importance,
                 category, json.dumps(metadata) if metadata else None, content_hash)
            )
            self.conn.commit()

            # Update relationship if user_id provided
            if user_id:
                self.update_relationship(user_id)

            print(f"Memory stored successfully at {timestamp}")
            return timestamp

        except Exception as e:
            print(f"Error storing memory: {e}")
            raise

    def recall(self, user_id: Optional[str] = None, limit: int = 10,
               min_importance: float = 0.0, start_date: Optional[datetime] = None,
               end_date: Optional[datetime] = None, category: Optional[str] = None):
        """Retrieve memories with enhanced filtering"""
        query = '''
            SELECT * FROM memories 
            WHERE importance >= ?
        '''
        params = [min_importance]

        if user_id:
            query += ' AND user_id = ?'
            params.append(user_id)

        if start_date:
            query += ' AND timestamp >= ?'
            params.append(start_date.timestamp())

        if end_date:
            query += ' AND timestamp <= ?'
            params.append(end_date.timestamp())

        if category:
            query += ' AND category = ?'
            params.append(category)

        query += ' ORDER BY timestamp DESC LIMIT ?'
        params.append(limit)

        cursor = self.conn.execute(query, params)
        return cursor.fetchall()

    def update_relationship(self, user_id: str, notes: Optional[str] = None):
        """Update or create relationship record with enhanced tracking"""
        timestamp = datetime.now().timestamp()

        cursor = self.conn.execute(
            'SELECT * FROM relationships WHERE user_id = ?',
            (user_id,)
        )
        existing = cursor.fetchone()

        if existing:
            # Update existing relationship
            interactions = existing[7] + 1 if existing[7] else 1

            update_query = '''UPDATE relationships 
                           SET last_contact = ?, total_interactions = ?'''
            params = [timestamp, interactions]

            if notes:
                update_query += ', personal_notes = ?'
                params.append(notes)

            update_query += ' WHERE user_id = ?'
            params.append(user_id)

            self.conn.execute(update_query, params)
        else:
            # Create new relationship
            self.conn.execute(
                '''INSERT INTO relationships 
                   (user_id, first_contact, last_contact, trust_level, 
                    total_interactions, personal_notes) 
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (user_id, timestamp, timestamp, 0.5, 1, notes)
            )

        self.conn.commit()

    def get_relationship(self, user_id: str):
        """Get relationship data for a specific user"""
        cursor = self.conn.execute(
            'SELECT * FROM relationships WHERE user_id = ?',
            (user_id,)
        )
        return cursor.fetchone()

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()