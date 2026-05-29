"""
WebSocket connection manager for real-time chat message delivery.

Maintains an in-memory mapping of user_id -> list[WebSocket] so that
a single user can have multiple active device connections.

Messages are dispatched to all active sockets for a given user_id.
If the recipient is offline, the message stays in the transient DB
mailbox and will be picked up on the next poll/reconnect.
"""

from fastapi import WebSocket
from typing import Dict, List
import json
import logging

logger = logging.getLogger("monteeq.ws")


class ConnectionManager:
    """Manages active WebSocket connections per user."""

    def __init__(self):
        # user_id -> list of active WebSocket connections (multi-device)
        self._connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info(f"WS connected: user={user_id}, total={len(self._connections[user_id])}")

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self._connections:
            self._connections[user_id] = [
                ws for ws in self._connections[user_id] if ws is not websocket
            ]
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info(f"WS disconnected: user={user_id}")

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections and len(self._connections[user_id]) > 0

    async def send_to_user(self, user_id: int, data: dict):
        """Send a JSON message to all active connections for a user."""
        if user_id not in self._connections:
            return False

        payload = json.dumps(data)
        disconnected = []
        for ws in self._connections[user_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                disconnected.append(ws)

        # Clean up any broken connections
        for ws in disconnected:
            self.disconnect(user_id, ws)

        return True

    async def broadcast_to_conversation(self, user_ids: List[int], data: dict):
        """Send a message to all devices of all users in a conversation."""
        for uid in user_ids:
            await self.send_to_user(uid, data)


# Singleton instance
manager = ConnectionManager()
