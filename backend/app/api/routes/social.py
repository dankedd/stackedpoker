"""
FastAPI endpoints for the social, multiplayer, and creator ecosystem.

Route groups:
  /api/social/friends/*       — friend requests, list, remove
  /api/social/follow/*        — follow/unfollow
  /api/social/rooms/*         — study room CRUD, events, messaging
  /api/social/challenges/*    — head-to-head challenges
  /api/social/leaderboard/*   — leagues, rankings
  /api/social/creators/*      — creator profiles, content publishing
  /api/social/marketplace/*   — content discovery, purchase
  /api/social/share/*         — replay sharing, annotations
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.social.graph import get_social_graph
from app.social.rooms import get_room_manager
from app.social.competitive import get_leaderboard_manager
from app.social.creators import get_creator_service
from app.social.models import (
    ContentType,
    ContentVisibility,
    LeagueId,
    RoomRole,
    ShareVisibility,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/social", tags=["social"])


# ── Request Models ────────────────────────────────────────────────────────

class FriendRequest(BaseModel):
    from_user_id: str
    to_user_id: str


class FollowRequest(BaseModel):
    from_user_id: str
    to_user_id: str


class CreateRoomRequest(BaseModel):
    host_id: str
    name: str
    topic: str = ""
    description: str = ""
    max_participants: int = 10
    is_public: bool = False


class JoinRoomRequest(BaseModel):
    user_id: str
    username: str = ""


class RoomMessageRequest(BaseModel):
    user_id: str
    content: str


class RoomAnnotationRequest(BaseModel):
    user_id: str
    action_index: int
    content: str


class LoadHandRequest(BaseModel):
    user_id: str
    hand_id: str
    board: list[str]


class ChallengeRequest(BaseModel):
    challenger_id: str
    opponent_id: str
    drill_type: str = "cbet_or_check"
    drill_count: int = 10


class ChallengeScoreRequest(BaseModel):
    user_id: str
    score: float


class UpdateScoreRequest(BaseModel):
    user_id: str
    username: str
    accuracy_pct: float
    drills_completed: int
    streak_days: int = 0
    avg_difficulty: float = 0.5


class RegisterCreatorRequest(BaseModel):
    user_id: str
    display_name: str
    bio: str = ""
    specialties: list[str] = Field(default_factory=list)


class PublishContentRequest(BaseModel):
    creator_id: str
    content_type: str = "lesson"
    title: str
    description: str = ""
    payload: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    difficulty: str = "intermediate"
    visibility: str = "public"
    price_cents: int = 0


# ── Friend Routes ─────────────────────────────────────────────────────────

@router.post("/friends/request")
async def send_friend_request(req: FriendRequest) -> dict:
    graph = get_social_graph()
    rel = graph.send_friend_request(req.from_user_id, req.to_user_id)
    if rel is None:
        raise HTTPException(400, "Cannot send friend request (blocked or duplicate)")
    return {"relationship_id": rel.id, "status": rel.status.value}


@router.post("/friends/accept/{rel_id}")
async def accept_friend(rel_id: str, user_id: str) -> dict:
    graph = get_social_graph()
    ok = graph.accept_friend_request(rel_id, user_id)
    if not ok:
        raise HTTPException(400, "Cannot accept this request")
    return {"accepted": True}


@router.get("/friends/{user_id}")
async def list_friends(user_id: str) -> dict:
    graph = get_social_graph()
    friends = graph.get_friends(user_id)
    return {"user_id": user_id, "friends": friends, "count": len(friends)}


@router.get("/friends/{user_id}/pending")
async def pending_requests(user_id: str) -> dict:
    graph = get_social_graph()
    pending = graph.get_pending_requests(user_id)
    return {
        "user_id": user_id,
        "pending": [{"id": r.id, "from": r.from_user_id} for r in pending],
    }


# ── Follow Routes ─────────────────────────────────────────────────────────

@router.post("/follow")
async def follow_user(req: FollowRequest) -> dict:
    graph = get_social_graph()
    rel = graph.follow(req.from_user_id, req.to_user_id)
    if rel is None:
        raise HTTPException(400, "Cannot follow (blocked)")
    return {"following": True}


@router.post("/unfollow")
async def unfollow_user(req: FollowRequest) -> dict:
    graph = get_social_graph()
    ok = graph.unfollow(req.from_user_id, req.to_user_id)
    return {"unfollowed": ok}


@router.get("/followers/{user_id}")
async def get_followers(user_id: str) -> dict:
    graph = get_social_graph()
    return {"followers": graph.get_followers(user_id)}


@router.get("/following/{user_id}")
async def get_following(user_id: str) -> dict:
    graph = get_social_graph()
    return {"following": graph.get_following(user_id)}


# ── Study Room Routes ─────────────────────────────────────────────────────

@router.post("/rooms")
async def create_room(req: CreateRoomRequest) -> dict:
    mgr = get_room_manager()
    room = mgr.create_room(
        host_id=req.host_id,
        name=req.name,
        topic=req.topic,
        description=req.description,
        max_participants=req.max_participants,
        is_public=req.is_public,
    )
    return {"room_id": room.room_id, "name": room.name}


@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, req: JoinRoomRequest) -> dict:
    mgr = get_room_manager()
    room = mgr.join_room(room_id, req.user_id, req.username)
    if room is None:
        raise HTTPException(404, "Room not found or full")
    return {"room_id": room_id, "participants": len(room.participants)}


@router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, user_id: str) -> dict:
    mgr = get_room_manager()
    ok = mgr.leave_room(room_id, user_id)
    return {"left": ok}


@router.post("/rooms/{room_id}/start")
async def start_room(room_id: str, user_id: str) -> dict:
    mgr = get_room_manager()
    ok = mgr.start_session(room_id, user_id)
    if not ok:
        raise HTTPException(403, "Not authorized to start session")
    return {"started": True}


@router.post("/rooms/{room_id}/hand")
async def load_room_hand(room_id: str, req: LoadHandRequest) -> dict:
    mgr = get_room_manager()
    ok = mgr.load_hand(room_id, req.user_id, req.hand_id, req.board)
    if not ok:
        raise HTTPException(403, "Not authorized or room not found")
    return {"loaded": True}


@router.post("/rooms/{room_id}/message")
async def room_message(room_id: str, req: RoomMessageRequest) -> dict:
    mgr = get_room_manager()
    ok = mgr.send_message(room_id, req.user_id, req.content)
    if not ok:
        raise HTTPException(400, "Cannot send message")
    return {"sent": True}


@router.post("/rooms/{room_id}/annotate")
async def room_annotate(room_id: str, req: RoomAnnotationRequest) -> dict:
    mgr = get_room_manager()
    ok = mgr.add_annotation(room_id, req.user_id, req.action_index, req.content)
    return {"annotated": ok}


@router.get("/rooms/{room_id}")
async def get_room(room_id: str) -> dict:
    mgr = get_room_manager()
    room = mgr.get_room(room_id)
    if room is None:
        raise HTTPException(404, "Room not found")
    return room.model_dump()


@router.get("/rooms/{room_id}/events")
async def get_room_events(room_id: str, since: int = 0) -> dict:
    """Poll for new room events (HTTP long-poll pattern)."""
    mgr = get_room_manager()
    events = mgr.get_events(room_id, since=since)
    return {
        "events": [e.model_dump() for e in events],
        "cursor": since + len(events),
    }


@router.get("/rooms/public")
async def list_public_rooms() -> dict:
    mgr = get_room_manager()
    rooms = mgr.list_public_rooms()
    return {
        "rooms": [
            {"room_id": r.room_id, "name": r.name, "topic": r.topic,
             "participants": len(r.participants), "status": r.status.value}
            for r in rooms
        ],
    }


# ── Challenge Routes ──────────────────────────────────────────────────────

@router.post("/challenges")
async def create_challenge(req: ChallengeRequest) -> dict:
    mgr = get_leaderboard_manager()
    c = mgr.create_challenge(
        req.challenger_id, req.opponent_id, req.drill_type, req.drill_count,
    )
    return {"challenge_id": c.challenge_id, "status": c.status}


@router.post("/challenges/{challenge_id}/accept")
async def accept_challenge(challenge_id: str, user_id: str) -> dict:
    mgr = get_leaderboard_manager()
    ok = mgr.accept_challenge(challenge_id, user_id)
    if not ok:
        raise HTTPException(400, "Cannot accept challenge")
    return {"accepted": True}


@router.post("/challenges/{challenge_id}/score")
async def submit_challenge_score(
    challenge_id: str, req: ChallengeScoreRequest,
) -> dict:
    mgr = get_leaderboard_manager()
    c = mgr.submit_challenge_score(challenge_id, req.user_id, req.score)
    if c is None:
        raise HTTPException(400, "Cannot submit score")
    return {
        "status": c.status,
        "winner_id": c.winner_id,
        "challenger_score": c.challenger_score,
        "opponent_score": c.opponent_score,
    }


@router.get("/challenges/{user_id}")
async def user_challenges(user_id: str) -> dict:
    mgr = get_leaderboard_manager()
    challenges = mgr.get_user_challenges(user_id)
    return {"challenges": [c.model_dump() for c in challenges]}


# ── Leaderboard Routes ────────────────────────────────────────────────────

@router.post("/leaderboard/update")
async def update_leaderboard(req: UpdateScoreRequest) -> dict:
    mgr = get_leaderboard_manager()
    entry = mgr.update_score(
        req.user_id, req.username, req.accuracy_pct,
        req.drills_completed, req.streak_days, req.avg_difficulty,
    )
    return {
        "score": entry.score,
        "league": entry.league.value,
        "rank": entry.rank,
    }


@router.get("/leaderboard")
async def get_leaderboard(
    league: str | None = None,
    top_k: int = Query(default=50, ge=1, le=200),
) -> dict:
    mgr = get_leaderboard_manager()
    league_filter = LeagueId(league) if league else None
    entries = mgr.get_leaderboard(league=league_filter, top_k=top_k)
    return {"entries": [e.model_dump() for e in entries]}


# ── Creator Routes ────────────────────────────────────────────────────────

@router.post("/creators/register")
async def register_creator(req: RegisterCreatorRequest) -> dict:
    svc = get_creator_service()
    profile = svc.register_creator(
        req.user_id, req.display_name, req.bio, req.specialties,
    )
    return profile.model_dump()


@router.get("/creators/{user_id}")
async def get_creator(user_id: str) -> dict:
    svc = get_creator_service()
    profile = svc.get_creator(user_id)
    if profile is None:
        raise HTTPException(404, "Creator not found")
    return profile.model_dump()


@router.get("/creators/{user_id}/analytics")
async def creator_analytics(user_id: str) -> dict:
    svc = get_creator_service()
    return svc.get_creator_analytics(user_id)


@router.post("/creators/publish")
async def publish_content(req: PublishContentRequest) -> dict:
    svc = get_creator_service()
    content = svc.publish_content(
        creator_id=req.creator_id,
        content_type=ContentType(req.content_type),
        title=req.title,
        description=req.description,
        payload=req.payload,
        tags=req.tags,
        visibility=ContentVisibility(req.visibility),
        difficulty=req.difficulty,
        price_cents=req.price_cents,
    )
    if content is None:
        raise HTTPException(400, "Creator not registered")
    return {"content_id": content.content_id, "moderation_status": content.moderation_status}


# ── Marketplace Routes ────────────────────────────────────────────────────

@router.get("/marketplace")
async def browse_marketplace(
    content_type: str | None = None,
    tag: str | None = None,
    difficulty: str | None = None,
    sort_by: str = "rating",
    limit: int = 20,
) -> dict:
    svc = get_creator_service()
    ct = ContentType(content_type) if content_type else None
    items = svc.browse_marketplace(
        content_type=ct, tag=tag, difficulty=difficulty,
        sort_by=sort_by, limit=limit,
    )
    return {"items": [c.model_dump() for c in items]}


@router.get("/marketplace/{content_id}")
async def get_marketplace_item(content_id: str) -> dict:
    svc = get_creator_service()
    content = svc.get_content(content_id)
    if content is None:
        raise HTTPException(404, "Content not found")
    svc.record_view(content_id)
    return content.model_dump()


@router.post("/marketplace/{content_id}/rate")
async def rate_content(content_id: str, rating: float = Query(ge=0, le=5)) -> dict:
    svc = get_creator_service()
    svc.rate_content(content_id, rating)
    return {"rated": True}
