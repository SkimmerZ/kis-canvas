from fastapi import APIRouter, Depends, HTTPException, Request, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import List, Dict
import uuid
import json

from app.db.database import get_db
from app.models.pixel import Pixel
from app.models.user_cooldown import UserCooldown
from app.core.config import settings

router = APIRouter()

# Import manager from main module
manager = None

def get_user_id(request: Request) -> str:
    user_id = request.session.get("user_id")
    if not user_id:
        user_id = str(uuid.uuid4())
        request.session["user_id"] = user_id
    return user_id

@router.get("/canvas")
def get_canvas(db: Session = Depends(get_db)):
    pixels = db.query(Pixel).all()
    canvas_data = {}
    for pixel in pixels:
        canvas_data[f"{pixel.x},{pixel.y}"] = pixel.color
    return {
        "width": settings.CANVAS_WIDTH,
        "height": settings.CANVAS_HEIGHT,
        "pixels": canvas_data
    }

@router.post("/place-pixel")
async def place_pixel(
    request: Request,
    x: int = Form(...),
    y: int = Form(...),
    color: str = Form(...),
    db: Session = Depends(get_db)
):
    user_id = get_user_id(request)

    # Validate coordinates
    if x < 0 or x >= settings.CANVAS_WIDTH or y < 0 or y >= settings.CANVAS_HEIGHT:
        raise HTTPException(status_code=400, detail="Invalid coordinates")

    # Validate color
    if color not in settings.ALLOWED_COLORS:
        raise HTTPException(status_code=400, detail="Invalid color")

    # Check cooldown
    cooldown = db.query(UserCooldown).filter(UserCooldown.user_id == user_id).first()
    now = datetime.utcnow()

    if cooldown and now < cooldown.can_place_at:
        remaining = int((cooldown.can_place_at - now).total_seconds())
        raise HTTPException(
            status_code=429,
            detail=f"Cooldown active. Try again in {remaining} seconds"
        )

    # Place or update pixel
    existing_pixel = db.query(Pixel).filter(
        and_(Pixel.x == x, Pixel.y == y)
    ).first()

    if existing_pixel:
        existing_pixel.color = color
        existing_pixel.user_id = user_id
        existing_pixel.placed_at = now
    else:
        new_pixel = Pixel(x=x, y=y, color=color, user_id=user_id)
        db.add(new_pixel)

    # Update cooldown
    if cooldown:
        cooldown.last_placed = now
        cooldown.can_place_at = now + timedelta(seconds=settings.COOLDOWN_SECONDS)
    else:
        new_cooldown = UserCooldown(
            user_id=user_id,
            last_placed=now,
            can_place_at=now + timedelta(seconds=settings.COOLDOWN_SECONDS)
        )
        db.add(new_cooldown)

    db.commit()

    # Broadcast pixel update to all connected clients
    if manager:
        try:
            await manager.broadcast({
                "type": "pixel_update",
                "data": {"x": x, "y": y, "color": color}
            })
        except:
            # If we can't broadcast, continue normally
            pass

    return {
        "success": True,
        "cooldown_until": (now + timedelta(seconds=settings.COOLDOWN_SECONDS)).isoformat()
    }

@router.get("/cooldown")
def get_cooldown(request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id(request)
    cooldown = db.query(UserCooldown).filter(UserCooldown.user_id == user_id).first()

    if not cooldown:
        return {"can_place": True, "remaining_seconds": 0}

    now = datetime.utcnow()
    if now >= cooldown.can_place_at:
        return {"can_place": True, "remaining_seconds": 0}

    remaining = int((cooldown.can_place_at - now).total_seconds())
    return {"can_place": False, "remaining_seconds": remaining}

@router.get("/colors")
def get_allowed_colors():
    return {"colors": settings.ALLOWED_COLORS}