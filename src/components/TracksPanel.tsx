import { useMemo, useState } from 'react'
import type { Song, TrackAssignment, TrackAssignments, TrackInstruments } from '../types'
import { handColor } from '../utils/notes'
import { INSTRUMENTS, type InstrumentId } from '../audio/synth'

interface TracksPanelProps {
  song: Song | null
  assignments: TrackAssignments
  onChange: (next: TrackAssignments) => void
  colors: Record<number, string>
  onColorChange: (trackIdx: number, color: string) => void
  instruments: TrackInstruments
  onInstrumentChange: (trackIdx: number, id: InstrumentId) => void
  onResetDefaults: () => void
}

const ASSIGN_OPTIONS: TrackAssignment[] = ['left', 'right', 'off']
const ASSIGN_LABELS: Record<TrackAssignment, string> = {
  left: 'Left',
  right: 'Right',
  off: 'Hide',
}

export function TracksPanel({
  song,
  assignments,
  onChange,
  colors,
  onColorChange,
  instruments,
  onInstrumentChange,
  onResetDefaults,
}: TracksPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const groupedInstruments = useMemo(() => {
    const groups = new Map<string, typeof INSTRUMENTS>()
    for (const i of INSTRUMENTS) {
      const list = groups.get(i.group) ?? []
      list.push(i)
      groups.set(i.group, list)
    }
    return [...groups.entries()]
  }, [])

  if (!song) return null
  const visible = song.tracks.filter((t) => t.noteCount > 0)
  if (visible.length === 0) return null

  const setAll = (assignment: TrackAssignment) => {
    const next: TrackAssignments = { ...assignments }
    for (const t of visible) next[t.index] = assignment
    onChange(next)
  }

  return (
    <div className={`tracks-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="tracks-header">
        <button className="tracks-toggle" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '▸' : '▾'} Tracks ({visible.length})
        </button>
        {!collapsed && (
          <div className="tracks-bulk">
            <button className="bulk-btn" onClick={() => setAll('right')}>All right</button>
            <button className="bulk-btn" onClick={() => setAll('left')}>All left</button>
            <button className="bulk-btn" onClick={() => setAll('off')}>Hide all</button>
            <button className="bulk-btn" onClick={onResetDefaults}>Reset defaults</button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="tracks-list">
          {visible.map((t) => {
            const current = assignments[t.index] ?? 'off'
            const trackColor = colors[t.index] ?? handColor(t.defaultAssignment)
            const isOff = current === 'off'
            const inst = instruments[t.index] ?? t.defaultInstrument
            return (
              <div key={t.index} className="track-row">
                <input
                  type="color"
                  className="track-color-picker"
                  value={trackColor}
                  onChange={(e) => onColorChange(t.index, e.target.value)}
                  disabled={isOff}
                  title={isOff ? 'Hidden — assign to a hand to enable color' : 'Track color'}
                  aria-label="Track color"
                />
                <span
                  className="track-swatch"
                  style={{
                    background: isOff ? 'transparent' : trackColor,
                    borderColor: isOff ? 'var(--border)' : trackColor,
                  }}
                />
                <span className="track-meta">
                  <span className="track-name">{t.name}</span>
                  <span className="track-detail">
                    {t.instrument || `ch ${t.channel + 1}`} · {t.noteCount} notes · avg{' '}
                    {Math.round(t.avgPitch)}
                  </span>
                </span>
                <select
                  className="track-instrument-select"
                  value={inst}
                  onChange={(e) => onInstrumentChange(t.index, e.target.value as InstrumentId)}
                  disabled={isOff}
                  title="Instrument for this track"
                >
                  {groupedInstruments.map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>{i.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="mode-toggle">
                  {ASSIGN_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      role="radio"
                      aria-checked={current === opt}
                      className={`mode-btn${current === opt ? ' active' : ''}`}
                      onClick={() => onChange({ ...assignments, [t.index]: opt })}
                    >
                      {ASSIGN_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
