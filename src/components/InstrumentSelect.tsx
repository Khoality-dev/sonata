import { useMemo } from 'react'
import { INSTRUMENTS, type InstrumentId } from '../audio/synth'

interface InstrumentSelectProps {
  value: InstrumentId
  loading: boolean
  onChange: (id: InstrumentId) => void
  compact?: boolean
  label?: string
}

export function InstrumentSelect({ value, loading, onChange, compact, label = 'Sound' }: InstrumentSelectProps) {
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof INSTRUMENTS>()
    for (const i of INSTRUMENTS) {
      const list = groups.get(i.group) ?? []
      list.push(i)
      groups.set(i.group, list)
    }
    return [...groups.entries()]
  }, [])

  return (
    <label className={`mini-control${compact ? ' compact' : ''}`}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as InstrumentId)}
        disabled={loading}
        title={loading ? 'Loading instrument…' : 'Select sound'}
      >
        {grouped.map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {loading && <span className="muted">…</span>}
    </label>
  )
}
