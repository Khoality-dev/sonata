interface SpeedControlProps {
  rate: number
  onChange: (r: number) => void
  compact?: boolean
}

export function SpeedControl({ rate, onChange, compact }: SpeedControlProps) {
  return (
    <label className={`mini-control${compact ? ' compact' : ''}`}>
      Speed
      <input
        type="range"
        min={0.25}
        max={2}
        step={0.05}
        value={rate}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="numeric">{rate.toFixed(2)}x</span>
    </label>
  )
}
