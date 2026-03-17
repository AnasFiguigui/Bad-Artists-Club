'use client'

import { useState } from 'react'

interface BrushControlsProps {
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
  onToolChange: (tool: 'brush' | 'eraser') => void
  onClear: () => void
  onReroll?: () => void
  onSkip?: () => void
  isDrawer: boolean
}

const COLORS = [
  '#000000', '#404040', '#808080', '#c0c0c0', '#ffffff',
  '#8b0000', '#ef4444', '#f97316', '#fbbf24', '#eab308',
  '#166534', '#22c55e', '#34d399', '#06b6d4', '#0ea5e9',
  '#1e40af', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899',
  '#92400e', '#f5f5dc',
]

export function BrushControls({
  onColorChange,
  onSizeChange,
  onToolChange,
  onClear,
  onReroll,
  onSkip,
  isDrawer,
}: BrushControlsProps) {
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser'>('brush')
  const [activeColor, setActiveColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)

  if (!isDrawer) return null

  const handleToolChange = (tool: 'brush' | 'eraser') => {
    setActiveTool(tool)
    onToolChange(tool)
  }

  const handleColorChange = (color: string) => {
    setActiveColor(color)
    onColorChange(color)
    if (activeTool === 'eraser') {
      setActiveTool('brush')
      onToolChange('brush')
    }
  }

  const handleSizeChange = (size: number) => {
    setBrushSize(size)
    onSizeChange(size)
  }

  return (
    <div className="flex items-center gap-3 bg-gray-900/80 border border-gray-700/50 rounded-lg px-3 py-2">
      {/* Tools: Brush + Eraser */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleToolChange('brush')}
          title="Brush"
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'brush'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => handleToolChange('eraser')}
          title="Eraser"
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'eraser'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700" />

      {/* Selected color indicator */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="w-7 h-7 rounded-full border-2 border-gray-500 shadow-inner"
          style={{ backgroundColor: activeColor }}
        />
      </div>

      {/* Color palette */}
      <div className="grid grid-cols-11 gap-0.5">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => handleColorChange(color)}
            className={`w-5 h-5 rounded-sm transition-transform hover:scale-125 ${
              activeColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : 'border border-gray-600/50'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700" />

      {/* Size slider */}
      <div className="flex items-center gap-2">
        <div
          className="rounded-full bg-white shrink-0"
          style={{ width: Math.max(brushSize, 4), height: Math.max(brushSize, 4), maxWidth: 24, maxHeight: 24 }}
        />
        <input
          type="range"
          min={1}
          max={30}
          value={brushSize}
          onChange={(e) => handleSizeChange(Number(e.target.value))}
          className="w-20 accent-purple-500"
        />
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700" />

      {/* Actions: Clear, Reroll, Skip */}
      <div className="flex items-center gap-1">
        <button
          onClick={onClear}
          title="Clear canvas"
          className="p-2 rounded-lg bg-gray-800 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        {onReroll && (
          <button
            onClick={onReroll}
            title="Reroll word"
            className="p-2 rounded-lg bg-gray-800 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            title="Skip turn"
            className="p-2 rounded-lg bg-gray-800 text-yellow-400 hover:bg-yellow-900/50 hover:text-yellow-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
