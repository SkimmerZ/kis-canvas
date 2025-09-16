from sqlalchemy import Column, Integer, String, DateTime, Index
from datetime import datetime
from app.db.database import Base

class Pixel(Base):
    __tablename__ = "pixels"

    id = Column(Integer, primary_key=True, index=True)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    color = Column(String(7), nullable=False)  # Hex color code
    user_id = Column(String, nullable=False)  # Session ID or user identifier
    placed_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index('idx_position', 'x', 'y'),)