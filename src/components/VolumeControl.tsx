interface VolumeControlProps {
  value: number
  onChange: (n: number) => void
  compact?: boolean
}

export function VolumeControl({ value, onChange, compact }: VolumeControlProps) {
  return (
    <label className={`mini-control${compact ? ' compact' : ''}`}>
      Volume
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="numeric">{Math.round(value)}%</span>
    </label>
  )
}
