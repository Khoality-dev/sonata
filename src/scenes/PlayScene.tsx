import type { HandModes, LoopRegion, Song, TrackAssignments } from '../types'
import type { MidiDevice } from '../midi/input'
import type { InstrumentId } from '../audio/synth'
import { Transport } from '../components/Transport'
import { LoopControls } from '../components/LoopControls'
import { SpeedControl } from '../components/SpeedControl'
import { LookaheadControl } from '../components/LookaheadControl'
import { MidiDeviceSelect } from '../components/MidiDeviceSelect'
import { InstrumentSelect } from '../components/InstrumentSelect'
import { VolumeControl } from '../components/VolumeControl'
import { HandModesCompact } from '../components/HandModesCompact'
import { FallingNotes } from '../components/FallingNotes'
import { Piano } from '../components/Piano'
import { useAnyInstrumentLoading } from '../hooks/useInstrumentStatus'

const PIANO_HEIGHT = 140

interface PlaySceneProps {
  song: Song

  isPlaying: boolean
  currentTime: number
  duration: number
  rate: number
  waitingForNote: boolean
  activeNotes: ReadonlySet<number>
  liveNotes: ReadonlySet<number>
  currentTimeRef: React.MutableRefObject<number>

  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (t: number) => void
  onRateChange: (r: number) => void

  loop: LoopRegion
  onLoopChange: (next: LoopRegion) => void

  handModes: HandModes
  onHandModesChange: (next: HandModes) => void
  handModesRef: React.MutableRefObject<HandModes>

  waitForKeys: boolean
  onWaitChange: (next: boolean) => void

  trackAssignmentsRef: React.MutableRefObject<TrackAssignments>
  trackColorsRef: React.MutableRefObject<Record<number, string>>
  loopRef: React.MutableRefObject<LoopRegion>

  lookahead: number
  onLookaheadChange: (n: number) => void

  midi: {
    supported: boolean
    devices: MidiDevice[]
    selectedId: string | null
    onSelect: (id: string | null) => void
  }

  liveInstrument: InstrumentId
  onLiveInstrumentChange: (id: InstrumentId) => void

  volume: number
  onVolumeChange: (n: number) => void

  playbackNoteColors: ReadonlyMap<number, string>
  liveNoteColors: ReadonlyMap<number, string>

  onBack: () => void
}

export function PlayScene(props: PlaySceneProps) {
  const anyLoading = useAnyInstrumentLoading()
  return (
    <div className="scene play-scene">
      <div className="play-toolbar">
        <div className="toolbar-row">
          <button className="btn small" onClick={props.onBack}>← Setup</button>
          <span className="song-name">{props.song.name}</span>
          <div className="spacer" />
          <Transport
            isPlaying={props.isPlaying}
            currentTime={props.currentTime}
            duration={props.duration}
            loop={props.loop}
            disabled={false}
            onPlay={props.onPlay}
            onPause={props.onPause}
            onStop={props.onStop}
            onSeek={props.onSeek}
            compact
          />
        </div>

        <div className="toolbar-row secondary">
          <LoopControls
            loop={props.loop}
            duration={props.duration}
            currentTime={props.currentTime}
            onChange={props.onLoopChange}
          />
          <div className="divider" />
          <HandModesCompact
            handModes={props.handModes}
            onChange={props.onHandModesChange}
            waitForKeys={props.waitForKeys}
            onWaitChange={props.onWaitChange}
            waitingForNote={props.waitingForNote}
          />
          <div className="divider" />
          <InstrumentSelect
            value={props.liveInstrument}
            loading={anyLoading}
            onChange={props.onLiveInstrumentChange}
            compact
            label="Live"
          />
          <VolumeControl value={props.volume} onChange={props.onVolumeChange} compact />
          <SpeedControl rate={props.rate} onChange={props.onRateChange} compact />
          <LookaheadControl value={props.lookahead} onChange={props.onLookaheadChange} compact />
          <MidiDeviceSelect
            supported={props.midi.supported}
            devices={props.midi.devices}
            selectedId={props.midi.selectedId}
            onSelect={props.midi.onSelect}
            compact
          />
        </div>
      </div>

      <main className="stage">
        <FallingNotes
          song={props.song}
          currentTimeRef={props.currentTimeRef}
          handModesRef={props.handModesRef}
          trackAssignmentsRef={props.trackAssignmentsRef}
          trackColorsRef={props.trackColorsRef}
          loopRef={props.loopRef}
          lookaheadSec={props.lookahead}
        />
        <Piano
          height={PIANO_HEIGHT}
          playbackNotes={props.activeNotes}
          liveNotes={props.liveNotes}
          playbackNoteColors={props.playbackNoteColors}
          liveNoteColors={props.liveNoteColors}
        />
      </main>
    </div>
  )
}
