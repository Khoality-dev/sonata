import type { AudioOutputDevice } from '../audio/synth'

interface AudioOutputSelectProps {
  supported: boolean
  devices: AudioOutputDevice[]
  selectedId: string
  onSelect: (deviceId: string) => void
  onRefresh: () => void
  compact?: boolean
}

export function AudioOutputSelect({
  supported,
  devices,
  selectedId,
  onSelect,
  onRefresh,
  compact,
}: AudioOutputSelectProps) {
  return (
    <label className={`mini-control${compact ? ' compact' : ''}`}>
      Audio output
      {!supported ? (
        <span className="muted">Not supported in this browser</span>
      ) : (
        <>
          <select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="default">System default</option>
            {devices
              .filter((d) => d.deviceId !== 'default' && d.deviceId !== '')
              .map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
          </select>
          <button className="bulk-btn" onClick={onRefresh} title="Re-enumerate devices">⟳</button>
        </>
      )}
    </label>
  )
}
