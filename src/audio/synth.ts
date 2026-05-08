import * as Tone from 'tone'
import { instrument as loadSoundfontInstrument, type Player as SoundfontPlayer } from 'soundfont-player'

export type InstrumentId =
  | 'acoustic_grand_piano'
  | 'bright_acoustic_piano'
  | 'electric_grand_piano'
  | 'honkytonk_piano'
  | 'electric_piano_1'
  | 'electric_piano_2'
  | 'harpsichord'
  | 'clavinet'
  | 'celesta'
  | 'music_box'
  | 'vibraphone'
  | 'marimba'
  | 'glockenspiel'
  | 'tubular_bells'
  | 'orchestral_harp'
  | 'pizzicato_strings'
  | 'string_ensemble_1'
  | 'tremolo_strings'
  | 'church_organ'
  | 'rock_organ'
  | 'reed_organ'
  | 'accordion'
  | 'acoustic_guitar_nylon'
  | 'acoustic_guitar_steel'
  | 'choir_aahs'
  | 'voice_oohs'
  | 'pad_2_warm'
  | 'pad_4_choir'

interface InstrumentOption {
  id: InstrumentId
  label: string
  group: string
}

export const INSTRUMENTS: InstrumentOption[] = [
  { id: 'acoustic_grand_piano', label: 'Acoustic Grand', group: 'Piano' },
  { id: 'bright_acoustic_piano', label: 'Bright Piano', group: 'Piano' },
  { id: 'electric_grand_piano', label: 'Electric Grand', group: 'Piano' },
  { id: 'honkytonk_piano', label: 'Honky-tonk', group: 'Piano' },
  { id: 'electric_piano_1', label: 'Rhodes', group: 'Piano' },
  { id: 'electric_piano_2', label: 'EP Chorus', group: 'Piano' },
  { id: 'harpsichord', label: 'Harpsichord', group: 'Keys' },
  { id: 'clavinet', label: 'Clavinet', group: 'Keys' },
  { id: 'celesta', label: 'Celesta', group: 'Keys' },
  { id: 'music_box', label: 'Music Box', group: 'Keys' },
  { id: 'vibraphone', label: 'Vibraphone', group: 'Mallet' },
  { id: 'marimba', label: 'Marimba', group: 'Mallet' },
  { id: 'glockenspiel', label: 'Glockenspiel', group: 'Mallet' },
  { id: 'tubular_bells', label: 'Tubular Bells', group: 'Mallet' },
  { id: 'orchestral_harp', label: 'Harp', group: 'Strings' },
  { id: 'pizzicato_strings', label: 'Pizzicato', group: 'Strings' },
  { id: 'string_ensemble_1', label: 'Strings', group: 'Strings' },
  { id: 'tremolo_strings', label: 'Tremolo Strings', group: 'Strings' },
  { id: 'church_organ', label: 'Church Organ', group: 'Organ' },
  { id: 'rock_organ', label: 'Rock Organ', group: 'Organ' },
  { id: 'reed_organ', label: 'Reed Organ', group: 'Organ' },
  { id: 'accordion', label: 'Accordion', group: 'Reed' },
  { id: 'acoustic_guitar_nylon', label: 'Nylon Guitar', group: 'Guitar' },
  { id: 'acoustic_guitar_steel', label: 'Steel Guitar', group: 'Guitar' },
  { id: 'choir_aahs', label: 'Choir Aahs', group: 'Vocal' },
  { id: 'voice_oohs', label: 'Voice Oohs', group: 'Vocal' },
  { id: 'pad_2_warm', label: 'Warm Pad', group: 'Pad' },
  { id: 'pad_4_choir', label: 'Choir Pad', group: 'Pad' },
]

export const DEFAULT_INSTRUMENT: InstrumentId = 'acoustic_grand_piano'

const VALID_IDS = new Set<string>(INSTRUMENTS.map((i) => i.id))

/**
 * Map a @tonejs/midi instrument name (e.g. "acoustic grand piano",
 * "acoustic guitar (nylon)") to one of our curated InstrumentIds. Returns
 * null if no curated mapping exists; caller should fall back.
 */
export function instrumentFromMidiName(midiName: string | undefined): InstrumentId | null {
  if (!midiName) return null
  const normalized = midiName
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '_')
    .trim()
  if (VALID_IDS.has(normalized)) return normalized as InstrumentId
  // Best-effort family fallbacks
  if (normalized.includes('piano')) return 'acoustic_grand_piano'
  if (normalized.includes('organ')) return 'church_organ'
  if (normalized.includes('guitar')) return 'acoustic_guitar_nylon'
  if (normalized.includes('strings')) return 'string_ensemble_1'
  if (normalized.includes('choir') || normalized.includes('voice')) return 'choir_aahs'
  return null
}

interface NoteHandle {
  stop: (when?: number) => void
}

let inputGain: Tone.Gain | null = null
let reverb: Tone.Reverb | null = null
let eq: Tone.EQ3 | null = null
let limiter: Tone.Limiter | null = null
let initPromise: Promise<void> | null = null
let ready = false

const players = new Map<InstrumentId, SoundfontPlayer>()
const loadingPromises = new Map<InstrumentId, Promise<SoundfontPlayer>>()

