import type { MidiDevice } from '../midi/input'

interface MidiDeviceSelectProps {
  supported: boolean
  devices: MidiDevice[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  compact?: boolean
}

export function MidiDeviceSelect({
  supported,
  devices,
  selectedId,
  onSelect,
  compact,
}: MidiDeviceSelectProps) {
  return (
    <label className={`mini-control${compact ? ' compact' : ''}`}>
      MIDI input
      {!supported ? (
        <span className="muted">Not supported</span>
      ) : (
        <select
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value="">— None —</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.manufacturer ? ` (${d.manufacturer})` : ''}
            </option>
          ))}
        </select>
      )}
    </label>
  )
}
