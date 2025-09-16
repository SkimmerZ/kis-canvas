class RPlaceCanvas {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.canvasWidth = 2000;
        this.canvasHeight = 1500;

        // Set canvas to fill container and calculate initial view
        this.resizeCanvas();
        this.fitCanvasToView();
        this.selectedColor = '#FFFFFF';
        this.colors = [];
        this.pixels = {};
        this.cooldownTimer = null;
        this.hoverX = -1;
        this.hoverY = -1;
        this.isTrackpad = this.detectTrackpad();
        this.showGrid = true;

        this.init();
    }

    detectTrackpad() {
        // Check if we're on macOS (most likely to have trackpad)
        const isMac = navigator.platform.toLowerCase().includes('mac');

        // Check for touch capability (indicates trackpad/touchscreen)
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // For now, assume Mac users have trackpad, others have mouse
        // This can be refined with more sophisticated detection if needed
        return isMac || hasTouch;
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    fitCanvasToView() {
        // Calculate scale to fit entire canvas in view
        const borderWidth = 20; // Account for the drawn border
        const availableWidth = this.canvas.width - borderWidth;
        const availableHeight = this.canvas.height - borderWidth;

        const scaleX = availableWidth / this.canvasWidth;
        const scaleY = availableHeight / this.canvasHeight;
        this.scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for comfortable padding

        // Center the canvas
        this.offsetX = (this.canvas.width - this.canvasWidth * this.scale) / 2;
        this.offsetY = (this.canvas.height - this.canvasHeight * this.scale) / 2;
    }

    async init() {
        await this.loadColors();
        await this.loadCanvas();
        this.setupEventListeners();
        this.setupWebSocket();
        this.checkCooldown();
        this.render();
    }

    async loadColors() {
        try {
            const response = await fetch('/api/colors');
            const data = await response.json();
            this.colors = data.colors;
            this.renderColorPalette();
        } catch (error) {
            console.error('Failed to load colors:', error);
        }
    }

    async loadCanvas() {
        try {
            const response = await fetch('/api/canvas');
            const data = await response.json();
            this.pixels = data.pixels;
            this.render();
        } catch (error) {
            console.error('Failed to load canvas:', error);
        }
    }

    renderColorPalette() {
        const colorGrid = document.getElementById('color-grid');
        colorGrid.innerHTML = '';

        this.colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => this.selectColor(color));

            if (color === this.selectedColor) {
                swatch.classList.add('selected');
            }

            colorGrid.appendChild(swatch);
        });

        this.updateSelectedColorPreview();
    }

    selectColor(color) {
        this.selectedColor = color;
        this.renderColorPalette();
        this.updateSelectedColorPreview();
    }

    updateSelectedColorPreview() {
        const preview = document.getElementById('current-color');
        preview.style.backgroundColor = this.selectedColor;
    }

    setupEventListeners() {
        // Canvas click
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Mouse move for coordinates
        this.canvas.addEventListener('mousemove', (e) => this.updateCoordinates(e));

        // Clear hover when mouse leaves canvas
        this.canvas.addEventListener('mouseleave', () => {
            this.hoverX = -1;
            this.hoverY = -1;
            this.render();
        });

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoom-out').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('reset-zoom').addEventListener('click', () => this.resetZoom());
        document.getElementById('toggle-grid').addEventListener('click', () => this.toggleGrid());

        // Mouse wheel/trackpad zoom and pan
        this.canvas.addEventListener('wheel', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (this.isTrackpad) {
                // Trackpad behavior - prevent all scrolling, use for pan/zoom
                e.preventDefault();
                e.stopPropagation();

                // Check if this is a pinch/zoom gesture (ctrlKey is set for trackpad pinch)
                if (e.ctrlKey) {
                    // Zoom behavior
                    const worldX = (mouseX - this.offsetX) / this.scale;
                    const worldY = (mouseY - this.offsetY) / this.scale;

                    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                    const newScale = Math.max(0.1, Math.min(10, this.scale * zoomFactor));

                    this.offsetX = mouseX - worldX * newScale;
                    this.offsetY = mouseY - worldY * newScale;
                    this.scale = newScale;
                } else {
                    // Pan behavior (two-finger scroll)
                    this.offsetX -= e.deltaX * 0.5;
                    this.offsetY -= e.deltaY * 0.5;
                }
            } else {
                // Mouse wheel behavior - only zoom, don't prevent page scroll unless over canvas
                e.preventDefault();

                // Zoom behavior
                const worldX = (mouseX - this.offsetX) / this.scale;
                const worldY = (mouseY - this.offsetY) / this.scale;

                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                const newScale = Math.max(0.1, Math.min(10, this.scale * zoomFactor));

                this.offsetX = mouseX - worldX * newScale;
                this.offsetY = mouseY - worldY * newScale;
                this.scale = newScale;
            }

            this.render();
        }, { passive: false });

        // Improved panning - works with left click drag (space + drag) or middle/right click
        let isDragging = false;
        let dragButton = -1;
        let lastX, lastY;

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
                isDragging = true;
                dragButton = e.button;
                lastX = e.clientX;
                lastY = e.clientY;
                this.canvas.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                this.offsetX += deltaX;
                this.offsetY += deltaY;
                this.render();
                lastX = e.clientX;
                lastY = e.clientY;
                e.preventDefault();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (isDragging) {
                isDragging = false;
                dragButton = -1;
                this.canvas.style.cursor = 'crosshair';
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case '=':
                case '+':
                    this.zoom(1.2);
                    e.preventDefault();
                    break;
                case '-':
                    this.zoom(0.8);
                    e.preventDefault();
                    break;
                case '0':
                    this.resetZoom();
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                    this.offsetY += 50;
                    this.render();
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    this.offsetY -= 50;
                    this.render();
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    this.offsetX += 50;
                    this.render();
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    this.offsetX -= 50;
                    this.render();
                    e.preventDefault();
                    break;
            }
        });

        // Update cursor based on interaction mode
        this.canvas.addEventListener('mouseenter', () => {
            this.canvas.style.cursor = 'crosshair';
        });

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'pixel_update') {
                // Handle real-time pixel updates
                this.handlePixelUpdate(message.data);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.setupWebSocket(), 3000);
        };
    }

    handlePixelUpdate(data) {
        if (data.x !== undefined && data.y !== undefined && data.color) {
            this.pixels[`${data.x},${data.y}`] = data.color;
            this.render();
        }
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;
        return {
            x: Math.floor(x / 10),
            y: Math.floor(y / 10)
        };
    }

    updateCoordinates(e) {
        const coords = this.getCanvasCoordinates(e);
        document.getElementById('coordinates').textContent = `x: ${coords.x}, y: ${coords.y}`;

        // Update hover coordinates and re-render if they changed
        if (coords.x !== this.hoverX || coords.y !== this.hoverY) {
            this.hoverX = coords.x;
            this.hoverY = coords.y;
            this.render();
        }
    }

    async handleCanvasClick(e) {
        const coords = this.getCanvasCoordinates(e);

        if (coords.x < 0 || coords.x >= this.canvasWidth / 10 ||
            coords.y < 0 || coords.y >= this.canvasHeight / 10) {
            return;
        }

        await this.placePixel(coords.x, coords.y);
    }

    async placePixel(x, y) {
        try {
            const response = await fetch('/api/place-pixel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `x=${x}&y=${y}&color=${encodeURIComponent(this.selectedColor)}`,
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.pixels[`${x},${y}`] = this.selectedColor;
                this.render();
                this.startCooldownTimer(data.cooldown_until);

                // Send WebSocket update
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({x, y, color: this.selectedColor}));
                }
            } else {
                const error = await response.json();
                alert(error.detail);
                this.checkCooldown();
            }
        } catch (error) {
            console.error('Failed to place pixel:', error);
        }
    }

    async checkCooldown() {
        try {
            const response = await fetch('/api/cooldown', {
                credentials: 'include'
            });
            const data = await response.json();

            if (!data.can_place) {
                this.startCooldownTimer(null, data.remaining_seconds);
            } else {
                this.updateCooldownStatus('Ready to place', false);
            }
        } catch (error) {
            console.error('Failed to check cooldown:', error);
        }
    }

    startCooldownTimer(cooldownUntil, remainingSeconds) {
        if (this.cooldownTimer) {
            clearInterval(this.cooldownTimer);
        }

        let remaining = remainingSeconds;
        if (cooldownUntil) {
            remaining = Math.floor((new Date(cooldownUntil) - new Date()) / 1000);
        }

        if (remaining <= 0) {
            this.updateCooldownStatus('Ready to place', false);
            return;
        }

        this.cooldownTimer = setInterval(() => {
            remaining--;

            if (remaining <= 0) {
                clearInterval(this.cooldownTimer);
                this.cooldownTimer = null;
                this.updateCooldownStatus('Ready to place', false);
            } else {
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                this.updateCooldownStatus(
                    `${minutes}:${seconds.toString().padStart(2, '0')}`,
                    true
                );
            }
        }, 1000);
    }

    updateCooldownStatus(text, isOnCooldown) {
        const status = document.getElementById('cooldown-status');
        status.textContent = text;
        status.classList.toggle('on-cooldown', isOnCooldown);
    }

    zoom(factor) {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const worldX = (centerX - this.offsetX) / this.scale;
        const worldY = (centerY - this.offsetY) / this.scale;

        this.scale *= factor;
        this.scale = Math.max(0.1, Math.min(10, this.scale));

        this.offsetX = centerX - worldX * this.scale;
        this.offsetY = centerY - worldY * this.scale;

        this.render();
    }

    resetZoom() {
        this.fitCanvasToView();
        this.render();
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        const button = document.getElementById('toggle-grid');
        button.textContent = `Grid: ${this.showGrid ? 'On' : 'Off'}`;
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Draw white background
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Draw fine grid first - only if enabled
        if (this.showGrid) {
            this.ctx.strokeStyle = this.scale > 1 ? '#CCCCCC' : '#F0F0F0';
            this.ctx.lineWidth = this.scale > 1 ? 0.2 : 0.1;

            // Draw grid lines every 10 pixels
            for (let x = 0; x <= this.canvasWidth; x += 10) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvasHeight);
                this.ctx.stroke();
            }

            for (let y = 0; y <= this.canvasHeight; y += 10) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvasWidth, y);
                this.ctx.stroke();
            }
        }

        // Draw pixels over the grid (each pixel fills a 10x10 grid cell completely)
        this.ctx.imageSmoothingEnabled = true;
        for (const [coords, color] of Object.entries(this.pixels)) {
            const [x, y] = coords.split(',').map(Number);
            this.ctx.fillStyle = color;
            // Use slightly larger fill to ensure complete coverage
            this.ctx.fillRect(x * 10, y * 10, 10.1, 10.1);
        }

        // Draw thin black border around the entire canvas (outside the canvas area)
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-1, -1, this.canvasWidth + 2, this.canvasHeight + 2);

        // Draw hover highlight
        if (this.hoverX >= 0 && this.hoverY >= 0 &&
            this.hoverX < this.canvasWidth / 10 && this.hoverY < this.canvasHeight / 10) {

            // Semi-transparent overlay with selected color
            this.ctx.fillStyle = this.selectedColor + '80'; // Add alpha for transparency
            this.ctx.fillRect(this.hoverX * 10, this.hoverY * 10, 10, 10);

            // Bright border to highlight the cell
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 0.5;
            this.ctx.strokeRect(this.hoverX * 10, this.hoverY * 10, 10, 10);
        }

        this.ctx.restore();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new RPlaceCanvas();
});