export type Hand = 'left' | 'right'
export type HandMode = 'listen' | 'practice' | 'off'
export type TrackAssignment = 'left' | 'right' | 'off'

export interface Note {
  midi: number
  time: number
  duration: number
  velocity: number
  track: number
}

export interface TrackInfo {
  index: number
  name: string
  instrument: string
  channel: number
  noteCount: number
  avgPitch: number
  defaultAssignment: Hand
}

export interface Song {
  name: string
  notes: Note[]
  duration: number
  tempo: number
  tracks: TrackInfo[]
}

export interface HandModes {
  left: HandMode
  right: HandMode
}

export type TrackAssignments = Record<number, TrackAssignment>

export interface LoopRegion {
  enabled: boolean
  start: number
  end: number
}
