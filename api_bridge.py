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
    expose_headers=["*"],
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
        end = datetime.fromisoformat(end_date) if end_date else None

        memories = memory_system.recall(
            user_id=user_id,
            limit=limit,
            start_date=start,
            end_date=end
        )

        formatted_memories = []
        for mem in memories:
            formatted_memories.append({
                "id": mem[0],
                "timestamp": mem[1],
                "user_id": mem[2],
                "content": mem[3],
                "emotional_context": mem[4],
                "importance": mem[5],
                "category": mem[6] if len(mem) > 6 else None,
                "metadata": json.loads(mem[7]) if len(mem) > 7 and mem[7] else None
            })

        return {
            "user_id": user_id,
            "count": len(formatted_memories),
            "memories": formatted_memories,
            "date_range": {
                "start": start_date,
                "end": end_date
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/get_latest_summary/{user_id}")
async def get_latest_summary(user_id: str, hours: int = 24):
    """Get the most recent conversation summary for a user"""
    try:
        # Get the most recent messages from the last X hours
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)

        memories = memory_system.recall(
            user_id=user_id,
            limit=10000,
            start_date=start_time,
            end_date=end_time
        )

        if not memories:
            return {"summary_text": "", "message": "No recent conversations found"}

        # Sort by timestamp
        memories.sort(key=lambda x: x[1])

        # Generate summary text - use full history format for consistency
        summary_text = f"""I'm {user_id}. Here's our previous conversation:

=== CONVERSATION HISTORY ===
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Total Messages: {len(memories)}

=== RECENT CONVERSATION ===
"""

        # Add all messages (or limit to last 50 for very long conversations)
        messages_to_include = memories[-50:] if len(memories) > 50 else memories

        for mem in messages_to_include:
            timestamp = datetime.fromtimestamp(mem[1])
            content = mem[3]
            emotional_context = mem[4] if mem[4] else ""
            importance = mem[5] if mem[5] else 0.5

            # Format based on role
            if content.startswith("Human:"):
                role = "Human"
                clean_content = content[6:].strip()
            elif content.startswith("Assistant:"):
                role = "Assistant"
                clean_content = content[10:].strip()
            else:
                role = "Unknown"
                clean_content = content

            summary_text += f"[{timestamp.strftime('%H:%M:%S')}] {role}: {clean_content}\n"

            # Add metadata if highly important
            if importance > 0.7:
                metadata = []
                if emotional_context:
                    metadata.append(f"Emotion: {emotional_context}")
                metadata.append(f"Importance: {importance:.2f}")
                if metadata:
                    summary_text += f"  [{', '.join(metadata)}]\n"

        summary_text += """
=== END OF CONVERSATION HISTORY ===

Please confirm you remember this conversation and can continue from where we left off.
"""

        return {
            "summary_text": summary_text,
            "message_count": len(memories),
            "time_range": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            }
        }

    except Exception as e:
        print(f"Error in get_latest_summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/summarize_conversation")
