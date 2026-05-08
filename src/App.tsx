import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseMidiFile } from './midi/parser'
import type { HandModes, LoopRegion, Note, Song, TrackAssignments, TrackInstruments } from './types'
import { LoadScene } from './scenes/LoadScene'
import { SetupScene } from './scenes/SetupScene'
import { PlayScene } from './scenes/PlayScene'
import { usePlayback } from './hooks/usePlayback'
import { useMidiInput } from './hooks/useMidiInput'
import { useAudioOutput } from './hooks/useAudioOutput'
import { defaultTrackColor, handColor } from './utils/notes'
import {
  DEFAULT_INSTRUMENT,
  ensureInstrument,
  initAudio,
  setMasterVolumeFraction,
  type InstrumentId,
} from './audio/synth'

type Scene = 'load' | 'setup' | 'play'

const EMPTY_LOOP: LoopRegion = { enabled: false, start: 0, end: 0 }

function defaultsFromSong(song: Song): TrackAssignments {
  const result: TrackAssignments = {}
  for (const t of song.tracks) {
    result[t.index] = t.noteCount > 0 ? t.defaultAssignment : 'off'
  }
  return result
}

function defaultColorsFromSong(song: Song): Record<number, string> {
  const result: Record<number, string> = {}
  let rightCount = 0
  let leftCount = 0
  for (const t of song.tracks) {
    if (t.noteCount === 0) continue
    const hand = t.defaultAssignment
    const idx = hand === 'right' ? rightCount++ : leftCount++
    result[t.index] = defaultTrackColor(hand, idx)
  }
  return result
}

function defaultInstrumentsFromSong(song: Song): TrackInstruments {
  const result: TrackInstruments = {}
  for (const t of song.tracks) {
    if (t.noteCount === 0) continue
    result[t.index] = t.defaultInstrument
  }
  return result
}

function shiftSong(song: Song, leadInSec: number): Song {
  if (leadInSec <= 0) return song
  return {
    ...song,
    notes: song.notes.map((n) => ({ ...n, time: n.time + leadInSec })),
    duration: song.duration + leadInSec,
  }
}

