"""
WebSocket connection manager — handles client connections, authentication,
room subscriptions, and message routing.

Architecture:
  Each WebSocket connection is bound to a user_id and subscribes to channels.
  Messages from Redis pub/sub are forwarded to the appropriate WebSocket.
  Client-to-server messages are validated and routed to handlers.

  Client → WebSocket → Handler → EventBus → Redis pub/sub → All subscribers

Protocol:
  Client sends JSON: {"action": "subscribe", "channel": "rt:session:abc"}
  Server sends JSON: {"type": "event_type", "payload": {...}, "sequence": N}

  Actions: subscribe, unsubscribe, message, ping
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

from .events import EventBus, get_event_bus

logger = logging.getLogger(__name__)


class Connection:
    """Represents a single WebSocket connection."""

    def __init__(self, websocket: WebSocket, user_id: str) -> None:
        self.websocket = websocket
        self.user_id = user_id
        self.subscriptions: set[str] = set()
        self.connected_at = datetime.now(timezone.utc)
        self._listener_task: asyncio.Task | None = None

    async def send(self, data: dict) -> None:
        try:
            await self.websocket.send_json(data)
        except Exception:
            pass  # Connection may have closed

    async def close(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
        try:
            await self.websocket.close()
        except Exception:
            pass


class ConnectionManager:
    """
    Manages all active WebSocket connections.

    Thread-safe for single-process async apps.
    For horizontal scaling, each instance manages its own connections
    and receives events via Redis pub/sub (shared across instances).
    """

    def __init__(self) -> None:
        self._connections: dict[str, Connection] = {}  # user_id → connection
        self._bus: EventBus | None = None

    async def _get_bus(self) -> EventBus | None:
        if self._bus is None:
            self._bus = await get_event_bus()
        return self._bus

    async def connect(self, websocket: WebSocket, user_id: str) -> Connection:
        """Accept a new WebSocket connection."""
        await websocket.accept()

        # Close existing connection for this user (one connection per user)
        if user_id in self._connections:
            await self._connections[user_id].close()

        conn = Connection(websocket, user_id)
        self._connections[user_id] = conn

        # Auto-subscribe to personal channel
        await self._subscribe_connection(conn, f"rt:user:{user_id}")

        logger.info("[WS] connected: %s (total: %d)", user_id, len(self._connections))
        return conn

    async def disconnect(self, user_id: str) -> None:
        """Clean up a disconnected client."""
        conn = self._connections.pop(user_id, None)
        if conn:
            await conn.close()
            logger.info("[WS] disconnected: %s (total: %d)", user_id, len(self._connections))

    async def handle_message(self, conn: Connection, raw: str) -> None:
        """Process an incoming client message."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await conn.send({"type": "error", "payload": {"message": "Invalid JSON"}})
            return

        action = msg.get("action", "")

        if action == "subscribe":
            channel = msg.get("channel", "")
            if channel and self._is_channel_allowed(conn.user_id, channel):
                await self._subscribe_connection(conn, channel)
                await conn.send({"type": "subscribed", "payload": {"channel": channel}})
            else:
                await conn.send({"type": "error", "payload": {"message": f"Cannot subscribe to {channel}"}})

        elif action == "unsubscribe":
            channel = msg.get("channel", "")
            conn.subscriptions.discard(channel)
            await conn.send({"type": "unsubscribed", "payload": {"channel": channel}})

        elif action == "ping":
            await conn.send({"type": "pong", "payload": {}})

        elif action == "message":
            # Forward to event bus for distribution
            channel = msg.get("channel", "")
            payload = msg.get("payload", {})
            if channel in conn.subscriptions:
                bus = await self._get_bus()
                if bus:
                    await bus.publish(channel, "user_message", {
                        "user_id": conn.user_id,
                        **payload,
                    })

    async def broadcast_to_user(self, user_id: str, event_type: str, payload: dict) -> bool:
        """Send directly to a specific user's WebSocket."""
        conn = self._connections.get(user_id)
        if conn:
            await conn.send({"type": event_type, "payload": payload})
            return True
        return False

    @property
    def active_connections(self) -> int:
        return len(self._connections)

    def get_connection(self, user_id: str) -> Connection | None:
        return self._connections.get(user_id)

    # ── Internal helpers ──────────────────────────────────────────────────

    async def _subscribe_connection(self, conn: Connection, channel: str) -> None:
        """Subscribe a connection to a Redis pub/sub channel."""
        if channel in conn.subscriptions:
            return

        conn.subscriptions.add(channel)
        bus = await self._get_bus()
        if not bus:
            return  # Redis unavailable — skip subscription

        # Start a background listener for this channel
        async def _listener():
            try:
                async for event in bus.subscribe(channel):
                    await conn.send(event)
            except asyncio.CancelledError:
                pass
            except Exception as exc:
                logger.debug("[WS] listener error for %s: %s", channel, exc)

        task = asyncio.create_task(_listener(), name=f"ws-{conn.user_id}-{channel}")
        # Store only the latest listener task (simplification)
        if conn._listener_task:
            conn._listener_task.cancel()
        conn._listener_task = task

    def _is_channel_allowed(self, user_id: str, channel: str) -> bool:
        """
        Permission check: can this user subscribe to this channel?

        Rules:
          - rt:user:{user_id}: only own channel
          - rt:session:*: any (user must be participant — checked at room level)
          - rt:room:*: any (checked at room join)
          - rt:simulation:*: any
          - rt:global: any
        """
        if channel.startswith("rt:user:"):
            return channel == f"rt:user:{user_id}"
        if channel.startswith(("rt:session:", "rt:room:", "rt:simulation:", "rt:global")):
            return True
        return False


# Module singleton
_manager: ConnectionManager | None = None


def get_ws_manager() -> ConnectionManager:
    global _manager
    if _manager is None:
        _manager = ConnectionManager()
    return _manager
