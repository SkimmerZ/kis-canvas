from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import json
from typing import List

from app.api.canvas import router as canvas_router
from app.db.database import create_tables

app = FastAPI(title="KIS Canvas", version="1.0.0")

from app.core.config import settings

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(canvas_router, prefix="/api")

# Set up the connection manager reference
from app.api import canvas
canvas.manager = None  # Will be set after manager is created

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()

# Set the manager reference for the canvas router
canvas.manager = manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for now - can be used for real-time pixel updates
            await manager.broadcast({"type": "pixel_update", "data": json.loads(data)})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.on_event("startup")
def startup_event():
    create_tables()

# Mount static files (frontend) - this must be last to avoid catching other routes
app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)