# 🎂 Our Midnight Celebration

> **A Premium Interactive Virtual Birthday Celebration Experience for Two**
> Built with React, Three.js, WebRTC, MediaPipe Face Tracking, Web Audio API, and Socket.IO.

---

## ✨ Features & User Journey

1. **Cinematic Midnight Atmosphere**
   - Midnight purple, deep burgundy, and royal gold visual aesthetic.
   - Twinkling starfields, drifting glowing hearts, romantic ambient lighting.
   - Built-in Web Audio API procedural romantic lo-fi/piano music and celebration fanfare (100% offline, zero broken external URLs).

2. **Welcome Screen**
   - Poetic quotes: *"Tonight is not just another night... Tonight, we celebrate YOU ❤️"*.
   - Floating hearts and stars canvas.
   - Romantic music toggle.
   - Enter Celebration button with pulsing golden glow.

3. **Multiplayer Room Setup**
   - Create and Join birthday rooms with unique 6-character room codes.
   - One-click **Copy Invitation Link** (`?room=XYZ`) for effortless sharing across devices.
   - Choose your role: **Birthday Star 👑** or **Celebrating My Love 💖**.
   - Custom cake options (Name, Candles 1–21, Message, Frosting theme: Velvet Rose, Midnight Gold, Chocolate Truffle, Lavender Dream).
   - Live **Microphone & Candle Blow test** meter with sensitivity calibration.

4. **WebRTC Live Peer-to-Peer Video Call**
   - Real two-person video calling with STUN NAT traversal.
   - Prominent Birthday Star view with picture-in-picture / split toggle.
   - Camera On/Off, Mic Mute/Unmute, and Mobile Camera Flip.
   - Graceful camera permission handling and reconnection indicators.
   - Zero footage recording or upload — entirely peer-to-peer.

5. **Head-Tracked Birthday Party Hat 🎉**
   - Detects the birthday person's head position in real time using **MediaPipe Face Landmarker**.
   - Dynamic 2D/3D Party Hat overlay rendered directly on the live video stream.
   - Tracks head tilt (roll), position, and scale with exponential smoothing.
   - Bouncy 3D pom-pom that jiggles with head movement, golden foil stripes, and orbiting stars/hearts.
   - Flattering anchor fallback if face is momentarily turned away.

6. **Realistic 3D Birthday Cake 🎂**
   - Built with high-performance **Three.js**.
   - Multi-tier cake on a golden pedestal platter with fluted edge and rim pearls.
   - Cream frosting, piped borders, ganache drips, and rosettes.
   - Personalized golden plaque banner reading *"Happy Birthday [Name]"*.
   - Glowing 3D candle flames that flicker and tilt with breath wind.
   - Interactive 360° mouse / touch rotation with gentle auto-rotate.

7. **Real-Time Virtual Candle Blowing 💨**
   - Powered by the **Web Audio API** analyzing microphone frequency and energy.
   - Distinguishes sustained breath turbulence (80Hz–600Hz) from normal speech and laughter.
   - Candles waver in real time as the user blows, then extinguish with delicate rising smoke particles.
   - Extinguish state synchronizes instantly with the partner via Socket.IO.
   - Includes backup manual "Blow Candles 💨" button.

8. **Grand Full-Screen Fireworks Extravaganza 🎆**
   - Fullscreen fireworks canvas with physics-based rockets, glittering sparks, and romantic heart-shaped bursts.
   - Golden confetti cascades and ribbons.
   - Upbeat celebration music and sound effects.
   - Grand typography: *"HAPPY BIRTHDAY, MY LOVE ❤️"* — *"Even miles apart, we're celebrating together."*

9. **Synchronized Cake Cutting Ceremony 🍰**
   - Both participants participate in slicing the cake together.
   - Interactive knife descends through the cake with metallic slicing sounds.
   - The cake separates into two slices with interior moist sponge and layered cream revealed.
   - Romantic message: *"A slice of love for you, a slice of joy for me."*

10. **Romantic Surprise Ending & Love Letter 💌**
    - *"Distance means nothing when two hearts celebrate together."*
    - Interactive wax-sealed romantic envelope with crackling seal and unfolding parchment animation.
    - Customizable personal message from the host.
    - **One More Wish? 🌟**: Secret midnight wish well that releases shooting stars across the shared sky.
    - Option to relight candles and celebrate again.
    - Floating reaction bar (❤️, 😘, 🎉, ✨, 🍰) to send kisses and love across screens.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
# Root server dependencies
npm install

# Client dependencies
cd client && npm install && cd ..
```

### 2. Start the Server & Client
```bash
# Production mode (single port for both server and frontend):
npm run build
npm start
# -> Open http://localhost:3001 in your browser

# Development mode (Vite with hot-reload + Backend):
npm run dev:server
# in another terminal:
npm run dev:client
# -> Open http://localhost:5173
```

### 3. How to Celebrate with Two Devices
1. Device 1: Open `http://localhost:3001` (or your local IP / domain), click **ENTER CELEBRATION**, choose **Birthday Star 👑**, and click **Copy Invite Link**.
2. Device 2: Open the copied invite link on another browser tab, phone, or laptop.
3. Both grant camera and microphone permissions.
4. Watch the Birthday Hat automatically track the Birthday Person's head, blow the candles, enjoy the fireworks, cut the cake together, and read the romantic letter!

