# my-piano-app

A falling-notes MIDI piano player, packaged as a desktop app (Electron). Load a `.mid` file, watch falling notes, hear playback, and connect a real piano via Web MIDI to light up keys live.

## Stack

- Electron (desktop shell, `electron/main.cjs`)
- React 18 + TypeScript + Vite (renderer)
- `@tonejs/midi` for parsing
- `Tone.js` Sampler with Salamander piano samples (CDN: `https://tonejs.github.io/audio/salamander/`) for audio
- HTML5 Canvas (RAF-driven) for the falling-notes view
- Web MIDI API for hardware piano input

## Run

```
npm install
npm run dev          # Vite + Electron concurrently (recommended)
npm run dev:web      # browser-only mode at http://127.0.0.1:5173
npm run start        # run Electron against last build
npm run build        # produce installer in ./release (electron-builder)
npm run build:dir    # unpacked build in ./release/win-unpacked (faster)
```

The first audio play triggers a sample download (~5 MB) from the Salamander CDN — needs internet.

## Electron specifics

- Main process: `electron/main.cjs`. Loads `http://127.0.0.1:5173` in dev (set via `VITE_DEV_SERVER_URL` if you change ports), `dist/index.html` in production.
- `vite.config.ts` uses `base: './'` so the production build serves correctly via `file://`.
- Web MIDI permission is auto-granted in `setPermissionRequestHandler` / `setPermissionCheckHandler` — the app is single-user so no prompt UX is needed.
- `webPreferences`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer is treated like a regular web page; if you need IPC later, add a `preload.cjs` and exposeInMainWorld.
- electron-builder config lives under `"build"` in `package.json`. Output goes to `release/`.

## Architecture

```
electron/
  main.cjs                 Electron main process (window, MIDI permissions)
src/
  main.tsx                 React entry
  App.tsx                  scene state machine (load → setup → play) + breadcrumb
  styles.css               dark theme + key states + scene/toolbar layouts
  types.ts                 Note, Song, TrackInfo, HandModes, LoopRegion
  utils/notes.ts           88-key geometry, MIDI<->name, hand colors
  midi/parser.ts           File -> Song via @tonejs/midi (with track classification)
  midi/input.ts            Web MIDI manager (devices, note on/off)
  audio/synth.ts           Tone.Sampler singleton, init/noteOn/noteOff
  hooks/usePlayback.ts     RAF loop, schedules audio + activeNotes, loop wrap, wait-mode
  hooks/useMidiInput.ts    React wrapper around midi/input + audio passthrough
  scenes/LoadScene.tsx     Step 1: file picker
  scenes/SetupScene.tsx    Step 2: tracks, hand modes, performance settings
  scenes/PlayScene.tsx     Step 3: falling-notes view + compact toolbar
  components/Piano.tsx     88-key DOM keyboard
  components/FallingNotes.tsx  canvas (hand-colored, mode-aware, loop overlay)
  components/Transport.tsx  play/pause/stop + seek bar (with loop region)
  components/LoopControls.tsx   Loop on/off, Set A/B, Clear
  components/PracticePanel.tsx  expanded Listen/Practice/Off + wait toggle (Setup)
  components/HandModesCompact.tsx  tiny L/P/× toggle row + wait checkbox (Play toolbar)
  components/TracksPanel.tsx    per-track Left/Right/Hide assignment + bulk + reset
  components/SpeedControl.tsx, LookaheadControl.tsx, MidiDeviceSelect.tsx, FileLoader.tsx
```

### Scene flow

The UI is split into three steps so the play view stays focused on the falling-notes visualization rather than packing every control into one screen.

1. **Load** — welcome card with the file picker. Auto-advances to Setup when a file parses successfully.
2. **Setup** — Tracks panel (full-width, can show many tracks comfortably) + Practice modes + Performance row (speed / lookahead / MIDI device). User clicks **Continue → Play**.
3. **Play** — compact 2-row toolbar above the canvas: row 1 = back / song / play-pause-stop / seek / time, row 2 = Loop A/B / hand-mode tiny toggles / wait / speed / lookahead / MIDI device. Going back to Setup pauses playback.

A breadcrumb in the header (`1. Load › 2. Setup › 3. Play`) lets the user jump between steps once a song is loaded.

### Track assignments + practice modes

There are two layers controlling what plays and how:

1. **Per track** (`TrackAssignments`, `TracksPanel`): each track is assigned to `'left' | 'right' | 'off'`. `'off'` hides the track entirely. The default assignment is computed at parse time per track via this heuristic: track-name hints (`left`/`bass`/`lh`, `right`/`treble`/`rh`/`melody`) → if exactly two non-empty tracks, the one with higher avg pitch becomes `right` → otherwise the track's avg pitch is compared to MIDI 60 (Middle C). `Note.hand` is **not** stored on notes anymore — it's derived at runtime via `assignments[note.track]`.
2. **Per hand** (`HandModes`, `PracticePanel`): each hand is `'listen' | 'practice' | 'off'`. This is global across all tracks assigned to that hand.
   - `'listen'` plays audio + draws solid falling notes.
   - `'practice'` draws outlined falling notes and does NOT play audio for that hand — the user plays it. The user's MIDI input drives audio + the keyboard highlight.
   - `'off'` mutes/hides the whole hand.
- `waitForKeys`: when on, the playback clock clamps at the start time of the next upcoming practice note until that key is held in `liveNotes`. Chords work because each note clamps in turn until all are held.

### Loop A/B

`LoopRegion` = `{ enabled, start, end }`. When enabled and `t >= end`, `usePlayback` releases sustaining notes, jumps `currentTime` back to `start`, and resets `nextNoteIdx`. The seek bar shows the loop region and `FallingNotes` draws a faint purple band over the loop range so the user can see the boundaries during playback.

Two key-state sources combine on the keyboard:

- `playbackNotes` — notes currently sounding from the loaded MIDI file (blue glow)
- `liveNotes` — notes pressed on the connected MIDI device (amber glow); both = green

`usePlayback` exposes `currentTimeRef` (a ref updated every frame) so `FallingNotes` can drive its own canvas RAF without re-rendering React on every frame. UI time (seek bar) syncs at ~10 Hz.

## Notes for future work

- Practice mode (wait for the right note before advancing): compare `liveNotes` against the next upcoming note in `usePlayback` and stall the clock until it matches.
- Per-track filtering / left-vs-right-hand colors: extend `App` state with a `Set<number>` of muted tracks; filter in `FallingNotes` and skip `audio.noteOn` in the playback loop.
- Better piano sound or offline mode: swap `Tone.Sampler` URL set or bundle samples locally.
- The keyboard renders 88 keys edge-to-edge; on narrow viewports keys get cramped. Add horizontal scroll or a zoomable subrange if needed.
