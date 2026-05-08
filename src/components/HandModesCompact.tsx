import type { Hand, HandMode, HandModes } from '../types'
import { handColor } from '../utils/notes'

interface HandModesCompactProps {
  handModes: HandModes
  onChange: (next: HandModes) => void
  waitForKeys: boolean
  onWaitChange: (next: boolean) => void
  waitingForNote: boolean
}

const MODES: HandMode[] = ['listen', 'practice', 'off']
const SHORT: Record<HandMode, string> = {
  listen: 'L',
  practice: 'P',
  off: '×',
}
const LONG: Record<HandMode, string> = {
  listen: 'Listen',
  practice: 'Practice',
  off: 'Off',
}

export function HandModesCompact({
  handModes,
  onChange,
  waitForKeys,
  onWaitChange,
  waitingForNote,
}: HandModesCompactProps) {
  return (
    <div className="hand-compact">
      <CompactRow hand="right" mode={handModes.right} onChange={(m) => onChange({ ...handModes, right: m })} />
      <CompactRow hand="left" mode={handModes.left} onChange={(m) => onChange({ ...handModes, left: m })} />
      <label className="wait-toggle small">
        <input
          type="checkbox"
          checked={waitForKeys}
          onChange={(e) => onWaitChange(e.target.checked)}
        />
        Wait
        {waitingForNote && <span className="waiting-indicator">…</span>}
      </label>
    </div>
  )
}

function CompactRow({
  hand,
  mode,
  onChange,
}: {
  hand: Hand
  mode: HandMode
  onChange: (m: HandMode) => void
}) {
  return (
    <div className="hand-compact-row" title={hand === 'right' ? 'Right hand' : 'Left hand'}>
      <span className="hand-swatch" style={{ background: handColor(hand) }} />
      <div className="mode-toggle tiny">
        {MODES.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={`mode-btn${mode === m ? ' active' : ''}`}
            onClick={() => onChange(m)}
            title={LONG[m]}
          >
            {SHORT[m]}
          </button>
        ))}
      </div>
    </div>
  )
}
