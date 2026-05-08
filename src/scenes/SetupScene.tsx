import type { HandModes, Song, TrackAssignments, TrackInstruments } from '../types'
import type { MidiDevice } from '../midi/input'
import type { AudioOutputDevice, InstrumentId } from '../audio/synth'
import { TracksPanel } from '../components/TracksPanel'
import { PracticePanel } from '../components/PracticePanel'
import { SpeedControl } from '../components/SpeedControl'
import { LookaheadControl } from '../components/LookaheadControl'
import { LeadInControl } from '../components/LeadInControl'
import { MidiDeviceSelect } from '../components/MidiDeviceSelect'
import { InstrumentSelect } from '../components/InstrumentSelect'
import { AudioOutputSelect } from '../components/AudioOutputSelect'
import { VolumeControl } from '../components/VolumeControl'
import { useAnyInstrumentLoading } from '../hooks/useInstrumentStatus'

interface SetupSceneProps {
  song: Song
  trackAssignments: TrackAssignments
  onTrackAssignmentsChange: (next: TrackAssignments) => void
  trackColors: Record<number, string>
  onTrackColorChange: (trackIdx: number, color: string) => void
  trackInstruments: TrackInstruments
  onTrackInstrumentChange: (trackIdx: number, id: InstrumentId) => void
  onResetTrackDefaults: () => void

  handModes: HandModes
  onHandModesChange: (next: HandModes) => void

  waitForKeys: boolean
  onWaitChange: (next: boolean) => void

  rate: number
  onRateChange: (r: number) => void

  lookahead: number
  onLookaheadChange: (n: number) => void

  leadInSec: number
  onLeadInChange: (n: number) => void

  midi: {
    supported: boolean
    devices: MidiDevice[]
    selectedId: string | null
    onSelect: (id: string | null) => void
    error: string | null
  }

  liveInstrument: InstrumentId
  onLiveInstrumentChange: (id: InstrumentId) => void

  volume: number
  onVolumeChange: (n: number) => void

  audioOutput: {
    supported: boolean
    devices: AudioOutputDevice[]
    selectedId: string
    onSelect: (id: string) => void
    onRefresh: () => Promise<void>
    error: string | null
  }

  onBack: () => void
  onContinue: () => void
}

export function SetupScene(props: SetupSceneProps) {
  const { song } = props
  const trackCount = song.tracks.filter((t) => t.noteCount > 0).length
  const anyLoading = useAnyInstrumentLoading()

  return (
    <div className="scene setup-scene">
      <div className="scene-header">
        <button className="btn" onClick={props.onBack}>← Back</button>
        <div className="scene-title">
          <div className="step-pill">Step 2 of 3 · Configure</div>
          <h2>{song.name}</h2>
          <span className="muted">
            {trackCount} track{trackCount === 1 ? '' : 's'} · {fmt(song.duration)} · {Math.round(song.tempo)} BPM
            {anyLoading && <span className="muted"> · loading sounds…</span>}
          </span>
        </div>
        <button className="btn primary" onClick={props.onContinue}>Continue to Play →</button>
      </div>

      <div className="scene-body">
        <section className="setup-section">
          <h3>Tracks</h3>
          <p className="section-help">Assign each track to a hand, hide it, or change its instrument. Defaults come from track names, pitch ranges, and embedded MIDI program numbers.</p>
          <TracksPanel
            song={song}
            assignments={props.trackAssignments}
            onChange={props.onTrackAssignmentsChange}
            colors={props.trackColors}
            onColorChange={props.onTrackColorChange}
            instruments={props.trackInstruments}
            onInstrumentChange={props.onTrackInstrumentChange}
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
          <h3>Sound</h3>
          <p className="section-help">The live instrument is what your connected MIDI keyboard plays through. Each track has its own instrument set in the Tracks list above.</p>
          <div className="setup-row">
            <InstrumentSelect
              value={props.liveInstrument}
              loading={anyLoading}
              onChange={props.onLiveInstrumentChange}
              label="Live (MIDI input)"
            />
            <VolumeControl value={props.volume} onChange={props.onVolumeChange} />
            <AudioOutputSelect
              supported={props.audioOutput.supported}
              devices={props.audioOutput.devices}
              selectedId={props.audioOutput.selectedId}
              onSelect={props.audioOutput.onSelect}
              onRefresh={props.audioOutput.onRefresh}
            />
          </div>
          {props.audioOutput.error && <div className="error">{props.audioOutput.error}</div>}
        </section>

        <section className="setup-section">
          <h3>Performance</h3>
          <div className="setup-row">
            <SpeedControl rate={props.rate} onChange={props.onRateChange} />
            <LookaheadControl value={props.lookahead} onChange={props.onLookaheadChange} />
            <LeadInControl value={props.leadInSec} onChange={props.onLeadInChange} />
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
