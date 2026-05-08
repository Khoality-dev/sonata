import { useEffect, useState } from 'react'
import {
  isAnyInstrumentLoading,
  isInstrumentLoaded,
  isInstrumentLoading,
  subscribeLoading,
  type InstrumentId,
} from '../audio/synth'

export function useAnyInstrumentLoading(): boolean {
  const [loading, setLoading] = useState(isAnyInstrumentLoading())
  useEffect(() => {
    return subscribeLoading(() => setLoading(isAnyInstrumentLoading()))
  }, [])
  return loading
}

export function useInstrumentStatus(id: InstrumentId): { loaded: boolean; loading: boolean } {
  const [, setTick] = useState(0)
  useEffect(() => {
    return subscribeLoading(() => setTick((t) => t + 1))
  }, [])
  return {
    loaded: isInstrumentLoaded(id),
    loading: isInstrumentLoading(id),
  }
}
