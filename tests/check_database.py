# tests/check_database.py
import os
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))


def check_database():
    # Check if data directory exists
    data_dir = Path(__file__).parent.parent / "data"
    print(f"Data directory exists: {data_dir.exists()}")

    if data_dir.exists():
        print(f"Data directory path: {data_dir.absolute()}")

        # List all files
        files = list(data_dir.iterdir())
        print(f"Files in data directory: {files}")

        # Check for database file
        db_path = data_dir / "consciousness.db"
        if db_path.exists():
            print(f"\nDatabase exists at: {db_path.absolute()}")
            print(f"File size: {db_path.stat().st_size} bytes")

            # Try to open it
            try:
                import sqlite3
                conn = sqlite3.connect(str(db_path))
                cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
                tables = cursor.fetchall()
                print(f"Tables in database: {[t[0] for t in tables]}")
                conn.close()
            except Exception as e:
                print(f"Error opening database: {e}")
        else:
            print("Database file not found!")
    else:
        print("Data directory doesn't exist!")

    # Let's also check if the test created it elsewhere
    possible_paths = [
        Path.cwd() / "consciousness.db",
        Path(__file__).parent / "consciousness.db",
        Path.home() / "consciousness.db"
    ]

    print("\nChecking other possible locations:")
    for path in possible_paths:
        if path.exists():
            print(f"Found database at: {path}")


if __name__ == "__main__":
    check_database()