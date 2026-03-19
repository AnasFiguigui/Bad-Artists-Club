'use client'

import { useState, useRef } from 'react'

type ToolType = 'brush' | 'eraser' | 'fill' | 'line' | 'oval' | 'rect' | 'roundedRect' | 'triangle' | 'callout'

const SHAPE_TOOLS: { tool: ToolType; label: string; icon: React.ReactNode }[] = [
  {
    tool: 'line', label: 'Line',
    icon: <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="4" y1="20" x2="20" y2="4" strokeLinecap="round" /></svg>,
  },
  {
    tool: 'oval', label: 'Oval',
    icon: <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><ellipse cx="12" cy="12" rx="9" ry="7" /></svg>,
  },
  {
    tool: 'rect', label: 'Rectangle',
    icon: <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" /></svg>,
  },
  {
    tool: 'roundedRect', label: 'Rounded Rectangle',
    icon: <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="4" /></svg>,
  },
  {
    tool: 'triangle', label: 'Triangle',
    icon: <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4L3 20h18L12 4z" strokeLinejoin="round" /></svg>,
  },
  {
    tool: 'callout', label: 'Callout',
    icon: <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 5h18v11H14l-4 4v-4H3V5z" strokeLinejoin="round" /></svg>,
  },
]

interface BrushControlsProps {
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
  onToolChange: (tool: ToolType) => void
  onClear: () => void
  onUndo: () => void
  isDrawer: boolean
  themeColor?: string
}

const COLORS = [
  // row 1 (dark)
  '#000000', '#7f1d1d', '#9a3412', '#a16207', '#166534', '#0f766e', '#0e7490', '#1e3a8a', '#581c87', '#9d174d', '#5c4033',

  // row 2 (base)
  '#808080', '#dc2626', '#ea580c', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#2563eb', '#7c3aed', '#ec4899', '#8b5a2b',

  // row 3 (light)
  '#ffffff', '#fca5a5', '#fdba74', '#fde68a', '#86efac', '#99f6e4', '#67e8f9', '#93c5fd', '#c4b5fd', '#f9a8d4', '#d2b48c'
]

export function BrushControls({
  onColorChange,
  onSizeChange,
  onToolChange,
  onClear,
  onUndo,
  isDrawer,
  themeColor,
}: Readonly<BrushControlsProps>) {
  const [activeTool, setActiveTool] = useState<ToolType>('brush')
  const [activeColor, setActiveColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  const colorPickerRef = useRef<HTMLInputElement>(null)

  if (!isDrawer) return null

  const handleToolChange = (tool: ToolType) => {
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
              ? 'text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
          style={activeTool === 'brush' ? { backgroundColor: themeColor || '#4f46e5' } : undefined}
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

      {/* Selected color indicator — clickable to open color picker */}
      <div className="relative shrink-0">
        <button
          type="button"
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-gray-500 shadow-inner cursor-pointer hover:scale-110 transition-transform"
          style={{ backgroundColor: activeColor }}
          title="Pick custom color"
          onClick={() => colorPickerRef.current?.click()}
        />
        <input
          ref={colorPickerRef}
          type="color"
          value={activeColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
          tabIndex={-1}
        />
      </div>

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
                ? 'ring-2'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            style={brushSize === size ? { backgroundColor: `${themeColor || '#6366f1'}e6`, boxShadow: `0 0 0 2px ${themeColor || '#818cf8'}cc` } : undefined}
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

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700 hidden sm:block" />

      {/* Shape tools */}
      <div className="flex items-center gap-1">
        {SHAPE_TOOLS.map(({ tool, label, icon }) => (
          <button
            key={tool}
            onClick={() => handleToolChange(tool)}
            title={label}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              activeTool === tool
                ? 'text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            style={activeTool === tool ? { backgroundColor: themeColor || '#4f46e5' } : undefined}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
