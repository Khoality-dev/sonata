import { useCallback, useEffect, useState } from 'react'
import {
  isOutputSelectionSupported,
  listAudioOutputs,
  onDeviceChange,
  requestAudioPermission,
  setAudioOutput,
  type AudioOutputDevice,
} from '../audio/synth'

export interface AudioOutputApi {
  supported: boolean
  devices: AudioOutputDevice[]
  selectedId: string
  select: (deviceId: string) => void
  refresh: () => Promise<void>
  error: string | null
}

export function useAudioOutput(): AudioOutputApi {
  const [supported] = useState(isOutputSelectionSupported())
  const [devices, setDevices] = useState<AudioOutputDevice[]>([])
  const [selectedId, setSelectedId] = useState('default')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await listAudioOutputs()
      // If labels are empty, request permission then re-enumerate to populate them
      const allEmpty = list.length > 0 && list.every((d) => !d.label || /^Output \d+$/.test(d.label))
      if (allEmpty) {
        await requestAudioPermission()
        const refreshed = await listAudioOutputs()
        setDevices(refreshed)
      } else {
        setDevices(list)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    refresh()
    const off = onDeviceChange(() => {
      refresh()
    })
    return () => off()
  }, [refresh])

  const select = useCallback((deviceId: string) => {
    setSelectedId(deviceId)
    setAudioOutput(deviceId).catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [])

  return { supported, devices, selectedId, select, refresh, error }
}
