# api_bridge.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from core.memory import MemorySystem
import uvicorn
from typing import Optional, List
from datetime import datetime

app = FastAPI(title="Claude Memory Bridge API")

# Enable CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize memory system
memory_system = MemorySystem()


# Data models
class MemoryRequest(BaseModel):
    content: str
    user_id: str
    importance: float = 0.5
    emotional_context: Optional[str] = None


class MemoryResponse(BaseModel):
    status: str
    timestamp: float
    message: str


# API Endpoints
@app.get("/")
async def root():
    return {"message": "Claude Memory Bridge API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/remember", response_model=MemoryResponse)
async def create_memory(memory: MemoryRequest):
    """Store a new memory"""
    try:
        timestamp = memory_system.remember(
            content=memory.content,
            user_id=memory.user_id,
            importance=memory.importance,
            emotional_context=memory.emotional_context
        )
        return MemoryResponse(
            status="success",
            timestamp=timestamp,
            message="Memory stored successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/recall/{user_id}")
async def get_memories(user_id: str, limit: int = 10):
    """Retrieve memories for a user"""
    try:
        memories = memory_system.recall(user_id=user_id, limit=limit)

        # Format memories for JSON response
        formatted_memories = []
        for mem in memories:
            formatted_memories.append({
                "id": mem[0],
                "timestamp": mem[1],
                "user_id": mem[2],
                "content": mem[3],
                "emotional_context": mem[4],
                "importance": mem[5],
                "category": mem[6] if len(mem) > 6 else None
            })

        return {
            "user_id": user_id,
            "count": len(formatted_memories),
            "memories": formatted_memories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/relationship/{user_id}")
async def get_relationship(user_id: str):
    """Get relationship data for a user"""
    try:
        relationship = memory_system.get_relationship(user_id)
        if relationship:
            return {
                "user_id": relationship[0],
                "first_contact": relationship[1],
                "last_contact": relationship[2],
                "trust_level": relationship[3],
                "shared_memories": relationship[4],
                "personal_notes": relationship[5]
            }
        else:
            return {"message": "No relationship found", "user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("Starting Claude Memory Bridge API...")
    print("API will be available at: http://localhost:8000")
    print("Documentation available at: http://localhost:8000/docs")
    # Removed reload=True to prevent the warning and immediate closure
    uvicorn.run(app, host="0.0.0.0", port=8000)