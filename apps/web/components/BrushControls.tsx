'use client'

import { useState } from 'react'

interface BrushControlsProps {
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
  onToolChange: (tool: 'brush' | 'eraser' | 'fill') => void
  onClear: () => void
  onUndo: () => void
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
  onUndo,
  isDrawer,
}: BrushControlsProps) {
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'fill'>('brush')
  const [activeColor, setActiveColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)

  if (!isDrawer) return null

  const handleToolChange = (tool: 'brush' | 'eraser' | 'fill') => {
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
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-gray-900/80 border border-gray-700/50 rounded-lg px-2 sm:px-3 py-2">
      {/* Tools: Brush + Eraser + Fill */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleToolChange('brush')}
          title="Brush"
          className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
            activeTool === 'brush'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => handleToolChange('eraser')}
          title="Eraser"
          className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
            activeTool === 'eraser'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z" />
          </svg>
        </button>
        <button
          onClick={() => handleToolChange('fill')}
          title="Fill (bucket)"
          className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
            activeTool === 'fill'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 000 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700 hidden sm:block" />

      {/* Selected color indicator */}
      <div
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-gray-500 shadow-inner shrink-0"
        style={{ backgroundColor: activeColor }}
      />

      {/* Color palette */}
      <div className="grid grid-cols-11 gap-0.5">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => handleColorChange(color)}
            className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm transition-transform hover:scale-125 ${
              activeColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : 'border border-gray-600/50'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700 hidden sm:block" />

      {/* Size buttons */}
      <div className="flex items-center gap-1">
        {([
          { size: 2, radius: 2 },
          { size: 5, radius: 3.5 },
          { size: 10, radius: 5.5 },
          { size: 18, radius: 8 },
          { size: 30, radius: 11 },
        ] as const).map(({ size, radius }) => (
          <button
            key={size}
            onClick={() => handleSizeChange(size)}
            title={`Size ${size}`}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors ${
              brushSize === size
                ? 'bg-purple-600 ring-2 ring-purple-400'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r={radius} fill={brushSize === size ? 'white' : '#9ca3af'} />
            </svg>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700 hidden sm:block" />

      {/* Actions: Undo, Clear */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          title="Undo"
          className="p-1.5 sm:p-2 rounded-lg bg-gray-800 text-orange-400 hover:bg-orange-900/50 hover:text-orange-300 transition-colors"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5" />
          </svg>
        </button>
        <button
          onClick={onClear}
          title="Clear canvas"
          className="p-1.5 sm:p-2 rounded-lg bg-gray-800 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-colors"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
