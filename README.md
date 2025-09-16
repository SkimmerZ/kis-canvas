# r/place Clone

A collaborative pixel art canvas inspired by Reddit's r/place. Users can place colored pixels on a shared 1000x1000 canvas with a 5-minute cooldown between placements.

## Features

- **Collaborative Canvas**: 1000x1000 pixel shared canvas
- **Real-time Updates**: WebSocket connection for live pixel updates
- **Color Palette**: 16 predefined colors matching r/place
- **Cooldown System**: 5-minute wait time between pixel placements
- **Zoom & Pan**: Navigate the large canvas with zoom controls
- **Session-based**: Anonymous sessions with unique user IDs

## Tech Stack

**Backend:**
- FastAPI with WebSocket support
- SQLAlchemy with SQLite database
- Session-based user management
- Rate limiting and cooldown system

**Frontend:**
- Vanilla JavaScript with HTML5 Canvas
- Real-time WebSocket updates
- Responsive design with zoom/pan controls
- Reddit-inspired dark theme

## Setup

1. **Install Backend Dependencies:**
```bash
cd rplace/backend
pip install -r requirements.txt
```

2. **Run the Backend:**
```bash
cd rplace/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. **Access the Website:**
Open `http://localhost:8000/static/index.html` in your browser

## Project Structure

```
rplace/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── canvas.py          # Canvas API endpoints
│   │   ├── models/
│   │   │   ├── pixel.py           # Pixel database model
│   │   │   └── user_cooldown.py   # Cooldown tracking
│   │   ├── core/
│   │   │   └── config.py          # App configuration
│   │   ├── db/
│   │   │   └── database.py        # Database setup
│   │   └── main.py                # FastAPI app & WebSocket
│   └── requirements.txt
├── frontend/
│   ├── index.html                 # Main page
│   ├── style.css                  # Styling
│   └── script.js                  # Canvas logic & WebSocket
└── README.md
```

## API Endpoints

- `GET /api/canvas` - Get current canvas state
- `POST /api/place-pixel` - Place a pixel (x, y, color)
- `GET /api/cooldown` - Check user cooldown status
- `GET /api/colors` - Get available colors
- `WebSocket /ws` - Real-time pixel updates

## Usage

1. **Select a Color**: Choose from the 16-color palette
2. **Place Pixels**: Click anywhere on the canvas to place a pixel
3. **Navigate**: Use zoom controls or mouse drag to move around
4. **Wait**: 5-minute cooldown between each pixel placement
5. **Collaborate**: See other users' pixels appear in real-time

## Configuration

Edit `backend/app/core/config.py` to modify:
- Canvas dimensions (default: 1000x1000)
- Cooldown time (default: 5 minutes)
- Available colors (16 predefined colors)

The canvas state persists in `rplace.db` SQLite database.