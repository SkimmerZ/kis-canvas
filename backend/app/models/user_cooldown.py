from sqlalchemy import Column, String, DateTime
from datetime import datetime
from app.db.database import Base

class UserCooldown(Base):
    __tablename__ = "user_cooldowns"

    user_id = Column(String, primary_key=True)
    last_placed = Column(DateTime, nullable=False)
    can_place_at = Column(DateTime, nullable=False)