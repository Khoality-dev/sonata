export const MIN_MIDI = 21  // A0
export const MAX_MIDI = 108 // C8
export const TOTAL_KEYS = MAX_MIDI - MIN_MIDI + 1 // 88

const PITCH_CLASS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false]
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function isBlackKey(midi: number): boolean {
  return PITCH_CLASS_BLACK[midi % 12]
}

export function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  return `${PITCH_NAMES[midi % 12]}${octave}`
}

export function whiteKeyIndex(midi: number): number {
  let count = 0
  for (let m = MIN_MIDI; m < midi; m++) {
    if (!isBlackKey(m)) count++
  }
  return count
}

export const TOTAL_WHITE_KEYS = (() => {
  let count = 0
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
    if (!isBlackKey(m)) count++
  }
  return count
})()

export interface KeyGeom {
  x: number      // fraction [0..1] of keyboard width
  width: number  // fraction [0..1] of keyboard width
  black: boolean
}

export function keyGeometry(midi: number, totalWhiteKeys = TOTAL_WHITE_KEYS): KeyGeom {
  const whiteWidth = 1 / totalWhiteKeys
  if (!isBlackKey(midi)) {
    return { x: whiteKeyIndex(midi) * whiteWidth, width: whiteWidth, black: false }
  }
  const blackWidth = whiteWidth * 0.62
  const boundaryX = whiteKeyIndex(midi) * whiteWidth
  return { x: boundaryX - blackWidth / 2, width: blackWidth, black: true }
}

export function allKeys(): number[] {
  const keys: number[] = []
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) keys.push(m)
  return keys
}

export const HAND_COLORS = {
  right: '#4ec9ff',
  left: '#ff8c42',
} as const

export function handColor(hand: 'left' | 'right'): string {
  return HAND_COLORS[hand]
}

const RIGHT_PALETTE = ['#4ec9ff', '#7c5cff', '#66d9ef', '#5d8cff', '#a8e0ff', '#3a92cc']
const LEFT_PALETTE = ['#ff8c42', '#ffb070', '#ff6b3d', '#e6a04a', '#ffce8e', '#cc6f33']

export function defaultTrackColor(hand: 'left' | 'right', indexInHand: number): string {
  const palette = hand === 'right' ? RIGHT_PALETTE : LEFT_PALETTE
  return palette[indexInHand % palette.length]
}
