import { useEffect, useRef } from 'react'
import type { HandModes, Hand, LoopRegion, Song, TrackAssignments } from '../types'
import { handColor, isBlackKey, keyGeometry } from '../utils/notes'

interface FallingNotesProps {
  song: Song | null
  currentTimeRef: React.MutableRefObject<number>
  handModesRef: React.MutableRefObject<HandModes>
  trackAssignmentsRef: React.MutableRefObject<TrackAssignments>
  trackColorsRef: React.MutableRefObject<Record<number, string>>
  loopRef: React.MutableRefObject<LoopRegion>
  lookaheadSec: number
}

const NOTE_RADIUS = 6

export function FallingNotes({
  song,
  currentTimeRef,
  handModesRef,
  trackAssignmentsRef,
  trackColorsRef,
  loopRef,
  lookaheadSec,
}: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const songRef = useRef<Song | null>(song)

  useEffect(() => {
    songRef.current = song
  }, [song])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let dpr = window.devicePixelRatio || 1

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      const { width, height } = container.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Octave guides
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let m = 24; m <= 108; m += 12) {
        const g = keyGeometry(m)
        const x = g.x * W
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }

      const s = songRef.current
      if (!s) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(0, H - 2, W, 2)
        raf = requestAnimationFrame(draw)
        return
      }

      const t = currentTimeRef.current
      const pxPerSec = H / lookaheadSec
      const handModes = handModesRef.current
      const assignments = trackAssignmentsRef.current
      const trackColors = trackColorsRef.current
      const loop = loopRef.current
      const notes = s.notes

      // Loop region overlay (subtle band where loop is active)
      if (loop.enabled && loop.end > loop.start) {
        const yA = H - (loop.start - t) * pxPerSec
        const yB = H - (loop.end - t) * pxPerSec
        const top = Math.min(yA, yB)
        const bot = Math.max(yA, yB)
        if (bot > 0 && top < H) {
          ctx.fillStyle = 'rgba(124, 92, 255, 0.07)'
          ctx.fillRect(0, Math.max(0, top), W, Math.min(H, bot) - Math.max(0, top))
          ctx.strokeStyle = 'rgba(124, 92, 255, 0.45)'
          ctx.setLineDash([4, 4])
          ctx.lineWidth = 1
          if (yA >= 0 && yA <= H) {
            ctx.beginPath()
            ctx.moveTo(0, yA)
            ctx.lineTo(W, yA)
            ctx.stroke()
          }
          if (yB >= 0 && yB <= H) {
            ctx.beginPath()
            ctx.moveTo(0, yB)
            ctx.lineTo(W, yB)
            ctx.stroke()
          }
          ctx.setLineDash([])
        }
      }

      for (let i = 0; i < notes.length; i++) {
        const n = notes[i]
        const noteEnd = n.time + n.duration
        if (noteEnd < t) continue
        if (n.time > t + lookaheadSec) break

        const assignment = assignments[n.track] ?? 'off'
        if (assignment === 'off') continue
        const hand: Hand = assignment
        const mode = handModes[hand]
        if (mode === 'off') continue

        const g = keyGeometry(n.midi)
        const x = g.x * W
        const w = g.width * W
        const yBottom = H - (n.time - t) * pxPerSec
        const yTop = yBottom - n.duration * pxPerSec
        const height = Math.max(2, yBottom - yTop)
        const isPractice = mode === 'practice'

        const color = trackColors[n.track] ?? handColor(hand)
        const isBlack = isBlackKey(n.midi)

        if (isPractice) {
          ctx.fillStyle = color
          ctx.globalAlpha = isBlack ? 0.18 : 0.22
          roundRect(ctx, x + 1, yTop, Math.max(1, w - 2), height, NOTE_RADIUS)
          ctx.fill()

          ctx.strokeStyle = color
          ctx.globalAlpha = 0.95
          ctx.lineWidth = 2
          roundRect(ctx, x + 1.5, yTop + 0.5, Math.max(0.5, w - 3), Math.max(1, height - 1), NOTE_RADIUS)
          ctx.stroke()
        } else {
          ctx.fillStyle = color
          ctx.globalAlpha = isBlack ? 0.85 : 1
          roundRect(ctx, x + 1, yTop, Math.max(1, w - 2), height, NOTE_RADIUS)
          ctx.fill()

          ctx.globalAlpha = 0.5
          ctx.fillStyle = '#ffffff'
          roundRect(ctx, x + 2, yTop + 1, Math.max(1, w - 4), Math.min(3, height - 1), NOTE_RADIUS / 2)
          ctx.fill()
        }

        ctx.globalAlpha = 1
      }

      // Strike line
      const grad = ctx.createLinearGradient(0, H - 6, 0, H)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(1, 'rgba(255,255,255,0.18)')
      ctx.fillStyle = grad
      ctx.fillRect(0, H - 6, W, 6)

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [currentTimeRef, handModesRef, trackAssignmentsRef, trackColorsRef, loopRef, lookaheadSec])

  return (
    <div className="falling-notes" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