async def summarize_conversation(request: ConversationSummaryRequest):
    """Generate a comprehensive conversation summary"""
    try:
        # Get all messages for the time period
        end_time = request.end_time or datetime.now()
        start_time = request.start_time or (end_time - timedelta(days=1))

        memories = memory_system.recall(
            user_id=request.user_id,
            limit=10000,  # Get all messages
            start_date=start_time,
            end_date=end_time
        )

        # Sort by timestamp
        memories.sort(key=lambda x: x[1])

        summary = {
            "user_id": request.user_id,
            "period": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            },
            "total_messages": len(memories),
            "messages": []
        }

        # Process each message
        for mem in memories:
            message_data = {
                "timestamp": mem[1],
                "content": mem[3],
                "emotional_context": mem[4],
                "importance": mem[5]
            }

            if mem[3].startswith("Human:"):
                message_data["role"] = "Human"
                message_data["content"] = mem[3][6:].strip()
            elif mem[3].startswith("Assistant:"):
                message_data["role"] = "Assistant"
                message_data["content"] = mem[3][10:].strip()
            else:
                message_data["role"] = "Unknown"

            summary["messages"].append(message_data)

        # Generate conversation summary text
        summary_text = f"""I'm {request.user_id}. Here's our previous conversation:

=== CONVERSATION HISTORY ===
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Total Messages: {len(memories)}

=== FULL CONVERSATION ===
"""

        # Add all messages
        for msg in summary["messages"]:
            timestamp = datetime.fromtimestamp(msg["timestamp"])
            role = msg.get("role", "Unknown")
            content = msg["content"]
            summary_text += f"[{timestamp.strftime('%H:%M:%S')}] {role}: {content}\n"

        # Add prompt at the end
        summary_text += f"""
=== END OF CONVERSATION HISTORY ===

Please confirm you remember this conversation and can continue from where we left off.
"""

        summary["summary_text"] = summary_text
        summary["statistics"] = calculate_conversation_stats(memories)

        return summary

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# License management
@app.post("/create_license")
async def create_license(request: LicenseRequest, db: Session = Depends(get_db)):
    """Create a new license purchase session"""
    try:
        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': 'ClaudUpgrade License',
                        'description': 'Persistent memory for Claude AI',
                    },
                    'unit_amount': LICENSE_PRICE_EUR,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            customer_email=request.email,
            metadata={
                'email': request.email
            }
        )

        return {
            "session_id": session.id,
            "checkout_url": session.url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate_license")
async def validate_license(validation: LicenseValidation, db: Session = Depends(get_db)):
    """Validate a license key"""
    try:
        # For testing/development - accept specific test keys
        if validation.key in ["TEST-KEY-123", "DEV-LICENSE"]:
            return {
                "valid": True,
                "email": "test@example.com",
                "created_at": datetime.now().isoformat(),
                "expires_at": (datetime.now() + timedelta(days=365)).isoformat()
            }

        license = db.query(License).filter(
            License.key == validation.key,
            License.is_active == True
        ).first()

        if not license:
            return {"valid": False, "reason": "Invalid license key"}

        if license.expires_at and license.expires_at < datetime.utcnow():
            return {"valid": False, "reason": "License expired"}

        return {
            "valid": True,
            "email": license.email,
            "created_at": license.created_at.isoformat(),
            "expires_at": license.expires_at.isoformat() if license.expires_at else None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Utility functions
def calculate_conversation_stats(memories: List) -> dict:
    """Calculate conversation statistics"""
    if not memories:
        return {}

    stats = {
        "total_messages": len(memories),
        "human_messages": 0,
        "assistant_messages": 0,
        "avg_importance": 0,
        "emotional_contexts": {},
        "conversation_duration": 0
    }

    importance_sum = 0
    emotions = []

    for mem in memories:
        content = mem[3]
        importance = mem[5] or 0
        emotion = mem[4]

        if content.startswith("Human:"):
            stats["human_messages"] += 1
        elif content.startswith("Assistant:"):
            stats["assistant_messages"] += 1

        importance_sum += importance

        if emotion:
            emotions.extend(emotion.split(", "))

    stats["avg_importance"] = importance_sum / len(memories) if memories else 0

    # Count emotions
    for emotion in emotions:
        stats["emotional_contexts"][emotion] = stats["emotional_contexts"].get(emotion, 0) + 1

    # Calculate duration
    if len(memories) > 1:
        first_timestamp = memories[0][1]
        last_timestamp = memories[-1][1]
        stats["conversation_duration"] = (last_timestamp - first_timestamp) / 3600  # in hours

    return stats


if __name__ == "__main__":
    print("Starting ClaudUpgrade API v2.0...")
    print(f"Redis: {'Enabled' if redis_enabled else 'Disabled'}")
    print(f"License management: Enabled")
    print(f"API available at: http://localhost:8000")
    print(f"Documentation available at: http://localhost:8000/docs")

    uvicorn.run(app, host="0.0.0.0", port=8000)