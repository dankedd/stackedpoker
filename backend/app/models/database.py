import uuid
from datetime import datetime

from sqlalchemy import String, Text, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    hands: Mapped[list["UploadedHand"]] = relationship("UploadedHand", back_populates="user")


class UploadedHand(Base):
    __tablename__ = "uploaded_hands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    site: Mapped[str] = mapped_column(String(50), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User | None"] = relationship("User", back_populates="hands")
    parsed_hand: Mapped["ParsedHand | None"] = relationship("ParsedHand", back_populates="uploaded_hand", uselist=False)


class ParsedHand(Base):
    __tablename__ = "parsed_hands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_hand_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("uploaded_hands.id"))
    hand_id: Mapped[str] = mapped_column(String(100), nullable=True)
    site: Mapped[str] = mapped_column(String(50))
    game_type: Mapped[str] = mapped_column(String(20))
    stakes: Mapped[str] = mapped_column(String(30))
    hero_position: Mapped[str] = mapped_column(String(10))
    hero_cards: Mapped[list] = mapped_column(JSON)
    board: Mapped[dict] = mapped_column(JSON)
    actions: Mapped[list] = mapped_column(JSON)
    effective_stack_bb: Mapped[float] = mapped_column(Float)
    parsed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    uploaded_hand: Mapped["UploadedHand"] = relationship("UploadedHand", back_populates="parsed_hand")
    analysis: Mapped["Analysis | None"] = relationship("Analysis", back_populates="parsed_hand", uselist=False)


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parsed_hand_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("parsed_hands.id"))
    spot_classification: Mapped[dict] = mapped_column(JSON)
    board_texture: Mapped[dict] = mapped_column(JSON)
    findings: Mapped[list] = mapped_column(JSON)
    overall_score: Mapped[int] = mapped_column(Integer)
    ai_coaching: Mapped[str] = mapped_column(Text)
    mistakes_count: Mapped[int] = mapped_column(Integer, default=0)
    analyzed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    parsed_hand: Mapped["ParsedHand"] = relationship("ParsedHand", back_populates="analysis")
