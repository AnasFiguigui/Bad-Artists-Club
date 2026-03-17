'use client'

interface BrushControlsProps {
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
  onToolChange: (tool: 'brush' | 'eraser') => void
  isDrawer: boolean
}

const COLORS = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
  '#92400e',
]

const BRUSH_SIZES = [2, 5, 8, 12, 18, 24]
const ERASER_SIZES = [10, 20, 30]

export function BrushControls({
  onColorChange,
  onSizeChange,
  onToolChange,
  isDrawer,
}: BrushControlsProps) {
  if (!isDrawer) return null

  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700 space-y-4">
      <div>
        <h4 className="text-white font-semibold mb-2">Tools</h4>
        <div className="flex gap-2">
          <button
            onClick={() => onToolChange('brush')}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold"
          >
            ✏️ Brush
          </button>
          <button
            onClick={() => onToolChange('eraser')}
            className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-semibold"
          >
            🗑️ Eraser
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-white font-semibold mb-2">Colors</h4>
        <div className="grid grid-cols-6 gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className="w-full h-8 rounded border-2 border-gray-600 hover:border-white transition"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-white font-semibold mb-2">Brush Size</h4>
        <div className="grid grid-cols-3 gap-2">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => onSizeChange(size)}
              className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm"
            >
              {size}px
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-white font-semibold mb-2">Eraser Size</h4>
        <div className="grid grid-cols-3 gap-2">
          {ERASER_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => onSizeChange(size)}
              className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm"
            >
              {size}px
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