// Active notes keyed by `${midi}|${instrument}` so multiple instruments can
// hold the same MIDI number simultaneously (e.g. piano right + strings left).
const activeNotes = new Map<string, NoteHandle[]>()

const loadingSubscribers = new Set<() => void>()
function notifyLoading() {
  loadingSubscribers.forEach((cb) => cb())
}

export function subscribeLoading(cb: () => void): () => void {
  loadingSubscribers.add(cb)
  return () => loadingSubscribers.delete(cb)
}

export function isAudioReady(): boolean {
  return ready
}

export function isInstrumentLoaded(id: InstrumentId): boolean {
  return players.has(id)
}

export function isInstrumentLoading(id: InstrumentId): boolean {
  return loadingPromises.has(id)
}

export function isAnyInstrumentLoading(): boolean {
  return loadingPromises.size > 0
}

async function fetchPlayer(id: InstrumentId): Promise<SoundfontPlayer> {
  if (!inputGain) throw new Error('Audio not initialized')
  const ctx = Tone.getContext().rawContext as unknown as AudioContext
  return loadSoundfontInstrument(ctx, id as never, {
    soundfont: 'MusyngKite',
    destination: (inputGain as unknown as { input: AudioNode }).input,
  })
}

export async function initAudio(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    await Tone.start()
    limiter = new Tone.Limiter(-1).toDestination()
    reverb = new Tone.Reverb({ decay: 2.6, wet: 0.22, preDelay: 0.02 }).connect(limiter)
    eq = new Tone.EQ3({ low: 1, mid: 0, high: -1 }).connect(reverb)
    inputGain = new Tone.Gain(0.9).connect(eq)
    await reverb.ready
    ready = true
  })()
  return initPromise
}

export async function ensureInstrument(id: InstrumentId): Promise<void> {
  await initAudio()
  if (players.has(id)) return
  const existing = loadingPromises.get(id)
  if (existing) {
    await existing
    return
  }
  const promise = fetchPlayer(id)
    .then((p) => {
      players.set(id, p)
      return p
    })
    .finally(() => {
      loadingPromises.delete(id)
      notifyLoading()
    })
  loadingPromises.set(id, promise)
  notifyLoading()
  await promise
}

export function preloadInstruments(ids: Iterable<InstrumentId>): void {
  for (const id of ids) {
    ensureInstrument(id).catch(() => {
      /* ignore — note will silently no-op until loaded */
    })
  }
}

function midiToNoteName(midi: number): string {
  return Tone.Frequency(midi, 'midi').toNote()
}

function activeKey(midi: number, instrument: InstrumentId): string {
  return `${midi}|${instrument}`
}

export function noteOn(midi: number, velocity: number, instrument: InstrumentId): void {
  const player = players.get(instrument)
  if (!player) {
    // Trigger lazy load; this note will be silent.
    ensureInstrument(instrument).catch(() => {})
    return
  }
  const ctx = Tone.getContext().rawContext as unknown as AudioContext
  const handle = player.play(midiToNoteName(midi), ctx.currentTime, {
    gain: Math.min(2, velocity * 1.6),
  }) as unknown as NoteHandle
  const key = activeKey(midi, instrument)
  let list = activeNotes.get(key)
  if (!list) {
    list = []
    activeNotes.set(key, list)
  }
  list.push(handle)
}

export function noteOff(midi: number, instrument: InstrumentId): void {
  const key = activeKey(midi, instrument)
  const list = activeNotes.get(key)
  if (!list?.length) return
  for (const h of list) {
    try {
      h.stop()
    } catch {
      // ignore
    }
  }
  activeNotes.delete(key)
}

export function allOff(): void {
  for (const list of activeNotes.values()) {
    for (const h of list) {
      try {
        h.stop()
      } catch {
        // ignore
      }
    }
  }
  activeNotes.clear()
}

export interface AudioOutputDevice {
  deviceId: string
  label: string
}

export async function listAudioOutputs(): Promise<AudioOutputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return all
      .filter((d) => d.kind === 'audiooutput')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || (d.deviceId === 'default' ? 'System default' : `Output ${i + 1}`),
      }))
  } catch {
    return []
  }
}

export async function requestAudioPermission(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

export function isOutputSelectionSupported(): boolean {
  if (typeof AudioContext === 'undefined') return false
  return typeof (AudioContext.prototype as { setSinkId?: unknown }).setSinkId === 'function'
}

export async function setAudioOutput(deviceId: string): Promise<boolean> {
  await initAudio()
  const ctx = Tone.getContext().rawContext as unknown as {
    setSinkId?: (id: string) => Promise<void>
  }
  if (typeof ctx.setSinkId !== 'function') return false
  try {
    await ctx.setSinkId(deviceId)
    return true
  } catch (err) {
    console.warn('setSinkId failed', err)
    return false
  }
}

export function onDeviceChange(cb: () => void): () => void {
  if (!navigator.mediaDevices?.addEventListener) return () => {}
  navigator.mediaDevices.addEventListener('devicechange', cb)
  return () => navigator.mediaDevices.removeEventListener('devicechange', cb)
}
