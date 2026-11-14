# StepOut

Anti-gravity racer — 1P ghost challenge + 2P split-screen.

Open `index.html` via a local static server, or play the deployed Vercel URL.

## Controls

**Desktop:** WASD / arrows · Q/E airbrakes · Shift boost · gamepad supported  
**Mobile:** hold left/right = airbrake · auto thrust · swipe up = boost

## Local

```bash
python3 -m http.server 8017 --bind 127.0.0.1
# → http://127.0.0.1:8017/
```

Optional Linux pad bridge (Switch Pro when Chrome Gamepad API is empty):

```bash
npm i && npm run pad
```
