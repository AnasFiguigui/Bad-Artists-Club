'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { DrawStroke } from '@/lib/types'

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
  setTool: (tool: 'brush' | 'eraser' | 'fill') => void
  clear: () => void
  undo: () => void
}

const MAX_HISTORY = 30

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  function Canvas({ isDrawer, onDraw, roomId, playerId }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawingRef = useRef(false)
    const contextRef = useRef<CanvasRenderingContext2D | null>(null)
    const currentColorRef = useRef('#000000')
    const currentSizeRef = useRef(5)
    const currentToolRef = useRef<'brush' | 'eraser' | 'fill'>('brush')
    const pointsRef = useRef<{ x: number; y: number }[]>([])
    const historyRef = useRef<ImageData[]>([])

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

      // Parse fill color
      const hex = fillColor.replace('#', '')
      const fr = parseInt(hex.substring(0, 2), 16)
      const fg = parseInt(hex.substring(2, 4), 16)
      const fb = parseInt(hex.substring(4, 6), 16)

      const sx = Math.round(startX)
      const sy = Math.round(startY)
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) return

      const startIdx = (sy * width + sx) * 4
      const sr = data[startIdx]
      const sg = data[startIdx + 1]
      const sb = data[startIdx + 2]
      const sa = data[startIdx + 3]

      // Don't fill if same color
      if (sr === fr && sg === fg && sb === fb && sa === 255) return

      const tolerance = 32
      const matchStart = (idx: number) => {
        return (
          Math.abs(data[idx] - sr) <= tolerance &&
          Math.abs(data[idx + 1] - sg) <= tolerance &&
          Math.abs(data[idx + 2] - sb) <= tolerance &&
          Math.abs(data[idx + 3] - sa) <= tolerance
        )
      }

      const stack: [number, number][] = [[sx, sy]]
      const visited = new Uint8Array(width * height)

      while (stack.length > 0) {
        const [x, y] = stack.pop()!
        const pixelIdx = y * width + x
        if (visited[pixelIdx]) continue
        visited[pixelIdx] = 1

        const idx = pixelIdx * 4
        if (!matchStart(idx)) continue

        data[idx] = fr
        data[idx + 1] = fg
        data[idx + 2] = fb
        data[idx + 3] = 255

        if (x > 0) stack.push([x - 1, y])
        if (x < width - 1) stack.push([x + 1, y])
        if (y > 0) stack.push([x, y - 1])
        if (y < height - 1) stack.push([x, y + 1])
      }

      ctx.putImageData(imageData, 0, 0)
    }, [])

    // Draw a complete stroke on the canvas (used for remote strokes)
    const drawStrokeOnCanvas = useCallback((stroke: DrawStroke) => {
      const ctx = contextRef.current
      const canvas = canvasRef.current
      if (!ctx || !canvas) return

      saveSnapshot()

      if (stroke.tool === 'fill' && stroke.points.length >= 1) {
        floodFill(stroke.points[0].x, stroke.points[0].y, stroke.color)
        return
      }

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
      ctx.closePath()
      ctx.restore()
    }, [saveSnapshot, floodFill])

    const clearCanvas = useCallback(() => {
      if (!contextRef.current || !canvasRef.current) return
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      historyRef.current = []
    }, [])

    const undoCanvas = useCallback(() => {
      const ctx = contextRef.current
      const canvas = canvasRef.current
      if (!ctx || !canvas || historyRef.current.length === 0) return
      const prev = historyRef.current.pop()!
      ctx.putImageData(prev, 0, 0)
    }, [])

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      drawStroke: drawStrokeOnCanvas,
      setColor: (color: string) => { currentColorRef.current = color },
      setSize: (size: number) => { currentSizeRef.current = size },
      setTool: (tool: 'brush' | 'eraser' | 'fill') => { currentToolRef.current = tool },
      clear: clearCanvas,
      undo: undoCanvas,
    }), [drawStrokeOnCanvas, clearCanvas, undoCanvas])

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

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawer || !contextRef.current) return

      const { x, y } = getScaledCoords(e)

      if (currentToolRef.current === 'fill') {
        saveSnapshot()
        floodFill(x, y, currentColorRef.current)
        onDraw({
          roomId,
          userId: playerId,
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

      contextRef.current.strokeStyle =
        currentToolRef.current === 'eraser' ? '#FFFFFF' : currentColorRef.current
      contextRef.current.lineWidth = currentSizeRef.current
      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !contextRef.current) return

      const { x, y } = getScaledCoords(e)

      contextRef.current.lineTo(x, y)
      contextRef.current.stroke()
      pointsRef.current.push({ x, y })
    }

    const stopDrawing = () => {
      if (!isDrawingRef.current) return

      isDrawingRef.current = false
      contextRef.current?.closePath()

      if (pointsRef.current.length > 1) {
        onDraw({
          roomId,
          userId: playerId,
          color: currentColorRef.current,
          size: currentSizeRef.current,
          tool: currentToolRef.current,
          points: pointsRef.current,
        })
      }

      pointsRef.current = []
    }

    // Touch handlers for mobile
    const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawer || !contextRef.current) return
      e.preventDefault()

      const { x, y } = getTouchCoords(e)

      if (currentToolRef.current === 'fill') {
        saveSnapshot()
        floodFill(x, y, currentColorRef.current)
        onDraw({
          roomId,
          userId: playerId,
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
      pointsRef.current.push({ x, y })
    }

    const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      stopDrawing()
    }

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={draw}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawingTouch}
        onTouchMove={drawTouch}
        onTouchEnd={stopDrawingTouch}
        className={`border-2 border-purple-500/50 rounded-lg bg-white w-full touch-none ${
          isDrawer ? 'cursor-crosshair' : 'pointer-events-none'
        }`}
        style={{ aspectRatio: '16 / 9' }}
      />
    )
  }
)
