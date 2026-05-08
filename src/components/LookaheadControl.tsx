interface LookaheadControlProps {
  value: number
  onChange: (n: number) => void
  compact?: boolean
}

export function LookaheadControl({ value, onChange, compact }: LookaheadControlProps) {
  return (
    <label className={`mini-control${compact ? ' compact' : ''}`}>
      Lookahead
      <input
        type="range"
        min={1.5}
        max={8}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="numeric">{value.toFixed(1)}s</span>
    </label>
  )
}
