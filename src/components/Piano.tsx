import { memo, useMemo } from 'react'
import { allKeys, isBlackKey, keyGeometry, midiToName, MIN_MIDI } from '../utils/notes'

interface PianoProps {
  height: number
  playbackNotes: ReadonlySet<number>
  liveNotes: ReadonlySet<number>
}

function PianoImpl({ height, playbackNotes, liveNotes }: PianoProps) {
  const keys = useMemo(() => allKeys(), [])
  const blackHeight = Math.round(height * 0.6)

  return (
    <div className="piano" style={{ height }}>
      <div className="piano-row piano-white-row">
        {keys.filter((m) => !isBlackKey(m)).map((midi) => {
          const geom = keyGeometry(midi)
          const isPlayback = playbackNotes.has(midi)
          const isLive = liveNotes.has(midi)
          const showLabel = midi % 12 === 0 // Cs
          return (
            <div
              key={midi}
              className={`key key-white${isPlayback ? ' active-playback' : ''}${isLive ? ' active-live' : ''}`}
              style={{
                left: `${geom.x * 100}%`,
                width: `${geom.width * 100}%`,
              }}
            >
              {showLabel && <span className="key-label">{midiToName(midi)}</span>}
            </div>
          )
        })}
      </div>
      <div className="piano-row piano-black-row" style={{ height: blackHeight }}>
        {keys.filter((m) => isBlackKey(m)).map((midi) => {
          const geom = keyGeometry(midi)
          const isPlayback = playbackNotes.has(midi)
          const isLive = liveNotes.has(midi)
          return (
            <div
              key={midi}
              className={`key key-black${isPlayback ? ' active-playback' : ''}${isLive ? ' active-live' : ''}`}
              style={{
                left: `${geom.x * 100}%`,
                width: `${geom.width * 100}%`,
              }}
            />
          )
        })}
      </div>
      {/* Subtle reference line for middle C */}
      <div
        className="middle-c-marker"
        style={{ left: `${keyGeometry(60).x * 100 + (keyGeometry(60).width * 100) / 2}%` }}
        title={`Middle C (MIDI ${MIN_MIDI})`}
      />
    </div>
  )
}

export const Piano = memo(PianoImpl)
