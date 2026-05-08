import type { HandModes, Song, TrackAssignments } from '../types'
import type { MidiDevice } from '../midi/input'
import { TracksPanel } from '../components/TracksPanel'
import { PracticePanel } from '../components/PracticePanel'
import { SpeedControl } from '../components/SpeedControl'
import { LookaheadControl } from '../components/LookaheadControl'
import { MidiDeviceSelect } from '../components/MidiDeviceSelect'

interface SetupSceneProps {
  song: Song
  trackAssignments: TrackAssignments
  onTrackAssignmentsChange: (next: TrackAssignments) => void
  trackColors: Record<number, string>
  onTrackColorChange: (trackIdx: number, color: string) => void
  onResetTrackDefaults: () => void

  handModes: HandModes
  onHandModesChange: (next: HandModes) => void

  waitForKeys: boolean
  onWaitChange: (next: boolean) => void

  rate: number
  onRateChange: (r: number) => void

  lookahead: number
  onLookaheadChange: (n: number) => void

  midi: {
    supported: boolean
    devices: MidiDevice[]
    selectedId: string | null
    onSelect: (id: string | null) => void
    error: string | null
  }

  onBack: () => void
  onContinue: () => void
}

export function SetupScene(props: SetupSceneProps) {
  const { song } = props
  const trackCount = song.tracks.filter((t) => t.noteCount > 0).length

  return (
    <div className="scene setup-scene">
      <div className="scene-header">
        <button className="btn" onClick={props.onBack}>← Back</button>
        <div className="scene-title">
          <div className="step-pill">Step 2 of 3 · Configure</div>
          <h2>{song.name}</h2>
          <span className="muted">
            {trackCount} track{trackCount === 1 ? '' : 's'} · {fmt(song.duration)} · {Math.round(song.tempo)} BPM
          </span>
        </div>
        <button className="btn primary" onClick={props.onContinue}>Continue to Play →</button>
      </div>

      <div className="scene-body">
        <section className="setup-section">
          <h3>Tracks</h3>
          <p className="section-help">Assign each track to a hand or hide it. The defaults come from track names and pitch ranges.</p>
          <TracksPanel
            song={song}
            assignments={props.trackAssignments}
            onChange={props.onTrackAssignmentsChange}
            colors={props.trackColors}
            onColorChange={props.onTrackColorChange}
            onResetDefaults={props.onResetTrackDefaults}
          />
        </section>

        <section className="setup-section">
          <h3>Practice mode</h3>
          <p className="section-help">Choose what each hand does during playback. Practice mutes the audio for that hand — you play it.</p>
          <PracticePanel
            handModes={props.handModes}
            onChange={props.onHandModesChange}
            waitForKeys={props.waitForKeys}
            onWaitChange={props.onWaitChange}
            waitingForNote={false}
          />
        </section>

        <section className="setup-section">
          <h3>Performance</h3>
          <div className="setup-row">
            <SpeedControl rate={props.rate} onChange={props.onRateChange} />
            <LookaheadControl value={props.lookahead} onChange={props.onLookaheadChange} />
            <MidiDeviceSelect
              supported={props.midi.supported}
              devices={props.midi.devices}
              selectedId={props.midi.selectedId}
              onSelect={props.midi.onSelect}
            />
          </div>
          {props.midi.error && <div className="error">{props.midi.error}</div>}
        </section>
      </div>
    </div>
  )
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
