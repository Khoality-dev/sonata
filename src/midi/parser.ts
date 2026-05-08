import { Midi } from '@tonejs/midi'
import type { Hand, Note, Song, TrackInfo } from '../types'
import { DEFAULT_INSTRUMENT, instrumentFromMidiName, type InstrumentId } from '../audio/synth'

const LEFT_HINTS = ['left', 'lh', 'bass', 'l.h', 'l h', 'piano l']
const RIGHT_HINTS = ['right', 'rh', 'treble', 'melody', 'r.h', 'r h', 'piano r']

function nameHand(name: string | undefined): Hand | null {
  if (!name) return null
  const n = name.toLowerCase()
  if (LEFT_HINTS.some((h) => n.includes(h))) return 'left'
  if (RIGHT_HINTS.some((h) => n.includes(h))) return 'right'
  return null
}

function avgPitch(notes: { midi: number }[]): number {
  if (!notes.length) return 0
  let s = 0
  for (const n of notes) s += n.midi
  return s / notes.length
}

const SPLIT_PITCH = 60 // Middle C

function defaultHandFor(
  trackIndex: number,
  trackName: string | undefined,
  pitchAvg: number,
  twoTrackHigher: number | null,
): Hand {
  const named = nameHand(trackName)
  if (named) return named
  // Two-non-empty-track special case: higher avg pitch is right hand
  if (twoTrackHigher !== null) {
    return trackIndex === twoTrackHigher ? 'right' : 'left'
  }
  return pitchAvg >= SPLIT_PITCH ? 'right' : 'left'
}

export async function parseMidiFile(file: File): Promise<Song> {
  const buffer = await file.arrayBuffer()
  const midi = new Midi(buffer)

  const nonEmptyIndexes = midi.tracks
    .map((t, i) => ({ i, count: t.notes.length }))
    .filter((x) => x.count > 0)
    .map((x) => x.i)

  let twoTrackHigher: number | null = null
  if (nonEmptyIndexes.length === 2) {
    const a = nonEmptyIndexes[0]
    const b = nonEmptyIndexes[1]
    const avgA = avgPitch(midi.tracks[a].notes)
    const avgB = avgPitch(midi.tracks[b].notes)
    twoTrackHigher = avgA >= avgB ? a : b
  }

  const tracks: TrackInfo[] = midi.tracks.map((t, i) => {
    const pitchAvg = avgPitch(t.notes)
    const instrumentName = t.instrument?.name ?? ''
    const mapped: InstrumentId = instrumentFromMidiName(instrumentName) ?? DEFAULT_INSTRUMENT
    return {
      index: i,
      name: t.name || `Track ${i + 1}`,
      instrument: instrumentName,
      channel: t.channel ?? 0,
      noteCount: t.notes.length,
      avgPitch: pitchAvg,
      defaultAssignment: defaultHandFor(i, t.name, pitchAvg, twoTrackHigher),
      defaultInstrument: mapped,
    }
  })

  const notes: Note[] = []
  midi.tracks.forEach((track, trackIndex) => {
    track.notes.forEach((n) => {
      notes.push({
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
        track: trackIndex,
      })
    })
  })
  notes.sort((a, b) => a.time - b.time)

  return {
    name: file.name.replace(/\.midi?$/i, ''),
    notes,
    duration: midi.duration,
    tempo: midi.header.tempos[0]?.bpm ?? 120,
    tracks,
  }
}
