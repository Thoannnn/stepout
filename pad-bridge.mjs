#!/usr/bin/env node
/**
 * Local joystick → WebSocket bridge for browsers that miss BT Switch Pro
 * via the Gamepad API (common on Linux/Wayland Chrome).
 *
 * Reads /dev/input/js* and serves ws://127.0.0.1:8018
 * Protocol: { type:'pads', pads:[{ index, id, axes:number[], buttons:{pressed,value}[] }] }
 */
import http from 'http';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { Buffer } from 'buffer';

const PORT = 8018;
const JS_EVENT = 8; // struct js_event: uint32 time, int16 value, uint8 type, uint8 number

const pads = new Map(); // path -> state

function ensurePad(path, index) {
  if (pads.has(path)) return pads.get(path);
  const state = {
    path,
    index,
    id: 'Linux Joystick',
    axes: [0, 0, 0, 0, 0, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })),
    connected: true,
  };
  try {
    const name = fs.readFileSync(`/sys/class/input/js${index}/device/name`, 'utf8').trim();
    if (name) state.id = name;
  } catch { /* keep default */ }
  pads.set(path, state);
  return state;
}

function openJs(index) {
  const path = `/dev/input/js${index}`;
  if (!fs.existsSync(path)) return;
  let fd;
  try {
    fd = fs.openSync(path, 'r');
  } catch (e) {
    console.warn('[pad-bridge] cannot open', path, e.message);
    return;
  }
  const state = ensurePad(path, index);
  console.log('[pad-bridge] opened', path, state.id);

  const buf = Buffer.alloc(JS_EVENT);
  const readMore = () => {
    fs.read(fd, buf, 0, JS_EVENT, null, (err, n) => {
      if (err) {
        console.warn('[pad-bridge] read error', path, err.message);
        try { fs.closeSync(fd); } catch { /* */ }
        pads.delete(path);
        return;
      }
      if (n === JS_EVENT) {
        const value = buf.readInt16LE(4);
        const type = buf.readUInt8(6);
        const number = buf.readUInt8(7);
        const isInit = !!(type & 0x80);
        const kind = type & 0x7f;
        if (kind === 1) { // button
          if (number < state.buttons.length) {
            state.buttons[number] = { pressed: value !== 0, value: value !== 0 ? 1 : 0 };
          }
        } else if (kind === 2) { // axis
          while (state.axes.length <= number) state.axes.push(0);
          state.axes[number] = Math.max(-1, Math.min(1, value / 32767));
        }
        if (!isInit) state._dirty = true;
      }
      readMore();
    });
  };
  readMore();
}

for (let i = 0; i < 8; i++) openJs(i);
// Hot-plug poll
setInterval(() => {
  for (let i = 0; i < 8; i++) {
    const path = `/dev/input/js${i}`;
    if (fs.existsSync(path) && ![...pads.values()].some((p) => p.index === i)) openJs(i);
  }
}, 2000);

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({
    ok: true,
    pads: [...pads.values()].map((p) => ({ index: p.index, id: p.id })),
  }));
});

const wss = new WebSocketServer({ server });
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'hello', pads: snapshot() }));
  ws.on('close', () => clients.delete(ws));
});

function snapshot() {
  return [...pads.values()]
    .sort((a, b) => a.index - b.index)
    .map((p) => ({
      index: p.index,
      id: p.id,
      connected: true,
      mapping: '',
      axes: p.axes.slice(),
      buttons: p.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
    }));
}

setInterval(() => {
  if (!clients.size) return;
  const msg = JSON.stringify({ type: 'pads', pads: snapshot() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}, 1000 / 120);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pad-bridge] ws://127.0.0.1:${PORT}  (js devices: ${pads.size})`);
});
