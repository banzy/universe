# Interactive 3D Universe 🌌

An immersive 3D particle universe simulation controlled by your hand gestures. Built with **Three.js** and **MediaPipe Hands**.

## ✨ Features

- **Real-time Hand Tracking**: Control the universe using your webcam.
- **3D Particle System**: Simulate 40,000 stars in a dynamic galaxy.
- **Gesture Control**:
    - **Rotate**: Turn your hand like a steering wheel OR turn your palm left/right to rotate the universe on the Z and Y axes.
    - **Compress**: Make a **Closed Fist ✊** to compress the galaxy into a pulsing, glowing Sun (with plasma effects!).
    - **Expand**: **Open Hand ✋** to reform the galaxy shape.
    - **Explode**: Flash a **Peace Sign ✌️** to trigger a "Big Bang" explosion.
    - **Scale**: Use **Two Hands** and move them apart/together to zoom in/out.
- **Dynamic Visuals**:
    - Background starfield for depth.
    - Beautiful color gradients based on stellar density.
    - "Living Sun" animation with internal glowing core.
- **Customization**:
    - Switch between templates (Galaxy, Spiral, Saturn, etc.).
    - "Lock State on Exit" toggle to freeze the universe when you leave.

## 🚀 Getting Started

1. **Clone the repository**.
2. **Serve the files**: You need a local server to handle modules and webcam permissions.
   ```bash
   # Using serve (Node.js)
   npx serve .
   
   # Or Python
   python3 -m http.server
   ```
3. **Open in Browser**: Navigate to `http://localhost:3000` (or your server's port).
4. **Allow Camera Access**: The app needs webcam access for hand tracking.

## 🛠️ Technology

- **[Three.js](https://threejs.org/)**: 3D rendering engine.
- **[MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html)**: Machine learning pipeline for hand tracking.

## 🎮 Controls

| Gesture | Action |
|---------|--------|
| **Turn Hand (Dial)** | Rotate Universe (Z-Axis) |
| **Turn Palm (L/R)** | Rotate Universe (Y-Axis) |
| **Closed Fist ✊** | Compress into Sun (Plasma Effect) |
| **Open Hand ✋** | Reform Galaxy |
| **Peace Sign ✌️** | Explode Universe |
| **Two Hands** | Scale / Zoom |
