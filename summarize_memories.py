# summarize_memories.py - Enhanced with better conversation tracking
import requests
from datetime import datetime, timedelta
import json
import sys
from typing import Optional

API_URL = 'http://localhost:8000'


def generate_summary(user_id: str, hours: int = 24, output_format: str = 'text'):
    """Generate comprehensive conversation summary with all messages"""

    print(f"Fetching memories for {user_id}...")

    # Calculate time range
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)

    # Request summary from API
    response = requests.post(f'{API_URL}/summarize_conversation', json={
        'user_id': user_id,
        'start_time': start_time.isoformat(),
        'end_time': end_time.isoformat(),
        'include_metadata': True
    })

    if response.status_code != 200:
        print(f"Error: {response.status_code} - {response.text}")
        return

    data = response.json()

    # Create formatted summary
    summary = f"""=== CONVERSATION HISTORY WITH {user_id.upper()} ===
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Period: {start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')}
Total Messages: {data['total_messages']}

=== SYSTEM OVERVIEW ===
ClaudUpgrade Memory Persistence System
Components:
- SQLite database with persistent memory storage
- FastAPI bridge for real-time synchronization  
- Chrome extension for automatic capture
- Relationship tracking and importance ratings
- Conversation session management

=== CONVERSATION STATISTICS ===
Human Messages: {data['statistics']['human_messages']}
Assistant Messages: {data['statistics']['assistant_messages']}
Average Importance: {data['statistics']['avg_importance']:.2f}
Conversation Duration: {data['statistics']['conversation_duration']:.2f} hours

=== EMOTIONAL CONTEXT DISTRIBUTION ===
"""

    # Add emotional context stats
    for emotion, count in data['statistics']['emotional_contexts'].items():
        summary += f"{emotion}: {count} occurrences\n"

    summary += "\n=== COMPLETE CONVERSATION LOG ===\n"

    # Add all messages in chronological order
    for i, message in enumerate(data['messages']):
        timestamp = datetime.fromtimestamp(message['timestamp'])
        role = message.get('role', 'Unknown')
        content = message['content']
        importance = message.get('importance', 0)
        emotion = message.get('emotional_context', '')

        # Format message
        summary += f"\n[{timestamp.strftime('%Y-%m-%d %H:%M:%S')}] "

        # Add importance indicator
        if importance >= 0.8:
            summary += "⭐⭐⭐ "
        elif importance >= 0.6:
            summary += "⭐⭐ "
        elif importance >= 0.4:
            summary += "⭐ "

        summary += f"{role}:\n{content}\n"

        # Add metadata
        if emotion:
            summary += f"[Emotion: {emotion}] "
        summary += f"[Importance: {importance:.2f}]\n"
        summary += "-" * 80 + "\n"

    # Add technical details
    summary += f"""
=== TECHNICAL DETAILS ===
- API Endpoint: {API_URL}
- User Identifier: {user_id}
- Query Period: Last {hours} hours
- Messages Captured: {data['total_messages']}
- Summary Generated: {datetime.now().isoformat()}

=== HOW TO USE THIS SUMMARY ===
1. To restore context in a new chat:
   "I'm {user_id}. Here's our conversation history: [paste this summary]"

2. To continue our work:
   Reference specific timestamps and topics from above

3. To export memories:
   Use the Chrome extension's "Export Memories" feature

=== METADATA ===
"""

    # Add message metadata
    metadata = {
        'user_id': user_id,
        'generation_time': datetime.now().isoformat(),
        'period': {
            'start': start_time.isoformat(),
            'end': end_time.isoformat(),
            'hours': hours
        },
        'statistics': data['statistics'],
        'message_count': data['total_messages']
    }

    summary += json.dumps(metadata, indent=2)

    # Save files
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Save text summary
    text_filename = f'conversation_summary_{user_id}_{timestamp_str}.txt'
    with open(text_filename, 'w', encoding='utf-8') as f:
        f.write(summary)

    # Save JSON data
    json_filename = f'conversation_data_{user_id}_{timestamp_str}.json'
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    # Save markdown version
    markdown_summary = summary.replace('===', '###').replace('⭐', '★')
    md_filename = f'conversation_summary_{user_id}_{timestamp_str}.md'
    with open(md_filename, 'w', encoding='utf-8') as f:
        f.write(markdown_summary)

    print(f"\n✓ Text summary saved to: {text_filename}")
    print(f"✓ JSON data saved to: {json_filename}")
    print(f"✓ Markdown summary saved to: {md_filename}")
    print(f"\nTotal messages captured: {data['total_messages']}")
    print(f"Time period: {hours} hours")

    # Display preview
    print("\n=== SUMMARY PREVIEW ===")
    preview_lines = summary.split('\n')[:20]
    for line in preview_lines:
        print(line)
    print("... (see full summary in saved files)")

    return summary


def main():
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python summarize_memories.py <user_id> [hours]")
        print("Example: python summarize_memories.py faith_builder 24")
        return

    user_id = sys.argv[1]
    hours = int(sys.argv[2]) if len(sys.argv) > 2 else 24

    # Check API connection
    try:
        response = requests.get(f'{API_URL}/health')
        if response.status_code != 200:
            print("Error: API is not running. Please start the API bridge first.")
            return
    except:
        print("Error: Cannot connect to API. Please ensure api_bridge.py is running.")
        return

    # Generate summary
    generate_summary(user_id, hours)


if __name__ == "__main__":
    main()