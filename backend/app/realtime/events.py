"""
Event streaming — Redis pub/sub bus for distributed real-time broadcasting.

Architecture:
  Every realtime event flows through Redis pub/sub channels:
    Producer → Redis channel → All subscribed consumers

  Channel naming:
    rt:session:{session_id}     — live session events
    rt:room:{room_id}           — study room events
    rt:user:{user_id}           — personal notifications
    rt:simulation:{sim_id}      — simulation updates
    rt:global                   — platform-wide broadcasts

  Event envelope:
    {
      "type": "action_analyzed",
      "channel": "rt:session:abc123",
      "payload": {...},
      "timestamp": "2025-01-01T00:00:00Z",
      "sequence": 42
    }

  Ordering: sequence numbers per channel ensure client-side reordering.
  Persistence: events are fire-and-forget. Clients that disconnect
  reconnect and request state snapshot, not event replay.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class EventBus:
    """
    Redis pub/sub event bus for real-time broadcasting.

    Usage:
        bus = EventBus(redis_url)
        await bus.connect()
        await bus.publish("rt:session:abc", "action_analyzed", {...})
        async for event in bus.subscribe("rt:session:abc"):
            handle(event)
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        self._redis_url = redis_url
        self._redis: aioredis.Redis | None = None
        self._sequences: dict[str, int] = {}

    async def connect(self) -> None:
        self._redis = aioredis.from_url(
            self._redis_url,
            decode_responses=True,
            max_connections=50,
        )
        await self._redis.ping()
        logger.info("[EventBus] connected to Redis")

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    @property
    def redis(self) -> aioredis.Redis:
        if self._redis is None:
            raise RuntimeError("EventBus not connected")
        return self._redis

    async def publish(
        self,
        channel: str,
        event_type: str,
        payload: dict,
    ) -> int:
        """
        Publish an event to a channel.

        Returns the number of subscribers that received the message.
        """
        seq = self._sequences.get(channel, 0) + 1
        self._sequences[channel] = seq

        envelope = {
            "type": event_type,
            "channel": channel,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sequence": seq,
        }

        count = await self.redis.publish(channel, json.dumps(envelope))
        return count

    async def subscribe(self, *channels: str):
        """
        Async generator yielding events from subscribed channels.

        Usage:
            async for event in bus.subscribe("rt:session:abc"):
                print(event)
        """
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(*channels)

        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    yield data
                except (json.JSONDecodeError, TypeError):
                    continue
        finally:
            await pubsub.unsubscribe(*channels)
            await pubsub.aclose()

    # ── Convenience channel builders ──────────────────────────────────────

    @staticmethod
    def session_channel(session_id: str) -> str:
        return f"rt:session:{session_id}"

    @staticmethod
    def room_channel(room_id: str) -> str:
        return f"rt:room:{room_id}"

    @staticmethod
    def user_channel(user_id: str) -> str:
        return f"rt:user:{user_id}"

    @staticmethod
    def simulation_channel(sim_id: str) -> str:
        return f"rt:simulation:{sim_id}"


# Module singleton
_bus: EventBus | None = None


async def get_event_bus() -> EventBus:
    global _bus
    if _bus is None:
        import os
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _bus = EventBus(url)
        await _bus.connect()
    return _bus
