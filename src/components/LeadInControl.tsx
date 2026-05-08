interface LeadInControlProps {
  value: number
  onChange: (n: number) => void
  compact?: boolean
}

export function LeadInControl({ value, onChange, compact }: LeadInControlProps) {
  return (
    <label className={`mini-control${compact ? ' compact' : ''}`}>
      Lead-in
      <input
        type="range"
        min={0}
        max={8}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="numeric">{value.toFixed(1)}s</span>
    </label>
  )
}
