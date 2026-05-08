import { useCallback, useEffect, useRef, useState } from 'react'
import { createMidiInput, isMidiSupported, type MidiDevice, type MidiInputManager } from '../midi/input'
import * as audio from '../audio/synth'

export interface MidiInputApi {
  supported: boolean
  devices: MidiDevice[]
  selectedId: string | null
  select: (id: string | null) => void
  liveNotes: ReadonlySet<number>
  liveNotesRef: React.MutableRefObject<Set<number>>
  error: string | null
}

export function useMidiInput(): MidiInputApi {
  const [supported] = useState(isMidiSupported())
  const [devices, setDevices] = useState<MidiDevice[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liveNotes, setLiveNotes] = useState<ReadonlySet<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<MidiInputManager | null>(null)
  const liveRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!supported) {
      setError('Web MIDI is not supported in this browser. Use Chrome, Edge, or Opera.')
      return
    }
    let cancelled = false
    let unsubDevices: (() => void) | null = null
    let unsubOn: (() => void) | null = null
    let unsubOff: (() => void) | null = null
    ;(async () => {
      try {
        const mgr = await createMidiInput()
        if (cancelled || !mgr) return
        managerRef.current = mgr
        const refresh = () => setDevices(mgr.listDevices())
        refresh()
        unsubDevices = mgr.onDevicesChanged(refresh)
        unsubOn = mgr.onNoteOn((midi, velocity) => {
          liveRef.current.add(midi)
          setLiveNotes(new Set(liveRef.current))
          // Play the note through the audio engine so the user hears their own playing
          audio.initAudio().then(() => audio.noteOn(midi, velocity))
        })
        unsubOff = mgr.onNoteOff((midi) => {
          liveRef.current.delete(midi)
          setLiveNotes(new Set(liveRef.current))
          audio.noteOff(midi)
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`MIDI access denied: ${msg}`)
      }
    })()
    return () => {
      cancelled = true
      unsubDevices?.()
      unsubOn?.()
      unsubOff?.()
      managerRef.current?.select(null)
    }
  }, [supported])

  const select = useCallback((id: string | null) => {
    managerRef.current?.select(id)
    setSelectedId(id)
    liveRef.current.clear()
    setLiveNotes(new Set())
  }, [])

  return { supported, devices, selectedId, select, liveNotes, liveNotesRef: liveRef, error }
}
