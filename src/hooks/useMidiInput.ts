import { useCallback, useEffect, useRef, useState } from 'react'
import { createMidiInput, isMidiSupported, type MidiDevice, type MidiInputManager } from '../midi/input'
import * as audio from '../audio/synth'
import { DEFAULT_INSTRUMENT, type InstrumentId } from '../audio/synth'

export interface MidiInputOptions {
  liveInstrumentRef: React.MutableRefObject<InstrumentId>
}

export interface MidiInputApi {
  supported: boolean
  devices: MidiDevice[]
  selectedId: string | null
  select: (id: string | null) => void
  liveNotes: ReadonlySet<number>
  liveNotesRef: React.MutableRefObject<Set<number>>
  error: string | null
}

export function useMidiInput(opts: MidiInputOptions): MidiInputApi {
  const [supported] = useState(isMidiSupported())
  const [devices, setDevices] = useState<MidiDevice[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liveNotes, setLiveNotes] = useState<ReadonlySet<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<MidiInputManager | null>(null)
  const liveRef = useRef<Set<number>>(new Set())
  // Track the instrument used at noteOn so noteOff stops the same player even
  // if the user changed liveInstrument while holding the key.
  const heldInstrument = useRef<Map<number, InstrumentId>>(new Map())

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
          const inst = opts.liveInstrumentRef.current ?? DEFAULT_INSTRUMENT
          heldInstrument.current.set(midi, inst)
          audio.initAudio().then(() => audio.noteOn(midi, velocity, inst))
        })
        unsubOff = mgr.onNoteOff((midi) => {
          liveRef.current.delete(midi)
          setLiveNotes(new Set(liveRef.current))
          const inst = heldInstrument.current.get(midi) ?? opts.liveInstrumentRef.current ?? DEFAULT_INSTRUMENT
          heldInstrument.current.delete(midi)
          audio.noteOff(midi, inst)
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
  }, [supported, opts.liveInstrumentRef])

  const select = useCallback((id: string | null) => {
    managerRef.current?.select(id)
    setSelectedId(id)
    liveRef.current.clear()
    heldInstrument.current.clear()
    setLiveNotes(new Set())
  }, [])

  return { supported, devices, selectedId, select, liveNotes, liveNotesRef: liveRef, error }
}
