'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
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
  setTool: (tool: 'brush' | 'eraser') => void
  clear: () => void
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  function Canvas({ isDrawer, onDraw, roomId, playerId }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawingRef = useRef(false)
    const contextRef = useRef<CanvasRenderingContext2D | null>(null)
    const currentColorRef = useRef('#000000')
    const currentSizeRef = useRef(5)
    const currentToolRef = useRef<'brush' | 'eraser'>('brush')
    const pointsRef = useRef<{ x: number; y: number }[]>([])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = 1280
      canvas.height = 720

      const context = canvas.getContext('2d')
      if (!context) return

      context.lineCap = 'round'
      context.lineJoin = 'round'
      contextRef.current = context
    }, [])

    // Draw a complete stroke on the canvas (used for remote strokes)
    const drawStrokeOnCanvas = (stroke: DrawStroke) => {
      const ctx = contextRef.current
      const canvas = canvasRef.current
      if (!ctx || !canvas || stroke.points.length < 2) return

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
    }

    const clearCanvas = () => {
      if (!contextRef.current || !canvasRef.current) return
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      drawStroke: drawStrokeOnCanvas,
      setColor: (color: string) => { currentColorRef.current = color },
      setSize: (size: number) => { currentSizeRef.current = size },
      setTool: (tool: 'brush' | 'eraser') => { currentToolRef.current = tool },
      clear: clearCanvas,
    }))

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

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawer || !contextRef.current) return

      const { x, y } = getScaledCoords(e)
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

    return (
      <div className="flex flex-col gap-4">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onMouseLeave={stopDrawing}
          className={`border-4 border-purple-500 rounded bg-white w-full ${
            isDrawer ? 'cursor-crosshair' : 'pointer-events-none opacity-70'
          }`}
          style={{ aspectRatio: '16 / 9' }}
        />
        {isDrawer && (
          <button
            onClick={clearCanvas}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
          >
            Clear Canvas
          </button>
        )}
      </div>
    )
  }
)
