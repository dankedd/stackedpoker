"""
Study rooms — real-time collaborative hand review and drill sessions.

Architecture:
  Rooms are state machines managed server-side. Events are broadcast
  via a simple pub/sub system (Redis-backed in production).

  For MVP: HTTP polling with short TTL. WebSocket upgrade in next iteration.

Room lifecycle:
  WAITING → ACTIVE → (PAUSED ↔ ACTIVE) → COMPLETED

Event types:
  join, leave, message, hand_loaded, annotation_added,
  vote_started, vote_result, drill_started, drill_answer
"""

from __future__ import annotations

import logging
import secrets
from collections import defaultdict
from datetime import datetime, timezone

from .models import (
    RoomEvent,
    RoomParticipant,
    RoomRole,
    RoomStatus,
    StudyRoom,
)

logger = logging.getLogger(__name__)


class RoomManager:
    """
    Manages study room lifecycle and events.

    In production, room state lives in Redis for horizontal scaling.
    Events are broadcast via Redis pub/sub channels.
    """

    def __init__(self) -> None:
        self._rooms: dict[str, StudyRoom] = {}
        self._event_queues: dict[str, list[RoomEvent]] = defaultdict(list)
        self._user_rooms: dict[str, str] = {}  # user_id → room_id (one room at a time)

    def create_room(
        self,
        host_id: str,
        name: str,
        *,
        topic: str = "",
        description: str = "",
        max_participants: int = 10,
        is_public: bool = False,
    ) -> StudyRoom:
        """Create a new study room. The creator becomes the host."""
        room = StudyRoom(
            name=name,
            host_id=host_id,
            topic=topic,
            description=description,
            max_participants=max_participants,
            is_public=is_public,
        )

        # Add host as first participant
        room.participants.append(RoomParticipant(
            user_id=host_id,
            role=RoomRole.HOST,
        ))

        self._rooms[room.room_id] = room
        self._user_rooms[host_id] = room.room_id

        logger.info("[Room] created %s by %s: %s", room.room_id, host_id, name)
        return room

    def join_room(
        self,
        room_id: str,
        user_id: str,
        username: str = "",
        role: RoomRole = RoomRole.PARTICIPANT,
    ) -> StudyRoom | None:
        """Join an existing room. Returns None if full or not found."""
        room = self._rooms.get(room_id)
        if room is None:
            return None
        if room.status == RoomStatus.COMPLETED:
            return None
        if len(room.participants) >= room.max_participants:
            return None

        # Check if already in room
        for p in room.participants:
            if p.user_id == user_id:
                p.is_connected = True
                return room

        room.participants.append(RoomParticipant(
            user_id=user_id,
            username=username,
            role=role,
        ))
        self._user_rooms[user_id] = room_id

        self._broadcast(room_id, RoomEvent(
            event_type="join",
            room_id=room_id,
            user_id=user_id,
            payload={"username": username, "role": role.value},
        ))

        return room

    def leave_room(self, room_id: str, user_id: str) -> bool:
        room = self._rooms.get(room_id)
        if room is None:
            return False

        room.participants = [p for p in room.participants if p.user_id != user_id]
        self._user_rooms.pop(user_id, None)

        self._broadcast(room_id, RoomEvent(
            event_type="leave",
            room_id=room_id,
            user_id=user_id,
        ))

        # Auto-close empty rooms
        if not room.participants:
            room.status = RoomStatus.COMPLETED
            room.ended_at = datetime.now(timezone.utc)

        return True

    def start_session(self, room_id: str, user_id: str) -> bool:
        """Start the study session. Only host/coach can start."""
        room = self._rooms.get(room_id)
        if room is None:
            return False
        if not self._has_permission(room, user_id, {RoomRole.HOST, RoomRole.COACH}):
            return False

        room.status = RoomStatus.ACTIVE
        room.started_at = datetime.now(timezone.utc)

        self._broadcast(room_id, RoomEvent(
            event_type="session_started",
            room_id=room_id,
            user_id=user_id,
        ))
        return True

    def end_session(self, room_id: str, user_id: str) -> bool:
        room = self._rooms.get(room_id)
        if room is None:
            return False
        if not self._has_permission(room, user_id, {RoomRole.HOST}):
            return False

        room.status = RoomStatus.COMPLETED
        room.ended_at = datetime.now(timezone.utc)

        self._broadcast(room_id, RoomEvent(
            event_type="session_ended",
            room_id=room_id,
            user_id=user_id,
        ))
        return True

    def load_hand(
        self,
        room_id: str,
        user_id: str,
        hand_id: str,
        board: list[str],
    ) -> bool:
        """Load a hand for collaborative review."""
        room = self._rooms.get(room_id)
        if room is None:
            return False
        if not self._has_permission(room, user_id, {RoomRole.HOST, RoomRole.COACH}):
            return False

        room.current_hand_id = hand_id
        room.current_board = board

        self._broadcast(room_id, RoomEvent(
            event_type="hand_loaded",
            room_id=room_id,
            user_id=user_id,
            payload={"hand_id": hand_id, "board": board},
        ))
        return True

    def send_message(
        self,
        room_id: str,
        user_id: str,
        content: str,
    ) -> bool:
        """Send a chat message to the room."""
        room = self._rooms.get(room_id)
        if room is None:
            return False

        participant = self._find_participant(room, user_id)
        if participant is None:
            return False
        if participant.role == RoomRole.SPECTATOR:
            return False  # Spectators can't chat

        self._broadcast(room_id, RoomEvent(
            event_type="message",
            room_id=room_id,
            user_id=user_id,
            payload={"content": content[:500]},
        ))
        return True

    def add_annotation(
        self,
        room_id: str,
        user_id: str,
        action_index: int,
        content: str,
    ) -> bool:
        """Add a collaborative annotation to the current hand."""
        room = self._rooms.get(room_id)
        if room is None:
            return False

        annotation = {
            "user_id": user_id,
            "action_index": action_index,
            "content": content[:300],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        room.shared_annotations.append(annotation)

        self._broadcast(room_id, RoomEvent(
            event_type="annotation",
            room_id=room_id,
            user_id=user_id,
            payload=annotation,
        ))
        return True

    # ── Queries ───────────────────────────────────────────────────────────

    def get_room(self, room_id: str) -> StudyRoom | None:
        return self._rooms.get(room_id)

    def list_public_rooms(self) -> list[StudyRoom]:
        return [
            r for r in self._rooms.values()
            if r.is_public and r.status in (RoomStatus.WAITING, RoomStatus.ACTIVE)
        ]

    def get_user_room(self, user_id: str) -> StudyRoom | None:
        room_id = self._user_rooms.get(user_id)
        if room_id:
            return self._rooms.get(room_id)
        return None

    def get_events(self, room_id: str, since: int = 0) -> list[RoomEvent]:
        """Get events since a given index (for polling)."""
        events = self._event_queues.get(room_id, [])
        return events[since:]

    # ── Internal helpers ──────────────────────────────────────────────────

    def _broadcast(self, room_id: str, event: RoomEvent) -> None:
        self._event_queues[room_id].append(event)
        # Prune old events (keep last 200)
        if len(self._event_queues[room_id]) > 200:
            self._event_queues[room_id] = self._event_queues[room_id][-200:]

    def _has_permission(
        self, room: StudyRoom, user_id: str, allowed_roles: set[RoomRole],
    ) -> bool:
        participant = self._find_participant(room, user_id)
        return participant is not None and participant.role in allowed_roles

    def _find_participant(
        self, room: StudyRoom, user_id: str,
    ) -> RoomParticipant | None:
        for p in room.participants:
            if p.user_id == user_id:
                return p
        return None


_manager: RoomManager | None = None


def get_room_manager() -> RoomManager:
    global _manager
    if _manager is None:
        _manager = RoomManager()
    return _manager
