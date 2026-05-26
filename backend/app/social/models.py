"""
Social data models — Pydantic schemas for the entire social layer.

All models are JSON-serializable and designed for Supabase/PostgreSQL storage.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


# ── Social Graph ──────────────────────────────────────────────────────────


class RelationType(str, Enum):
    FRIEND = "friend"           # Mutual connection
    FOLLOW = "follow"           # One-directional
    BLOCK = "block"             # Prevents all interaction


class FriendshipStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class Relationship(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    to_user_id: str
    relation_type: RelationType
    status: FriendshipStatus = FriendshipStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserPublicProfile(BaseModel):
    """Public-facing user profile for social features."""
    user_id: str
    username: str = ""
    avatar_url: str = ""
    level: int = 1
    overall_rating: float = 50.0
    hands_analyzed: int = 0
    drills_completed: int = 0
    current_streak: int = 0
    member_since: datetime | None = None
    is_creator: bool = False
    team_id: str | None = None


# ── Study Rooms ───────────────────────────────────────────────────────────


class RoomStatus(str, Enum):
    WAITING = "waiting"         # Created, waiting for participants
    ACTIVE = "active"           # Session in progress
    PAUSED = "paused"           # Temporarily paused
    COMPLETED = "completed"     # Session ended


class RoomRole(str, Enum):
    HOST = "host"               # Room creator, full control
    COACH = "coach"             # Can present, annotate, guide
    PARTICIPANT = "participant"  # Can discuss, answer prompts
    SPECTATOR = "spectator"     # View-only


class StudyRoom(BaseModel):
    room_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    host_id: str
    status: RoomStatus = RoomStatus.WAITING
    max_participants: int = 10
    is_public: bool = False
    topic: str = ""                     # "C-bet strategy", "3-bet defense"
    description: str = ""

    # Participants
    participants: list[RoomParticipant] = Field(default_factory=list)

    # Shared state
    current_hand_id: str | None = None  # Hand being reviewed
    current_board: list[str] = Field(default_factory=list)
    shared_annotations: list[dict] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    ended_at: datetime | None = None


class RoomParticipant(BaseModel):
    user_id: str
    username: str = ""
    role: RoomRole = RoomRole.PARTICIPANT
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_connected: bool = True


class RoomEvent(BaseModel):
    """Real-time event broadcast to room participants."""
    event_type: str             # "message", "hand_loaded", "annotation", "vote", "join", "leave"
    room_id: str
    user_id: str
    payload: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── Teams / Stables ───────────────────────────────────────────────────────


class TeamRole(str, Enum):
    OWNER = "owner"             # Full control, billing
    COACH = "coach"             # Can assign, review, manage students
    MEMBER = "member"           # Regular team member
    TRIAL = "trial"             # Limited access, evaluation period


class Team(BaseModel):
    team_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    owner_id: str
    description: str = ""
    avatar_url: str = ""
    max_members: int = 25
    is_public: bool = False
    invite_code: str = ""

    members: list[TeamMember] = Field(default_factory=list)

    # Team settings
    require_daily_drills: int = 0       # Minimum drills per day (0 = no requirement)
    require_weekly_hands: int = 0       # Minimum hand reviews per week

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeamMember(BaseModel):
    user_id: str
    username: str = ""
    role: TeamRole = TeamRole.MEMBER
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeamStats(BaseModel):
    team_id: str
    member_count: int = 0
    avg_rating: float = 50.0
    total_drills_this_week: int = 0
    total_hands_this_week: int = 0
    active_streaks: int = 0
    top_performers: list[str] = Field(default_factory=list)


# ── Creator Ecosystem ─────────────────────────────────────────────────────


class ContentType(str, Enum):
    LESSON = "lesson"           # Structured lesson with steps
    DRILL_PACK = "drill_pack"   # Set of curated drills
    COURSE = "course"           # Multi-lesson course
    STRATEGY_GUIDE = "guide"    # Written strategy content
    HAND_ANALYSIS = "analysis"  # Annotated hand review


class ContentVisibility(str, Enum):
    PUBLIC = "public"           # Anyone can access
    FOLLOWERS = "followers"     # Only followers
    PREMIUM = "premium"         # Requires subscription or purchase
    PRIVATE = "private"         # Only creator can see (draft)
    TEAM = "team"               # Only team members


class CreatorContent(BaseModel):
    content_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    creator_id: str
    content_type: ContentType
    visibility: ContentVisibility = ContentVisibility.PUBLIC
    title: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    difficulty: str = "intermediate"     # beginner, intermediate, advanced
    concept_tags: list[str] = Field(default_factory=list)

    # Content payload (type-specific)
    payload: dict = Field(default_factory=dict)

    # Metrics
    view_count: int = 0
    like_count: int = 0
    completion_count: int = 0
    avg_rating: float = 0.0
    rating_count: int = 0

    # Pricing (for premium content)
    price_cents: int = 0                # 0 = free
    revenue_share_pct: float = 70.0     # Creator gets 70% of revenue

    # Moderation
    is_approved: bool = False
    is_featured: bool = False
    moderation_status: str = "pending"  # pending, approved, rejected

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreatorProfile(BaseModel):
    user_id: str
    display_name: str = ""
    bio: str = ""
    follower_count: int = 0
    content_count: int = 0
    total_views: int = 0
    total_revenue_cents: int = 0
    avg_content_rating: float = 0.0
    is_verified: bool = False
    specialties: list[str] = Field(default_factory=list)  # ["cash", "tournament", "heads-up"]


# ── Competitive Systems ───────────────────────────────────────────────────


class LeagueId(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"


class Challenge(BaseModel):
    challenge_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challenger_id: str
    opponent_id: str
    challenge_type: str = "accuracy"    # accuracy, speed, streak
    status: str = "pending"             # pending, active, completed, expired
    drill_type: str = "cbet_or_check"
    drill_count: int = 10

    # Results
    challenger_score: float = 0.0
    opponent_score: float = 0.0
    winner_id: str | None = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime | None = None


class LeaderboardEntry(BaseModel):
    user_id: str
    username: str = ""
    rank: int = 0
    score: float = 0.0
    league: LeagueId = LeagueId.BRONZE
    games_played: int = 0
    win_rate: float = 0.0
    streak: int = 0


class SeasonInfo(BaseModel):
    season_id: str
    name: str                           # "Season 1: Foundation"
    start_date: datetime
    end_date: datetime
    is_active: bool = False
    prizes: list[str] = Field(default_factory=list)


# ── Sharing & Annotations ────────────────────────────────────────────────


class ShareVisibility(str, Enum):
    PUBLIC = "public"
    FRIENDS = "friends"
    TEAM = "team"
    LINK_ONLY = "link_only"
    PRIVATE = "private"


class SharedReplay(BaseModel):
    share_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    analysis_id: str                    # References hand_analyses.id
    shared_by: str                      # User who shared
    visibility: ShareVisibility = ShareVisibility.FRIENDS
    title: str = ""
    description: str = ""
    annotations: list[ReplayAnnotation] = Field(default_factory=list)

    view_count: int = 0
    comment_count: int = 0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReplayAnnotation(BaseModel):
    annotation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action_index: int                   # Which action this annotation refers to
    street: str = ""
    content: str                        # Annotation text
    annotation_type: str = "comment"    # comment, question, insight
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReplayComment(BaseModel):
    comment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    share_id: str
    user_id: str
    content: str
    parent_id: str | None = None        # For threading
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── Notifications ─────────────────────────────────────────────────────────


class NotificationType(str, Enum):
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPTED = "friend_accepted"
    CHALLENGE_RECEIVED = "challenge_received"
    CHALLENGE_RESULT = "challenge_result"
    TEAM_INVITE = "team_invite"
    ROOM_INVITE = "room_invite"
    CONTENT_LIKE = "content_like"
    CONTENT_COMMENT = "content_comment"
    STREAK_AT_RISK = "streak_at_risk"
    ACHIEVEMENT_EARNED = "achievement_earned"
    LEVEL_UP = "level_up"
    WEEKLY_SUMMARY = "weekly_summary"


class Notification(BaseModel):
    notification_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str                        # Recipient
    notification_type: NotificationType
    title: str
    body: str = ""
    action_url: str = ""                # Deep link
    is_read: bool = False
    data: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