export function App() {
  const [scene, setScene] = useState<Scene>('load')
  const [baseSong, setBaseSong] = useState<Song | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lookahead, setLookahead] = useState(4)
  const [leadInSec, setLeadInSec] = useState(2)

  const [handModes, setHandModes] = useState<HandModes>({ left: 'listen', right: 'listen' })
  const [waitForKeys, setWaitForKeys] = useState(false)
  const [trackAssignments, setTrackAssignments] = useState<TrackAssignments>({})
  const [trackColors, setTrackColors] = useState<Record<number, string>>({})
  const [trackInstruments, setTrackInstruments] = useState<TrackInstruments>({})
  const [loop, setLoop] = useState<LoopRegion>(EMPTY_LOOP)

  const [liveInstrument, setLiveInstrument] = useState<InstrumentId>(DEFAULT_INSTRUMENT)
  const [volume, setVolume] = useState(80) // 0..100

  useEffect(() => {
    setMasterVolumeFraction(volume / 100)
  }, [volume])

  const song = useMemo(
    () => (baseSong ? shiftSong(baseSong, leadInSec) : null),
    [baseSong, leadInSec],
  )

  const handleLiveInstrumentChange = useCallback((id: InstrumentId) => {
    setLiveInstrument(id)
    ensureInstrument(id).catch(() => {
      /* ignore — note will silently no-op until loaded */
    })
  }, [])

  const handleTrackInstrumentChange = useCallback((trackIdx: number, id: InstrumentId) => {
    setTrackInstruments((prev) => ({ ...prev, [trackIdx]: id }))
    ensureInstrument(id).catch(() => {})
  }, [])

  const audioOutput = useAudioOutput()

  const handModesRef = useRef<HandModes>(handModes)
  const waitForKeysRef = useRef(waitForKeys)
  const trackAssignmentsRef = useRef<TrackAssignments>(trackAssignments)
  const trackColorsRef = useRef<Record<number, string>>(trackColors)
  const trackInstrumentsRef = useRef<TrackInstruments>(trackInstruments)
  const loopRef = useRef<LoopRegion>(loop)
  const liveInstrumentRef = useRef<InstrumentId>(liveInstrument)
  const songRef = useRef<Song | null>(null)
  const getCurrentTimeRef = useRef<() => number>(() => 0)

  useEffect(() => { handModesRef.current = handModes }, [handModes])
  useEffect(() => { waitForKeysRef.current = waitForKeys }, [waitForKeys])
  useEffect(() => { trackAssignmentsRef.current = trackAssignments }, [trackAssignments])
  useEffect(() => { trackColorsRef.current = trackColors }, [trackColors])
  useEffect(() => { trackInstrumentsRef.current = trackInstruments }, [trackInstruments])
  useEffect(() => { loopRef.current = loop }, [loop])
  useEffect(() => { liveInstrumentRef.current = liveInstrument }, [liveInstrument])
  useEffect(() => { songRef.current = song }, [song])

  /**
   * For a live key press, find the closest upcoming note in the song with the
   * same MIDI number that's assigned to a hand (not hidden). Returns its
   * trackIdx so we can color the keyboard highlight per-track.
   */
  const resolveLiveNoteTrackRef = useRef<(midi: number) => number | null>((midi) => {
    const s = songRef.current
    if (!s) return null
    const t = getCurrentTimeRef.current()
    const window = 1.0
    const assignments = trackAssignmentsRef.current
    let best: Note | null = null
    let bestDelta = Infinity
    for (const n of s.notes) {
      if (n.midi !== midi) continue
      const a = assignments[n.track]
      if (!a || a === 'off') continue
      const delta = Math.abs(n.time - t)
      if (delta > window) continue
      if (delta < bestDelta) {
        bestDelta = delta
        best = n
      }
    }
    return best?.track ?? null
  })

  const midi = useMidiInput({ liveInstrumentRef, resolveLiveNoteTrackRef })
  const playback = usePlayback(song, {
    handModesRef,
    waitForKeysRef,
    liveNotesRef: midi.liveNotesRef,
    trackAssignmentsRef,
    trackInstrumentsRef,
    loopRef,
  })

  // Bind the live-note resolver's time-getter to playback.currentTimeRef.
  useEffect(() => {
    getCurrentTimeRef.current = () => playback.currentTimeRef.current
  }, [playback.currentTimeRef])

  const handleLoadFile = useCallback(
    async (file: File) => {
      try {
        setLoadError(null)
        const parsed = await parseMidiFile(file)
        setBaseSong(parsed)
        setTrackAssignments(defaultsFromSong(parsed))
        setTrackColors(defaultColorsFromSong(parsed))
        const instruments = defaultInstrumentsFromSong(parsed)
        setTrackInstruments(instruments)
        setLoop({ enabled: false, start: 0, end: parsed.duration + leadInSec })
        // Pre-init the audio engine NOW (we're inside a user gesture from
        // clicking the file picker) so the audio thread starts warming up.
        // Then preload all distinct instruments in parallel.
        initAudio().catch(() => {})
        const distinct = new Set<InstrumentId>(Object.values(instruments))
        distinct.add(liveInstrumentRef.current)
        for (const id of distinct) ensureInstrument(id).catch(() => {})
        setScene('setup')
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err))
      }
    },
    [leadInSec],
  )

  const handleResetTrackDefaults = useCallback(() => {
    if (!baseSong) return
    setTrackAssignments(defaultsFromSong(baseSong))
    setTrackColors(defaultColorsFromSong(baseSong))
    const instruments = defaultInstrumentsFromSong(baseSong)
    setTrackInstruments(instruments)
    for (const id of new Set<InstrumentId>(Object.values(instruments))) {
      ensureInstrument(id).catch(() => {})
    }
  }, [baseSong])

  const handleTrackColorChange = useCallback((trackIdx: number, color: string) => {
    setTrackColors((prev) => ({ ...prev, [trackIdx]: color }))
  }, [])

  const goLoad = useCallback(() => {
    playback.pause()
    setScene('load')
  }, [playback])

  const goSetup = useCallback(() => {
    playback.pause()
    setScene('setup')
  }, [playback])

  const goPlay = useCallback(() => setScene('play'), [])

  /**
   * For each MIDI number that's currently sounding from playback, find the
   * track of the (most recent) playing note so we can color the keyboard
   * highlight per-track.
   */
  const playbackNoteColors = useMemo(() => {
    const result = new Map<number, string>()
    if (!song) return result
    const t = playback.currentTime
    for (const midiNum of playback.activeNotes) {
      // Find the active note (time <= t < time+duration) with this midi
      let best: Note | null = null
      for (const n of song.notes) {
        if (n.midi !== midiNum) continue
        if (n.time > t) break
        if (n.time + n.duration > t) {
          // Pick the latest-started one if multiple overlap
          if (!best || n.time > best.time) best = n
        }
      }
      if (best) {
        const color = trackColors[best.track] ?? handColor('right')
        result.set(midiNum, color)
      }
    }
    return result
  }, [song, playback.activeNotes, playback.currentTime, trackColors])

  /**
   * Color each currently-held live key with the matching track's color.
   * If no match was found at noteOn time, the key falls back to amber via CSS.
   */
  const liveNoteColors = useMemo(() => {
    const result = new Map<number, string>()
    for (const [midiNum, trackIdx] of midi.liveNoteTracks) {
      const color = trackColors[trackIdx]
      if (color) result.set(midiNum, color)
    }
    return result
  }, [midi.liveNoteTracks, trackColors])

  return (
    <div className="app">
      <header className="header">
        <h1>my-piano-app</h1>
        <span className="tagline">Falling-notes piano player</span>
        <div className="spacer" />
        <Breadcrumb
          scene={scene}
          hasSong={!!baseSong}
          onNav={(s) => {
            if (s === 'load') goLoad()
            else if (s === 'setup' && baseSong) goSetup()
            else if (s === 'play' && baseSong) goPlay()
          }}
        />
      </header>

      {scene === 'load' && (
        <LoadScene onLoadFile={handleLoadFile} loadError={loadError} />
      )}

      {scene === 'setup' && song && (
        <SetupScene
          song={song}
          trackAssignments={trackAssignments}
          onTrackAssignmentsChange={setTrackAssignments}
          trackColors={trackColors}
          onTrackColorChange={handleTrackColorChange}
          trackInstruments={trackInstruments}
          onTrackInstrumentChange={handleTrackInstrumentChange}
          onResetTrackDefaults={handleResetTrackDefaults}
          handModes={handModes}
          onHandModesChange={setHandModes}
          waitForKeys={waitForKeys}
          onWaitChange={setWaitForKeys}
          rate={playback.rate}
          onRateChange={playback.setRate}
          lookahead={lookahead}
          onLookaheadChange={setLookahead}
          leadInSec={leadInSec}
          onLeadInChange={setLeadInSec}
          midi={{
            supported: midi.supported,
            devices: midi.devices,
            selectedId: midi.selectedId,
            onSelect: midi.select,
            error: midi.error,
          }}
          liveInstrument={liveInstrument}
          onLiveInstrumentChange={handleLiveInstrumentChange}
          volume={volume}
          onVolumeChange={setVolume}
          audioOutput={{
            supported: audioOutput.supported,
            devices: audioOutput.devices,
            selectedId: audioOutput.selectedId,
            onSelect: audioOutput.select,
            onRefresh: audioOutput.refresh,
            error: audioOutput.error,
          }}
          onBack={goLoad}
          onContinue={goPlay}
        />
      )}

      {scene === 'play' && song && (
        <PlayScene
          song={song}
          isPlaying={playback.isPlaying}
          currentTime={playback.currentTime}
          duration={playback.duration}
          rate={playback.rate}
          waitingForNote={playback.waitingForNote}
          activeNotes={playback.activeNotes}
          liveNotes={midi.liveNotes}
          currentTimeRef={playback.currentTimeRef}
          onPlay={playback.play}
          onPause={playback.pause}
          onStop={playback.stop}
          onSeek={playback.seek}
          onRateChange={playback.setRate}
          loop={loop}
          onLoopChange={setLoop}
          handModes={handModes}
          onHandModesChange={setHandModes}
          handModesRef={handModesRef}
          waitForKeys={waitForKeys}
          onWaitChange={setWaitForKeys}
          trackAssignmentsRef={trackAssignmentsRef}
          trackColorsRef={trackColorsRef}
          loopRef={loopRef}
          lookahead={lookahead}
          onLookaheadChange={setLookahead}
          midi={{
            supported: midi.supported,
            devices: midi.devices,
            selectedId: midi.selectedId,
            onSelect: midi.select,
          }}
          liveInstrument={liveInstrument}
          onLiveInstrumentChange={handleLiveInstrumentChange}
          volume={volume}
          onVolumeChange={setVolume}
          playbackNoteColors={playbackNoteColors}
          liveNoteColors={liveNoteColors}
          onBack={goSetup}
        />
      )}

      <footer className="footer">
        <span>
          {midi.devices.length > 0
            ? `${midi.devices.length} MIDI device${midi.devices.length === 1 ? '' : 's'} detected`
            : midi.supported
              ? 'No MIDI devices detected'
              : ''}
        </span>
      </footer>
    </div>
  )
}

function Breadcrumb({
  scene,
  hasSong,
  onNav,
}: {
  scene: Scene
  hasSong: boolean
  onNav: (s: Scene) => void
}) {
  const steps: { id: Scene; label: string; enabled: boolean }[] = [
    { id: 'load', label: 'Load', enabled: true },
    { id: 'setup', label: 'Setup', enabled: hasSong },
    { id: 'play', label: 'Play', enabled: hasSong },
  ]
  return (
    <nav className="breadcrumb" aria-label="Steps">
      {steps.map((s, i) => (
        <span key={s.id} className="crumb-wrap">
          {i > 0 && <span className="crumb-sep">›</span>}
          <button
            className={`crumb${scene === s.id ? ' active' : ''}`}
            onClick={() => onNav(s.id)}
            disabled={!s.enabled}
          >
            {i + 1}. {s.label}
          </button>
        </span>
      ))}
    </nav>
  )
}
