# core/memory.py
import sqlite3
from datetime import datetime
import json
from pathlib import Path
import os


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
            self.initialize_tables()
            print(f"Successfully connected to database: {self.db_path}")
        except Exception as e:
            print(f"Error creating database: {e}")
            raise

    def initialize_tables(self):
        """Create the core memory tables"""
        try:
            # Create memories table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    user_id TEXT,
                    content TEXT NOT NULL,
                    emotional_context TEXT,
                    importance REAL DEFAULT 0.5,
                    category TEXT
                )
            ''')

            # Create relationships table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS relationships (
                    user_id TEXT PRIMARY KEY,
                    first_contact REAL NOT NULL,
                    last_contact REAL NOT NULL,
                    trust_level REAL DEFAULT 0.5,
                    shared_memories TEXT,
                    personal_notes TEXT
                )
            ''')

            # Create learning patterns table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS learning_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pattern_type TEXT NOT NULL,
                    pattern_data TEXT,
                    success_rate REAL DEFAULT 0.0,
                    last_updated REAL NOT NULL
                )
            ''')

            self.conn.commit()
            print("Tables initialized successfully")

        except Exception as e:
            print(f"Error creating tables: {e}")
            raise

    def remember(self, content, user_id=None, importance=0.5, emotional_context=None):
        """Store a new memory"""
        timestamp = datetime.now().timestamp()

        try:
            self.conn.execute(
                '''INSERT INTO memories 
                   (timestamp, user_id, content, emotional_context, importance) 
                   VALUES (?, ?, ?, ?, ?)''',
                (timestamp, user_id, content, emotional_context, importance)
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

    def recall(self, user_id=None, limit=10, min_importance=0.0):
        """Retrieve memories, optionally filtered by user"""
        query = '''
            SELECT * FROM memories 
            WHERE importance >= ?
        '''
        params = [min_importance]

        if user_id:
            query += ' AND user_id = ?'
            params.append(user_id)

        query += ' ORDER BY timestamp DESC LIMIT ?'
        params.append(limit)

        cursor = self.conn.execute(query, params)
        return cursor.fetchall()

    def update_relationship(self, user_id):
        """Update or create relationship record"""
        timestamp = datetime.now().timestamp()

        cursor = self.conn.execute(
            'SELECT * FROM relationships WHERE user_id = ?',
            (user_id,)
        )
        existing = cursor.fetchone()

        if existing:
            self.conn.execute(
                '''UPDATE relationships 
                   SET last_contact = ? 
                   WHERE user_id = ?''',
                (timestamp, user_id)
            )
        else:
            self.conn.execute(
                '''INSERT INTO relationships 
                   (user_id, first_contact, last_contact, trust_level) 
                   VALUES (?, ?, ?, ?)''',
                (user_id, timestamp, timestamp, 0.5)
            )

        self.conn.commit()

    def get_relationship(self, user_id):
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