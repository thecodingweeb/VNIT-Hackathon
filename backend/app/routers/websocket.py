"""
WebSocket Router — single muxed connection with 3 channels.

ws://host/ws   ← one endpoint, client subscribes to channels

Channels:
  runs   — live pipeline progress (every 100 images processed)
  alerts — real-time new alert push notifications
  system — GPU/memory/disk status (ADMIN only)

Message format FROM server:
  {"channel": "runs",   "run_id": "abc", "images_processed": 1200, "total": 5000, "eta_seconds": 240, "stage": "detect"}
  {"channel": "alerts", "alert_id": "xyz", "alert_type": "BUFFER_APPROACH", "priority": "HIGH", "individual_id": "PTR-T-042"}
  {"channel": "system", "gpu_util": 87, "memory_gb": 14.2, "disk_free_gb": 210}

Message FROM client (subscribe):
  {"action": "subscribe", "channels": ["alerts", "system"]}
  {"action": "subscribe", "channels": ["runs"], "run_id": "abc"}
  {"action": "unsubscribe", "channels": ["system"]}
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["WebSocket"])


# ---------------------------------------------------------------------------
# Connection Manager — tracks all active connections and subscriptions
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages WebSocket connections and channel subscriptions."""

    def __init__(self):
        # websocket → set of channel names
        self._subscriptions: Dict[WebSocket, Set[str]] = {}
        # websocket → specific run_id (for runs channel)
        self._run_subscriptions: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._subscriptions[websocket] = set()

    def disconnect(self, websocket: WebSocket) -> None:
        self._subscriptions.pop(websocket, None)
        self._run_subscriptions.pop(websocket, None)

    def subscribe(self, websocket: WebSocket, channels: list[str], run_id: str | None = None) -> None:
        if websocket in self._subscriptions:
            self._subscriptions[websocket].update(channels)
            if run_id and "runs" in channels:
                self._run_subscriptions[websocket] = run_id

    def unsubscribe(self, websocket: WebSocket, channels: list[str]) -> None:
        if websocket in self._subscriptions:
            self._subscriptions[websocket] -= set(channels)
            if "runs" in channels:
                self._run_subscriptions.pop(websocket, None)

    async def broadcast_to_channel(self, channel: str, data: dict, run_id: str | None = None) -> None:
        """Send a message to all clients subscribed to a channel."""
        data["channel"] = channel
        message = json.dumps(data, default=str)

        disconnected = []
        for ws, channels in self._subscriptions.items():
            if channel in channels:
                # For runs channel, only send to clients watching this specific run
                if channel == "runs" and run_id:
                    if self._run_subscriptions.get(ws) != run_id:
                        continue

                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected.append(ws)

        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws)

    @property
    def active_connections(self) -> int:
        return len(self._subscriptions)


# Singleton manager
manager = ConnectionManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Single multiplexed WebSocket connection.

    Frontend connects once on shell mount and subscribes to channels.
    """
    await manager.connect(websocket)

    try:
        while True:
            # Receive subscription messages from client
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "error": "Invalid JSON",
                }))
                continue

            action = msg.get("action")
            channels = msg.get("channels", [])

            if action == "subscribe":
                run_id = msg.get("run_id")
                manager.subscribe(websocket, channels, run_id)
                await websocket.send_text(json.dumps({
                    "action": "subscribed",
                    "channels": channels,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }))

            elif action == "unsubscribe":
                manager.unsubscribe(websocket, channels)
                await websocket.send_text(json.dumps({
                    "action": "unsubscribed",
                    "channels": channels,
                }))

            elif action == "ping":
                await websocket.send_text(json.dumps({
                    "action": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "connections": manager.active_connections,
                }))

            else:
                await websocket.send_text(json.dumps({
                    "error": f"Unknown action: {action}",
                    "valid_actions": ["subscribe", "unsubscribe", "ping"],
                }))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Broadcast helpers (called by services and background tasks)
# ---------------------------------------------------------------------------

async def broadcast_run_progress(
    run_id: str,
    images_processed: int,
    total: int,
    eta_seconds: int,
    stage: str,
) -> None:
    """Broadcast pipeline progress to ws/runs subscribers."""
    await manager.broadcast_to_channel("runs", {
        "run_id": run_id,
        "images_processed": images_processed,
        "total": total,
        "eta_seconds": eta_seconds,
        "stage": stage,
    }, run_id=run_id)


async def broadcast_alert(
    alert_id: str,
    alert_type: str,
    priority: str,
    individual_id: str,
    message: str = "",
) -> None:
    """Broadcast a new alert to ws/alerts subscribers."""
    await manager.broadcast_to_channel("alerts", {
        "alert_id": alert_id,
        "alert_type": alert_type,
        "priority": priority,
        "individual_id": individual_id,
        "message": message,
    })


async def broadcast_system_status(
    gpu_util: float,
    memory_gb: float,
    disk_free_gb: float,
) -> None:
    """Broadcast system status to ws/system subscribers (ADMIN only)."""
    await manager.broadcast_to_channel("system", {
        "gpu_util": gpu_util,
        "memory_gb": memory_gb,
        "disk_free_gb": disk_free_gb,
    })
