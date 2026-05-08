import type { LoopRegion } from '../types'

interface TransportProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  loop: LoopRegion
  disabled: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (t: number) => void
  compact?: boolean
}

export function Transport({
  isPlaying,
  currentTime,
  duration,
  loop,
  disabled,
  onPlay,
  onPause,
  onStop,
  onSeek,
  compact,
}: TransportProps) {
  const seekMax = Math.max(0.01, duration)
  const startPct = Math.max(0, Math.min(1, loop.start / seekMax)) * 100
  const endPct = Math.max(0, Math.min(1, loop.end / seekMax)) * 100
  const showLoop = loop.enabled && loop.end > loop.start

  return (
    <div className={`transport${compact ? ' compact' : ''}`}>
      <button
        className="btn"
        onClick={isPlaying ? onPause : onPlay}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button className="btn" onClick={onStop} disabled={disabled}>
        Stop
      </button>
      <span className="time">{fmt(currentTime)}</span>
      <div className="seek-wrap">
        {showLoop && (
          <div
            className="seek-loop-region"
            style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
          />
        )}
        <input
          type="range"
          min={0}
          max={seekMax}
          step={0.01}
          value={Math.min(currentTime, duration)}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          disabled={disabled}
          className="seek"
        />
      </div>
      <span className="time">{fmt(duration)}</span>
    </div>
  )
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
