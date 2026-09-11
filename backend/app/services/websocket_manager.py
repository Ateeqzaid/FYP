import asyncio
import json
import time
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._attempt_to_ws: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, attempt_id: str):
        await websocket.accept()
        if attempt_id not in self._attempt_to_ws:
            self._attempt_to_ws[attempt_id] = set()
        self._attempt_to_ws[attempt_id].add(websocket)

    def disconnect(self, websocket: WebSocket, attempt_id: str):
        if attempt_id in self._attempt_to_ws:
            self._attempt_to_ws[attempt_id].discard(websocket)
            if not self._attempt_to_ws[attempt_id]:
                del self._attempt_to_ws[attempt_id]

    async def broadcast_to_attempt(self, attempt_id: str, message: dict):
        if attempt_id not in self._attempt_to_ws:
            return
        dead = set()
        for ws in self._attempt_to_ws[attempt_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._attempt_to_ws[attempt_id].discard(ws)

    async def broadcast_violation(self, attempt_id: str, violation: dict):
        await self.broadcast_to_attempt(attempt_id, {
            "type": "violation",
            "data": violation,
            "timestamp": time.time(),
        })

    async def broadcast_stats(self, attempt_id: str, stats: dict):
        await self.broadcast_to_attempt(attempt_id, {
            "type": "stats",
            "data": stats,
            "timestamp": time.time(),
        })


ws_manager = ConnectionManager()
