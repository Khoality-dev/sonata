# my-piano-app

A falling-notes MIDI piano player, packaged as a desktop app (Electron). Load a `.mid` file, watch falling notes, hear playback, and connect a real piano via Web MIDI to light up keys live.

## Stack

- Electron (desktop shell, `electron/main.cjs`)
- React 18 + TypeScript + Vite (renderer)
- `@tonejs/midi` for parsing
- `soundfont-player` for instruments (MusyngKite GM soundfont, CDN-hosted via gleitz.github.io)
- `Tone.js` for the FX chain (EQ3 → Reverb → Limiter) and AudioContext management. Output routing uses `AudioContext.setSinkId` (Audio Output Devices API).
- HTML5 Canvas (RAF-driven) for the falling-notes view
- Web MIDI API for hardware piano input

## Run

```
npm install
npm run dev          # Vite + Electron concurrently (recommended)
npm run dev:web      # browser-only mode at http://127.0.0.1:5173
npm run start        # run Electron against last build
npm run build        # produce installer in ./release (electron-builder)
# install silently: & "release\my-piano-app Setup 0.1.0.exe" /S  -> %LOCALAPPDATA%\Programs\my-piano-app
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
  audio/synth.ts           soundfont-player + Tone EQ3/Reverb/Limiter chain, instrument switching, output device selection
  hooks/usePlayback.ts     RAF loop, schedules audio + activeNotes, loop wrap, wait-mode
  hooks/useMidiInput.ts    React wrapper around midi/input + audio passthrough
  hooks/useAudioOutput.ts  enumerate audio outputs + setSinkId routing
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
  components/InstrumentSelect.tsx, AudioOutputSelect.tsx
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
- `waitForKeys`: when on, the playback clock clamps at the start time of the next upcoming practice note until that key is *freshly* held — see consumedKeys below. Chords work because each note clamps in turn until all are held.
- **consumedKeys**: a Set inside `usePlayback` tracking midis whose current hold has already satisfied a practice note. The wait check requires `liveNotes.has(midi) && !consumedKeys.has(midi)`. When the user releases a key (it leaves `liveNotes`), it's auto-removed from `consumedKeys` on the next tick, so a re-press is once again "fresh". This prevents a single sustained press from satisfying multiple disconnected notes.

### Audio engine

- The signal chain is **instrument backends → Tone.Gain (shared input) → EQ3 → Reverb → Limiter → Master Volume → destination**. Reverb (decay 2.6s, wet 0.22) gives the dry samples a small concert-room body; the EQ3 adds a touch of warmth (+1 dB low, −1 dB high); the limiter (-1 dBFS) catches peaks when many notes overlap; master volume (`Tone.Volume`) is exposed via `setMasterVolumeFraction(0..1)` and mapped through `Tone.gainToDb` for perceptual feel.
- **First-note delay fix**: Web Audio idles its output thread until the first sound, which makes the very first triggered note arrive ~50–150 ms late. After init, a silent `OscillatorNode` (gain = 0) runs continuously to keep the audio output thread warm, so notes play immediately. Audio is also pre-initialized at file-load time (still a user gesture from the file picker) so by the time the user hits Play, all instruments are loaded and the chain is hot.
- **Live-MIDI keypress latency**: in `useMidiInput`, `audio.noteOn` is called BEFORE updating React state and BEFORE the per-track color resolution scan (which is O(N) over all song notes). When the audio engine is already initialized, `noteOn` is invoked synchronously instead of through `initAudio().then(...)` to skip the microtask defer. `noteOff` follows the same ordering. `midiToNoteName` caches its 128 possible results so each press doesn't construct a fresh `Tone.Frequency`.
- **Tone lookAhead delay (Salamander path)**: `Tone.Sampler.triggerAttack`/`triggerRelease` with no explicit time argument schedule at `now()` = `context.currentTime + lookAhead`, and Tone's default `lookAhead` is **100 ms** — a fixed audible delay on every live keypress for the default acoustic grand. The Salamander `noteOn`/`noteOff` pass `Tone.immediate()` (= `currentTime`, no look-ahead) so the note fires now. The soundfont-player path never had this issue because it already passes `ctx.currentTime` explicitly.
- **Live keypress latency budget** (measured 2026-09-04, Chrome, 44.1 kHz): `AudioContext.baseLatency` = 10 ms (interactive hint); the Salamander MP3s have ~13–16 ms of near-silence before the hammer attack (GM piano MP3s ~5 ms); the Limiter's DynamicsCompressor adds ~6 ms. Everything else is the OS output device (`ctx.outputLatency`, ~20–40 ms for wired WASAPI, 150–300 ms for Bluetooth). If latency feels large, first confirm the running binary actually contains the lookAhead fix: `dist/` and `release/` are only refreshed by `npm run build` / `build:dir`, so `npm run start` or the installer can silently run stale code — use `npm run dev` or rebuild.
- **Hybrid backend**: `acoustic_grand_piano` uses a **Tone.Sampler** loaded from the **Salamander Grand V3** sample set (Yamaha C5, multi-octave, hosted at `https://tonejs.github.io/audio/salamander/`). It sounds noticeably better than MusyngKite's GM piano and is worth the dedicated path. All other instruments use **soundfont-player** with MusyngKite. `isSalamander(id)` switches `noteOn` / `noteOff` / `ensureInstrument` between backends. Both feed the same Tone.Gain so the FX chain is shared.
- **Multi-instrument**: `synth.ts` keeps a `Map<InstrumentId, SoundfontPlayer>` cache. `ensureInstrument(id)` is idempotent and de-dups concurrent loads via `loadingPromises`. `noteOn(midi, vel, instrumentId)` and `noteOff(midi, instrumentId)` operate per instrument, with active notes keyed `${midi}|${instrument}` so the same MIDI number can sound through different instruments simultaneously.
- **Per-track instrument**: each `TrackInfo.defaultInstrument` is derived from `@tonejs/midi`'s GM program name (via `instrumentFromMidiName`). `App` keeps a `trackInstruments: Record<trackIdx, InstrumentId>` map exposed via a ref so `usePlayback` reads the current instrument for each note without re-creating the RAF callback. The user can override per-track in the Tracks panel.
- **Live MIDI input** uses a separate `liveInstrument` (default acoustic grand). `useMidiInput` records the instrument used at noteOn so noteOff stops the same player even if the user changed `liveInstrument` mid-key.
- `INSTRUMENTS` exposes a curated GM subset grouped by family (Piano / Keys / Mallet / Strings / Organ / Reed / Guitar / Vocal / Pad). Each instrument lazy-loads its samples from `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/<name>-mp3.js` on first use (~300–800 KB each). On song load, all distinct track instruments are preloaded in parallel.
- `setAudioOutput(deviceId)` calls `AudioContext.setSinkId` (Audio Output Devices API). Electron's permission handler in `electron/main.cjs` allows `'media'` so device labels appear without a prompt; the renderer's `useAudioOutput` hook also calls `getUserMedia({audio: true})` once if labels are blank.

