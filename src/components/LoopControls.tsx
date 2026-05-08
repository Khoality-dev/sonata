import type { LoopRegion } from '../types'

interface LoopControlsProps {
  loop: LoopRegion
  duration: number
  currentTime: number
  onChange: (next: LoopRegion) => void
}

export function LoopControls({ loop, duration, currentTime, onChange }: LoopControlsProps) {
  const setStart = () => {
    const start = Math.max(0, Math.min(currentTime, duration))
    const end = loop.end > start ? loop.end : Math.min(duration, start + 1)
    onChange({ ...loop, start, end })
  }
  const setEnd = () => {
    const end = Math.max(0, Math.min(currentTime, duration))
    const start = loop.start < end ? loop.start : Math.max(0, end - 1)
    onChange({ ...loop, start, end })
  }
  const clear = () => {
    onChange({ enabled: false, start: 0, end: duration })
  }
  const toggle = () => {
    onChange({ ...loop, enabled: !loop.enabled })
  }

  return (
    <div className="loop-controls">
      <button
        className={`btn small${loop.enabled ? ' primary' : ''}`}
        onClick={toggle}
        disabled={duration <= 0}
        title="Toggle loop"
      >
        Loop {loop.enabled ? 'on' : 'off'}
      </button>
      <button className="btn small" onClick={setStart} disabled={duration <= 0}>
        Set A
      </button>
      <button className="btn small" onClick={setEnd} disabled={duration <= 0}>
        Set B
      </button>
      <button className="btn small" onClick={clear} disabled={duration <= 0}>
        Clear
      </button>
      <span className="loop-range">
        {fmt(loop.start)} – {fmt(loop.end)}
      </span>
    </div>
  )
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
