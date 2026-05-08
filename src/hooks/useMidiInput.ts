import { useCallback, useEffect, useRef, useState } from 'react'
import { createMidiInput, isMidiSupported, type MidiDevice, type MidiInputManager } from '../midi/input'
import * as audio from '../audio/synth'
import { DEFAULT_INSTRUMENT, type InstrumentId } from '../audio/synth'

export interface MidiInputOptions {
  liveInstrumentRef: React.MutableRefObject<InstrumentId>
  /**
   * Called when a live MIDI key is pressed; should return the trackIdx of the
   * upcoming song note that matches this key (within a small time window),
   * or null if none. Used to color the keyboard highlight per-track.
   */
  resolveLiveNoteTrackRef: React.MutableRefObject<(midi: number) => number | null>
}

export interface MidiInputApi {
  supported: boolean
  devices: MidiDevice[]
  selectedId: string | null
  select: (id: string | null) => void
  liveNotes: ReadonlySet<number>
  liveNotesRef: React.MutableRefObject<Set<number>>
  liveNoteTracks: ReadonlyMap<number, number>
  error: string | null
}

export function useMidiInput(opts: MidiInputOptions): MidiInputApi {
  const [supported] = useState(isMidiSupported())
  const [devices, setDevices] = useState<MidiDevice[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liveNotes, setLiveNotes] = useState<ReadonlySet<number>>(new Set())
  const [liveNoteTracks, setLiveNoteTracks] = useState<ReadonlyMap<number, number>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<MidiInputManager | null>(null)
  const liveRef = useRef<Set<number>>(new Set())
  const liveTracksRef = useRef<Map<number, number>>(new Map())
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
          const trackIdx = opts.resolveLiveNoteTrackRef.current(midi)
          if (trackIdx != null) {
            liveTracksRef.current.set(midi, trackIdx)
            setLiveNoteTracks(new Map(liveTracksRef.current))
          }
          const inst = opts.liveInstrumentRef.current ?? DEFAULT_INSTRUMENT
          heldInstrument.current.set(midi, inst)
          audio.initAudio().then(() => audio.noteOn(midi, velocity, inst))
        })
        unsubOff = mgr.onNoteOff((midi) => {
          liveRef.current.delete(midi)
          setLiveNotes(new Set(liveRef.current))
          if (liveTracksRef.current.delete(midi)) {
            setLiveNoteTracks(new Map(liveTracksRef.current))
          }
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
  }, [supported, opts.liveInstrumentRef, opts.resolveLiveNoteTrackRef])

  const select = useCallback((id: string | null) => {
    managerRef.current?.select(id)
    setSelectedId(id)
    liveRef.current.clear()
    heldInstrument.current.clear()
    liveTracksRef.current.clear()
    setLiveNotes(new Set())
    setLiveNoteTracks(new Map())
  }, [])

  return {
    supported,
    devices,
    selectedId,
    select,
    liveNotes,
    liveNotesRef: liveRef,
    liveNoteTracks,
    error,
  }
}
