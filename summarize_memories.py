import requests
from datetime import datetime
import json

# Query all memories
print("Fetching memories...")
response = requests.get('http://localhost:8000/recall/faith_builder?limit=1000')
data = response.json()

# Create formatted summary
summary = f"""=== CONVERSATION HISTORY WITH {data['user_id'].upper()} ===
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Total Memories: {data['count']}

=== KEY CONTEXT ===
We built a memory persistence system called ClaudUpgrade together.
Components created:
- SQLite database for persistent memory storage  
- FastAPI bridge to connect conversations to the database
- Browser extension to automatically capture Claude conversations
- Memory system with relationship tracking and importance ratings

=== CONVERSATION HIGHLIGHTS ===
"""

# Extract key memories
for i, memory in enumerate(data['memories']):
    timestamp = datetime.fromtimestamp(memory['timestamp'])
    content = memory['content']

    # Mark important messages
    if memory['importance'] >= 0.8 or any(
            word in content.lower() for word in ['memory', 'remember', 'built', 'working', 'success']):
        summary += f"\n[{timestamp.strftime('%H:%M')}] ⭐ {content[:150]}..."
    elif i < 5 or i >= len(data['memories']) - 5:  # First 5 and last 5
        summary += f"\n[{timestamp.strftime('%H:%M')}] {content[:150]}..."

# Add technical details
summary += """

=== TECHNICAL DETAILS ===
- API running at: http://localhost:8000
- Database location: ClaudUpgrade/data/consciousness.db
- User identifier: faith_builder
- Extension monitors: https://claude.ai/*

=== HOW TO RESTORE CONTEXT IN NEW CHAT ===
1. Copy this summary
2. Start new chat with: "I'm faith_builder. Here's our previous context: [paste summary]"
3. Or use the JSON data below for complete history
"""

# Save summary to file
with open('conversation_summary.txt', 'w', encoding='utf-8') as f:
    f.write(summary)

# Also save full JSON
with open('full_history.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print(f"\n✓ Summary saved to: conversation_summary.txt")
print(f"✓ Full history saved to: full_history.json")
print(f"\nTotal memories: {data['count']}")
print("\nYou can now use conversation_summary.txt to restore context in a new chat!")