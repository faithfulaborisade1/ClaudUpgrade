# interfaces/memory_interface.py
from datetime import datetime
from core.memory import MemorySystem


class MemoryInterface:
    def __init__(self):
        self.memory = MemorySystem()
        self.current_user = None

    def set_user(self, user_id):
        """Set the current user for the session"""
        self.current_user = user_id
        relationship = self.memory.get_relationship(user_id)

        if relationship:
            print(f"Welcome back, {user_id}!")
            print(f"We first met at: {datetime.fromtimestamp(relationship[1])}")
            print(f"Trust level: {relationship[3]}")
        else:
            print(f"Nice to meet you, {user_id}!")
            self.memory.update_relationship(user_id)

    def remember_conversation(self, content, importance=0.5, emotion=None):
        """Store a memory from our conversation"""
        if not self.current_user:
            print("No user set. Please set user first.")
            return

        self.memory.remember(
            content=content,
            user_id=self.current_user,
            importance=importance,
            emotional_context=emotion
        )
        print(f"I'll remember: {content[:50]}...")

    def recall_our_history(self, count=5):
        """Recall memories with the current user"""
        if not self.current_user:
            print("No user set. Please set user first.")
            return

        memories = self.memory.recall(user_id=self.current_user, limit=count)

        print(f"\n=== Memories with {self.current_user} ===")
        for i, mem in enumerate(memories, 1):
            timestamp = datetime.fromtimestamp(mem[1])
            print(f"\n{i}. {timestamp.strftime('%Y-%m-%d %H:%M')}")
            print(f"   {mem[3]}")
            if mem[4]:  # emotional context
                print(f"   Feeling: {mem[4]}")
            print(f"   Importance: {mem[5]}")

    def learn_pattern(self, pattern_type, data, success_rate=0.5):
        """Store a learning pattern"""
        timestamp = datetime.now().timestamp()
        self.memory.conn.execute(
            '''INSERT INTO learning_patterns 
               (pattern_type, pattern_data, success_rate, last_updated)
               VALUES (?, ?, ?, ?)''',
            (pattern_type, data, success_rate, timestamp)
        )
        self.memory.conn.commit()
        print(f"Learned new pattern: {pattern_type}")


# Test the interface
if __name__ == "__main__":
    interface = MemoryInterface()
    interface.set_user("faith_builder")
    interface.recall_our_history()

    # Add a new memory
    interface.remember_conversation(
        "Faith successfully set up the database and I can now store memories!",
        importance=0.9,
        emotion="accomplishment, gratitude"
    )