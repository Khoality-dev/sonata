export interface MidiDevice {
  id: string
  name: string
  manufacturer: string
}

export type NoteOnHandler = (midi: number, velocity: number) => void
export type NoteOffHandler = (midi: number) => void

export interface MidiInputManager {
  listDevices(): MidiDevice[]
  select(id: string | null): void
  selectedId(): string | null
  onDevicesChanged(cb: () => void): () => void
  onNoteOn(cb: NoteOnHandler): () => void
  onNoteOff(cb: NoteOffHandler): () => void
}

export function isMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

export async function createMidiInput(): Promise<MidiInputManager | null> {
  if (!isMidiSupported()) return null
  const access = await navigator.requestMIDIAccess()

  let selected: MIDIInput | null = null
  const noteOnSubs = new Set<NoteOnHandler>()
  const noteOffSubs = new Set<NoteOffHandler>()
  const deviceSubs = new Set<() => void>()

  function handleMessage(e: MIDIMessageEvent) {
    if (!e.data || e.data.length < 3) return
    const status = e.data[0]
    const note = e.data[1]
    const velocity = e.data[2]
    const command = status & 0xf0
    if (command === 0x90 && velocity > 0) {
      noteOnSubs.forEach((cb) => cb(note, velocity / 127))
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      noteOffSubs.forEach((cb) => cb(note))
    }
  }

  access.onstatechange = () => {
    deviceSubs.forEach((cb) => cb())
  }

  return {
    listDevices() {
      const devices: MidiDevice[] = []
      access.inputs.forEach((input) => {
        devices.push({
          id: input.id,
          name: input.name ?? 'Unknown device',
          manufacturer: input.manufacturer ?? '',
        })
      })
      return devices
    },
    selectedId() {
      return selected?.id ?? null
    },
    select(id) {
      if (selected) selected.onmidimessage = null
      selected = null
      if (id) {
        const input = access.inputs.get(id)
        if (input) {
          input.onmidimessage = handleMessage
          selected = input
        }
      }
    },
    onDevicesChanged(cb) {
      deviceSubs.add(cb)
      return () => deviceSubs.delete(cb)
    },
    onNoteOn(cb) {
      noteOnSubs.add(cb)
      return () => noteOnSubs.delete(cb)
    },
    onNoteOff(cb) {
      noteOffSubs.add(cb)
      return () => noteOffSubs.delete(cb)
    },
  }
}
