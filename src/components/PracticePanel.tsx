import type { Hand, HandMode, HandModes } from '../types'
import { handColor } from '../utils/notes'

interface PracticePanelProps {
  handModes: HandModes
  onChange: (next: HandModes) => void
  waitForKeys: boolean
  onWaitChange: (next: boolean) => void
  waitingForNote: boolean
}

const MODES: HandMode[] = ['listen', 'practice', 'off']
const MODE_LABELS: Record<HandMode, string> = {
  listen: 'Listen',
  practice: 'Practice',
  off: 'Off',
}

export function PracticePanel({
  handModes,
  onChange,
  waitForKeys,
  onWaitChange,
  waitingForNote,
}: PracticePanelProps) {
  const setHand = (hand: Hand, mode: HandMode) => {
    onChange({ ...handModes, [hand]: mode })
  }

  return (
    <div className="practice-panel">
      <HandRow hand="right" mode={handModes.right} onChange={(m) => setHand('right', m)} />
      <HandRow hand="left" mode={handModes.left} onChange={(m) => setHand('left', m)} />
      <label className="wait-toggle">
        <input
          type="checkbox"
          checked={waitForKeys}
          onChange={(e) => onWaitChange(e.target.checked)}
        />
        Wait for correct note
        {waitingForNote && <span className="waiting-indicator">waiting…</span>}
      </label>
    </div>
  )
}

function HandRow({
  hand,
  mode,
  onChange,
}: {
  hand: Hand
  mode: HandMode
  onChange: (m: HandMode) => void
}) {
  const label = hand === 'right' ? 'Right hand' : 'Left hand'
  return (
    <div className="hand-row">
      <span className="hand-label">
        <span className="hand-swatch" style={{ background: handColor(hand) }} />
        {label}
      </span>
      <div className="mode-toggle" role="radiogroup" aria-label={`${label} mode`}>
        {MODES.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={`mode-btn${mode === m ? ' active' : ''}`}
            onClick={() => onChange(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  )
}
