'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { DrawStroke } from '@/lib/types'

type ToolType = 'brush' | 'eraser' | 'fill'

interface CanvasProps {
  isDrawer: boolean
  onDraw: (stroke: DrawStroke) => void
  roomId: string
  playerId: string
}

export interface CanvasHandle {
  drawStroke: (stroke: DrawStroke) => void
  setColor: (color: string) => void
  setSize: (size: number) => void
  setTool: (tool: ToolType) => void
  clear: () => void
  undo: () => void
}

const MAX_HISTORY = 30
const STREAM_THROTTLE_MS = 30

function fillPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  start: { x: number; y: number },
  fillRgb: { r: number; g: number; b: number },
  matchStart: (idx: number) => boolean,
) {
  const stack: [number, number][] = [[start.x, start.y]]
  const visited = new Uint8Array(width * height)

  while (stack.length > 0) {
    const point = stack.pop()
    if (!point) break
    const [x, y] = point
    const pixelIdx = y * width + x
    if (visited[pixelIdx]) continue
    visited[pixelIdx] = 1

    const idx = pixelIdx * 4
    if (!matchStart(idx)) continue

    data[idx] = fillRgb.r
    data[idx + 1] = fillRgb.g
    data[idx + 2] = fillRgb.b
    data[idx + 3] = 255

    if (x > 0) stack.push([x - 1, y])
    if (x < width - 1) stack.push([x + 1, y])
    if (y > 0) stack.push([x, y - 1])
    if (y < height - 1) stack.push([x, y + 1])
  }
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  function Canvas({ isDrawer, onDraw, roomId, playerId }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawingRef = useRef(false)
    const contextRef = useRef<CanvasRenderingContext2D | null>(null)
    const currentColorRef = useRef('#000000')
    const currentSizeRef = useRef(5)
    const currentToolRef = useRef<ToolType>('brush')
    const pointsRef = useRef<{ x: number; y: number }[]>([])
    const historyRef = useRef<ImageData[]>([])

    // Streaming refs
    const lastEmitIndexRef = useRef(0)
    const lastEmitTimeRef = useRef(0)
    const windowHandlersRef = useRef<{
      move: ((e: MouseEvent) => void) | null
      up: ((e: MouseEvent) => void) | null
    }>({ move: null, up: null })

    // Remote stream tracking
    const remoteStreamActiveRef = useRef(false)

    // Stable callback refs (avoid stale closures in window event handlers)
    const onDrawRef = useRef(onDraw)
    onDrawRef.current = onDraw
    const roomIdRef = useRef(roomId)
    roomIdRef.current = roomId
    const playerIdRef = useRef(playerId)
    playerIdRef.current = playerId

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = 1280
      canvas.height = 720

      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.lineCap = 'round'
      context.lineJoin = 'round'
      contextRef.current = context
    }, [])

    // Clean up window listeners on unmount
    useEffect(() => {
      return () => {
        const { move, up } = windowHandlersRef.current
        if (move) globalThis.removeEventListener('mousemove', move)
        if (up) globalThis.removeEventListener('mouseup', up)
      }
    }, [])

    // Clean up drawing state if drawer changes (e.g. new round)
    useEffect(() => {
      if (!isDrawer) {
        isDrawingRef.current = false
        const { move, up } = windowHandlersRef.current
        if (move) globalThis.removeEventListener('mousemove', move)
        if (up) globalThis.removeEventListener('mouseup', up)
        windowHandlersRef.current = { move: null, up: null }
      }
    }, [isDrawer])

    const saveSnapshot = useCallback(() => {
      const ctx = contextRef.current
      const canvas = canvasRef.current
      if (!ctx || !canvas) return
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
      historyRef.current.push(snapshot)
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift()
      }
    }, [])

    const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
      const ctx = contextRef.current
      const canvas = canvasRef.current
      if (!ctx || !canvas) return

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const width = canvas.width
      const height = canvas.height

      const hex = fillColor.replace('#', '')
      const fr = Number.parseInt(hex.substring(0, 2), 16)
      const fg = Number.parseInt(hex.substring(2, 4), 16)
      const fb = Number.parseInt(hex.substring(4, 6), 16)

      const sx = Math.round(startX)
      const sy = Math.round(startY)
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) return

      const startIdx = (sy * width + sx) * 4
      const sr = data[startIdx]
      const sg = data[startIdx + 1]
      const sb = data[startIdx + 2]
      const sa = data[startIdx + 3]

      if (sr === fr && sg === fg && sb === fb && sa === 255) return

      const tolerance = 32
      const matchStart = (idx: number) =>
        Math.abs(data[idx] - sr) <= tolerance &&
        Math.abs(data[idx + 1] - sg) <= tolerance &&
        Math.abs(data[idx + 2] - sb) <= tolerance &&
        Math.abs(data[idx + 3] - sa) <= tolerance

      fillPixels(data, width, height, { x: sx, y: sy }, { r: fr, g: fg, b: fb }, matchStart)
      ctx.putImageData(imageData, 0, 0)
    }, [])

    // Render a stroke segment (shared by mouse and touch paths)
    const renderSegment = useCallback((ctx: CanvasRenderingContext2D, stroke: DrawStroke) => {
      if (stroke.points.length < 2) return
      ctx.save()
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
      ctx.restore()
    }, [])

    // Render a single dot (for single-click drawing)
    const renderDot = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, tool: string) => {
      ctx.save()
      ctx.fillStyle = tool === 'eraser' ? '#FFFFFF' : color
      ctx.beginPath()
      ctx.arc(x, y, size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }, [])

    // Draw a stroke on the canvas (used for remote strokes and replay)
    const drawStrokeOnCanvas = useCallback((stroke: DrawStroke) => {
      const ctx = contextRef.current
      if (!ctx) return

      // Partial (streaming) stroke from remote drawer
      if (stroke.partial) {
        if (!remoteStreamActiveRef.current) {
          saveSnapshot()
          remoteStreamActiveRef.current = true
        }
        renderSegment(ctx, stroke)
        return
      }

      // Complete stroke received
      if (remoteStreamActiveRef.current) {
        // Already rendered via partials, just mark stream as done
        remoteStreamActiveRef.current = false
        return
      }

      // Full stroke (replay for mid-game joiners, single-click dot, fill)
      saveSnapshot()

      if (stroke.tool === 'fill' && stroke.points.length >= 1) {
        floodFill(stroke.points[0].x, stroke.points[0].y, stroke.color)
        return
      }

      if (stroke.points.length === 1) {
        renderDot(ctx, stroke.points[0].x, stroke.points[0].y, stroke.size, stroke.color, stroke.tool)
        return
      }

      renderSegment(ctx, stroke)
    }, [saveSnapshot, floodFill, renderSegment, renderDot])

    const clearCanvas = useCallback(() => {
      if (!contextRef.current || !canvasRef.current) return
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      historyRef.current = []
    }, [])

    const undoCanvas = useCallback(() => {
      const ctx = contextRef.current
      const canvas = canvasRef.current
      if (!ctx || !canvas || historyRef.current.length === 0) return
      const prev = historyRef.current.pop()
      if (prev) ctx.putImageData(prev, 0, 0)
    }, [])

    // Dynamic cursor based on tool, color, and size
    const updateCursor = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!isDrawer) {
        canvas.style.cursor = 'default'
        return
      }

      const tool = currentToolRef.current
      if (tool === 'fill') {
        canvas.style.cursor = 'crosshair'
        return
      }

      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) return
      const scale = rect.width / canvas.width
      const displaySize = Math.max(Math.round(currentSizeRef.current * scale), 4)
      const svgSize = displaySize + 2
      const center = Math.round(svgSize / 2)
      const radius = Math.round(displaySize / 2)

      let svg: string
      if (tool === 'eraser') {
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'><circle cx='${center}' cy='${center}' r='${radius}' fill='white' stroke='%23888' stroke-width='1.5'/></svg>`
      } else {
        const encoded = currentColorRef.current.replace('#', '%23')
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'><circle cx='${center}' cy='${center}' r='${radius}' fill='${encoded}' opacity='0.7' stroke='%23fff' stroke-width='0.5'/></svg>`
      }

      canvas.style.cursor = `url("data:image/svg+xml,${svg}") ${center} ${center}, crosshair`
    }, [isDrawer])

    // Update cursor when isDrawer changes
    useEffect(() => {
      updateCursor()
    }, [updateCursor])

    // Update cursor on canvas resize
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const observer = new ResizeObserver(() => updateCursor())
      observer.observe(canvas)
      return () => observer.disconnect()
    }, [updateCursor])

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      drawStroke: drawStrokeOnCanvas,
      setColor: (color: string) => { currentColorRef.current = color; updateCursor() },
      setSize: (size: number) => { currentSizeRef.current = size; updateCursor() },
      setTool: (tool: ToolType) => { currentToolRef.current = tool; updateCursor() },
      clear: clearCanvas,
      undo: undoCanvas,
    }), [drawStrokeOnCanvas, clearCanvas, undoCanvas, updateCursor])

    // Get scaled coords from a native MouseEvent (for window-level handlers)
    const getScaledCoordsFromNative = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY)),
      }
    }

    const getScaledCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: e.nativeEvent.offsetX * scaleX,
        y: e.nativeEvent.offsetY * scaleY,
      }
    }

    const getTouchCoords = (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches[0] || e.changedTouches[0]
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }

    // Emit a partial stroke (streaming) with throttling
    const emitPartial = () => {
      const start = Math.max(0, lastEmitIndexRef.current - 1) // overlap one point for seamless connection
      const newPoints = pointsRef.current.slice(start)
      if (newPoints.length >= 2) {
        onDrawRef.current({
          roomId: roomIdRef.current,
          userId: playerIdRef.current,
          color: currentColorRef.current,
          size: currentSizeRef.current,
          tool: currentToolRef.current,
          points: newPoints,
          partial: true,
        })
        lastEmitIndexRef.current = pointsRef.current.length
        lastEmitTimeRef.current = performance.now()
      }
    }

    // Emit the complete stroke for server storage and replay
    const emitComplete = () => {
      if (pointsRef.current.length === 0) return
      onDrawRef.current({
        roomId: roomIdRef.current,
        userId: playerIdRef.current,
        color: currentColorRef.current,
        size: currentSizeRef.current,
        tool: currentToolRef.current,
        points: pointsRef.current,
      })
    }

    // --- Mouse handlers ---
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawer || !contextRef.current) return
      const { x, y } = getScaledCoords(e)

      if (currentToolRef.current === 'fill') {
        saveSnapshot()
        floodFill(x, y, currentColorRef.current)
        onDrawRef.current({
          roomId: roomIdRef.current,
          userId: playerIdRef.current,
          color: currentColorRef.current,
          size: currentSizeRef.current,
          tool: 'fill',
          points: [{ x, y }],
        })
        return
      }

      saveSnapshot()
      isDrawingRef.current = true
      pointsRef.current = [{ x, y }]
      lastEmitIndexRef.current = 0
      lastEmitTimeRef.current = 0

      contextRef.current.strokeStyle =
        currentToolRef.current === 'eraser' ? '#FFFFFF' : currentColorRef.current
      contextRef.current.lineWidth = currentSizeRef.current
      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)

      // Attach window-level listeners so drawing continues outside canvas
      const handleMove = (ev: MouseEvent) => {
        if (!isDrawingRef.current || !contextRef.current) return
        const coords = getScaledCoordsFromNative(ev)

        contextRef.current.lineTo(coords.x, coords.y)
        contextRef.current.stroke()
        // Optimization: restart sub-path to avoid O(n²) re-stroking
        contextRef.current.beginPath()
        contextRef.current.moveTo(coords.x, coords.y)
        pointsRef.current.push(coords)

        // Throttled partial emission for real-time sync
        const now = performance.now()
        if (now - lastEmitTimeRef.current >= STREAM_THROTTLE_MS) {
          emitPartial()
        }
      }

      const handleUp = () => {
        if (!isDrawingRef.current) return
        isDrawingRef.current = false

        // Draw dot for single click (no movement)
        if (pointsRef.current.length === 1) {
          const pt = pointsRef.current[0]
          renderDot(contextRef.current!, pt.x, pt.y, currentSizeRef.current, currentColorRef.current, currentToolRef.current)
        }

        // Emit any remaining un-sent points as a final partial
        if (pointsRef.current.length > 1 && lastEmitIndexRef.current < pointsRef.current.length) {
          emitPartial()
        }

        // Emit complete stroke for server storage
        emitComplete()

        pointsRef.current = []
        lastEmitIndexRef.current = 0

        // Remove window listeners
        globalThis.removeEventListener('mousemove', handleMove)
        globalThis.removeEventListener('mouseup', handleUp)
        windowHandlersRef.current = { move: null, up: null }
      }

      windowHandlersRef.current = { move: handleMove, up: handleUp }
      globalThis.addEventListener('mousemove', handleMove)
      globalThis.addEventListener('mouseup', handleUp)
    }

    // --- Touch handlers ---
    const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawer || !contextRef.current) return
      e.preventDefault()

      const { x, y } = getTouchCoords(e)

      if (currentToolRef.current === 'fill') {
        saveSnapshot()
        floodFill(x, y, currentColorRef.current)
        onDrawRef.current({
          roomId: roomIdRef.current,
          userId: playerIdRef.current,
          color: currentColorRef.current,
          size: currentSizeRef.current,
          tool: 'fill',
          points: [{ x, y }],
        })
        return
      }

      saveSnapshot()
      isDrawingRef.current = true
      pointsRef.current = [{ x, y }]
      lastEmitIndexRef.current = 0
      lastEmitTimeRef.current = 0

      contextRef.current.strokeStyle =
        currentToolRef.current === 'eraser' ? '#FFFFFF' : currentColorRef.current
      contextRef.current.lineWidth = currentSizeRef.current
      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)
    }

    const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !contextRef.current) return
      e.preventDefault()

      const { x, y } = getTouchCoords(e)

      contextRef.current.lineTo(x, y)
      contextRef.current.stroke()
      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)
      pointsRef.current.push({ x, y })

      // Throttled partial emission
      const now = performance.now()
      if (now - lastEmitTimeRef.current >= STREAM_THROTTLE_MS) {
        emitPartial()
      }
    }

    const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (!isDrawingRef.current) return
      isDrawingRef.current = false

      if (pointsRef.current.length === 1) {
        const pt = pointsRef.current[0]
        if (contextRef.current) {
          renderDot(contextRef.current, pt.x, pt.y, currentSizeRef.current, currentColorRef.current, currentToolRef.current)
        }
      }

      if (pointsRef.current.length > 1 && lastEmitIndexRef.current < pointsRef.current.length) {
        emitPartial()
      }

      emitComplete()
      pointsRef.current = []
      lastEmitIndexRef.current = 0
    }

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onTouchStart={startDrawingTouch}
        onTouchMove={drawTouch}
        onTouchEnd={stopDrawingTouch}
        className={`border-2 border-indigo-500/50 rounded-lg bg-white w-full touch-none ${
          isDrawer ? '' : 'pointer-events-none'
        }`}
        style={{ aspectRatio: '16 / 9' }}
      />
    )
  }
)
