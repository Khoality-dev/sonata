import { useCallback, useEffect, useRef, useState } from 'react'
import { parseMidiFile } from './midi/parser'
import type { HandModes, LoopRegion, Song, TrackAssignments } from './types'
import { LoadScene } from './scenes/LoadScene'
import { SetupScene } from './scenes/SetupScene'
import { PlayScene } from './scenes/PlayScene'
import { usePlayback } from './hooks/usePlayback'
import { useMidiInput } from './hooks/useMidiInput'
import { defaultTrackColor } from './utils/notes'

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

export function App() {
  const [scene, setScene] = useState<Scene>('load')
  const [song, setSong] = useState<Song | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lookahead, setLookahead] = useState(4)

  const [handModes, setHandModes] = useState<HandModes>({ left: 'listen', right: 'listen' })
  const [waitForKeys, setWaitForKeys] = useState(false)
  const [trackAssignments, setTrackAssignments] = useState<TrackAssignments>({})
  const [trackColors, setTrackColors] = useState<Record<number, string>>({})
  const [loop, setLoop] = useState<LoopRegion>(EMPTY_LOOP)

  const handModesRef = useRef<HandModes>(handModes)
  const waitForKeysRef = useRef(waitForKeys)
  const trackAssignmentsRef = useRef<TrackAssignments>(trackAssignments)
  const trackColorsRef = useRef<Record<number, string>>(trackColors)
  const loopRef = useRef<LoopRegion>(loop)
  useEffect(() => {
    handModesRef.current = handModes
  }, [handModes])
  useEffect(() => {
    waitForKeysRef.current = waitForKeys
  }, [waitForKeys])
  useEffect(() => {
    trackAssignmentsRef.current = trackAssignments
  }, [trackAssignments])
  useEffect(() => {
    trackColorsRef.current = trackColors
  }, [trackColors])
  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  const midi = useMidiInput()
  const playback = usePlayback(song, {
    handModesRef,
    waitForKeysRef,
    liveNotesRef: midi.liveNotesRef,
    trackAssignmentsRef,
    loopRef,
  })

  const handleLoadFile = useCallback(async (file: File) => {
    try {
      setLoadError(null)
      const parsed = await parseMidiFile(file)
      setSong(parsed)
      setTrackAssignments(defaultsFromSong(parsed))
      setTrackColors(defaultColorsFromSong(parsed))
      setLoop({ enabled: false, start: 0, end: parsed.duration })
      setScene('setup')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleResetTrackDefaults = useCallback(() => {
    if (!song) return
    setTrackAssignments(defaultsFromSong(song))
    setTrackColors(defaultColorsFromSong(song))
  }, [song])

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

  return (
    <div className="app">
      <header className="header">
        <h1>my-piano-app</h1>
        <span className="tagline">Falling-notes piano player</span>
        <div className="spacer" />
        <Breadcrumb scene={scene} hasSong={!!song} onNav={(s) => {
          if (s === 'load') goLoad()
          else if (s === 'setup' && song) goSetup()
          else if (s === 'play' && song) goPlay()
        }} />
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
          onResetTrackDefaults={handleResetTrackDefaults}
          handModes={handModes}
          onHandModesChange={setHandModes}
          waitForKeys={waitForKeys}
          onWaitChange={setWaitForKeys}
          rate={playback.rate}
          onRateChange={playback.setRate}
          lookahead={lookahead}
          onLookaheadChange={setLookahead}
          midi={{
            supported: midi.supported,
            devices: midi.devices,
            selectedId: midi.selectedId,
            onSelect: midi.select,
            error: midi.error,
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