### Live keypress colors

When the user presses a MIDI key, `useMidiInput` calls `resolveLiveNoteTrackRef.current(midi)` (provided by App) to find the closest upcoming song note with the same MIDI number that's assigned to a hand (within ±1.0s of `currentTime`). The matched track index is stored in `liveNoteTracks` so the App can derive `liveNoteColors: Map<midi, color>` and pass it to `Piano`. Falls back to amber if no match. Same approach is used for `playbackNoteColors` so currently-sounding song notes light up in their track's color too.

CSS uses a per-key custom property (`--live-color` / `--playback-color`) and `color-mix(in srgb, ...)` to lighten/darken the gradient stops, so any user-picked color renders consistently on white and black keys.

### Lead-in

`leadInSec` (default 2.0s) is applied via `useMemo` in App: notes get shifted forward by leadInSec and `song.duration` grows accordingly. This adds empty space at the start so falling notes have room to enter from the top of the canvas before they hit the keyboard. Configurable in Setup → Performance. Changing it resets playback (because `song` reference changes, which `usePlayback` reacts to).

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

## Screenshots

`assets/` holds JPG screenshots of each scene (`01-load`, `02-setup`, `03-play`, `04-practice`), captured at 1400×900 via `npm run dev:web` + Playwright with `D:\Piano\River Flows In You.mid`. Re-capture after UI changes. Playwright MCP can only upload files inside the repo, so copy the `.mid` into the repo temporarily (e.g. `.playwright-mcp/`, git-ignored) and delete it after.
