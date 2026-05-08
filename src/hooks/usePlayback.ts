import { useCallback, useEffect, useRef, useState } from 'react'
import type { Hand, HandModes, LoopRegion, Song, TrackAssignments } from '../types'
import * as audio from '../audio/synth'

export interface PlaybackOptions {
  handModesRef: React.MutableRefObject<HandModes>
  waitForKeysRef: React.MutableRefObject<boolean>
  liveNotesRef: React.MutableRefObject<Set<number>>
  trackAssignmentsRef: React.MutableRefObject<TrackAssignments>
  loopRef: React.MutableRefObject<LoopRegion>
}

export interface PlaybackApi {
  isPlaying: boolean
  currentTime: number
  duration: number
  rate: number
  activeNotes: ReadonlySet<number>
  waitingForNote: boolean
  currentTimeRef: React.MutableRefObject<number>
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  seek: (t: number) => void
  setRate: (r: number) => void
}

export function usePlayback(song: Song | null, opts: PlaybackOptions): PlaybackApi {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [activeNotes, setActiveNotes] = useState<ReadonlySet<number>>(new Set())
  const [rate, setRateState] = useState(1)
  const [waitingForNote, setWaitingForNote] = useState(false)

  const currentTimeRef = useRef(0)
  const rateRef = useRef(1)
  const songRef = useRef<Song | null>(null)
  const isPlayingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastFrameMs = useRef(0)
  const nextNoteIdx = useRef(0)
  const pendingOffs = useRef<{ midi: number; offTime: number }[]>([])
  const activeRef = useRef<Set<number>>(new Set())
  const uiSyncCounter = useRef(0)
  const waitingRef = useRef(false)

  const stopAllAudio = useCallback(() => {
    audio.allOff()
    pendingOffs.current = []
    activeRef.current.clear()
    setActiveNotes(new Set())
  }, [])

  const resetSchedule = useCallback((t: number) => {
    const s = songRef.current
    if (!s) {
      nextNoteIdx.current = 0
      return
    }
    let i = 0
    while (i < s.notes.length && s.notes[i].time < t) i++
    nextNoteIdx.current = i
  }, [])

  const tick = useCallback(
    (nowMs: number) => {
      const s = songRef.current
      if (!isPlayingRef.current) return
      const dt = (nowMs - lastFrameMs.current) / 1000
      lastFrameMs.current = nowMs

      if (!s) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const handModes = opts.handModesRef.current
      const waitForKeys = opts.waitForKeysRef.current
      const liveNotes = opts.liveNotesRef.current
      const assignments = opts.trackAssignmentsRef.current
      const loop = opts.loopRef.current

      let t = currentTimeRef.current + dt * rateRef.current

      // Loop wrap-around
      if (loop.enabled && loop.end > loop.start && t >= loop.end) {
        // Release any sustaining notes before jumping back
        audio.allOff()
        pendingOffs.current = []
        activeRef.current.clear()
        setActiveNotes(new Set())
        t = loop.start
        currentTimeRef.current = t
        let i = 0
        while (i < s.notes.length && s.notes[i].time < t) i++
        nextNoteIdx.current = i
      }

      let activeChanged = false
      let waitingThisFrame = false

      while (nextNoteIdx.current < s.notes.length) {
        const n = s.notes[nextNoteIdx.current]
        if (n.time > t) break

        const assignment = assignments[n.track] ?? 'off'
        if (assignment === 'off') {
          nextNoteIdx.current++
          continue
        }
        const hand: Hand = assignment
        const mode = handModes[hand]
        if (mode === 'off') {
          nextNoteIdx.current++
          continue
        }

        if (mode === 'practice') {
          if (waitForKeys && !liveNotes.has(n.midi)) {
            t = n.time
            waitingThisFrame = true
            break
          }
          nextNoteIdx.current++
          continue
        }

        // mode === 'listen'
        audio.noteOn(n.midi, n.velocity)
        pendingOffs.current.push({ midi: n.midi, offTime: n.time + n.duration })
        activeRef.current.add(n.midi)
        nextNoteIdx.current++
        activeChanged = true
      }

      currentTimeRef.current = t

      if (pendingOffs.current.length) {
        const remaining: { midi: number; offTime: number }[] = []
        for (const off of pendingOffs.current) {
          if (off.offTime <= t) {
            audio.noteOff(off.midi)
            activeRef.current.delete(off.midi)
            activeChanged = true
          } else {
            remaining.push(off)
          }
        }
        pendingOffs.current = remaining
      }

      if (activeChanged) setActiveNotes(new Set(activeRef.current))

      if (waitingThisFrame !== waitingRef.current) {
        waitingRef.current = waitingThisFrame
        setWaitingForNote(waitingThisFrame)
      }

      uiSyncCounter.current++
      if (uiSyncCounter.current >= 6) {
        uiSyncCounter.current = 0
        setCurrentTime(t)
      }

      const reachedEnd = t >= s.duration && !waitingThisFrame
      if (reachedEnd) {
        if (loop.enabled && loop.end > loop.start) {
          // Wrap to loop start
          audio.allOff()
          pendingOffs.current = []
          activeRef.current.clear()
          setActiveNotes(new Set())
          currentTimeRef.current = loop.start
          let i = 0
          while (i < s.notes.length && s.notes[i].time < loop.start) i++
          nextNoteIdx.current = i
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        isPlayingRef.current = false
        setIsPlaying(false)
        audio.allOff()
        activeRef.current.clear()
        pendingOffs.current = []
        setActiveNotes(new Set())
        setCurrentTime(s.duration)
        if (waitingRef.current) {
          waitingRef.current = false
          setWaitingForNote(false)
        }
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    },
    [opts.handModesRef, opts.waitForKeysRef, opts.liveNotesRef, opts.trackAssignmentsRef, opts.loopRef],
  )

  const play = useCallback(async () => {
    if (!songRef.current) return
    await audio.initAudio()
    if (isPlayingRef.current) return
    isPlayingRef.current = true
    setIsPlaying(true)
    lastFrameMs.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const pause = useCallback(() => {
    isPlayingRef.current = false
    setIsPlaying(false)
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    stopAllAudio()
    if (waitingRef.current) {
      waitingRef.current = false
      setWaitingForNote(false)
    }
  }, [stopAllAudio])

  const stop = useCallback(() => {
    pause()
    currentTimeRef.current = 0
    setCurrentTime(0)
    resetSchedule(0)
  }, [pause, resetSchedule])

  const seek = useCallback(
    (t: number) => {
      const dur = songRef.current?.duration ?? 0
      const clamped = Math.max(0, Math.min(t, dur))
      stopAllAudio()
      currentTimeRef.current = clamped
      setCurrentTime(clamped)
      resetSchedule(clamped)
      if (waitingRef.current) {
        waitingRef.current = false
        setWaitingForNote(false)
      }
    },
    [stopAllAudio, resetSchedule],
  )

  const setRate = useCallback((r: number) => {
    rateRef.current = r
    setRateState(r)
  }, [])

  useEffect(() => {
    songRef.current = song
    isPlayingRef.current = false
    setIsPlaying(false)
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    audio.allOff()
    pendingOffs.current = []
    activeRef.current.clear()
    setActiveNotes(new Set())
    currentTimeRef.current = 0
    setCurrentTime(0)
    nextNoteIdx.current = 0
    if (waitingRef.current) {
      waitingRef.current = false
      setWaitingForNote(false)
    }
  }, [song])

  useEffect(() => {
    return () => {
      isPlayingRef.current = false
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      audio.allOff()
    }
  }, [])

  return {
    isPlaying,
    currentTime,
    duration: song?.duration ?? 0,
    rate,
    activeNotes,
    waitingForNote,
    currentTimeRef,
    play,
    pause,
    stop,
    seek,
    setRate,
  }
}
