'use client'

export function BackgroundDoodles() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1200 800"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.08 }}
    >
      {/* Top-left sketches */}
      <g strokeWidth="2" stroke="white" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Wavy lines */}
        <path d="M 50,100 Q 80,80 110,100 T 170,100" opacity="0.5" />
        <path d="M 40,150 Q 70,130 100,150 T 160,150" opacity="0.4" />

        {/* Simple arrows */}
        <path d="M 30,200 L 60,200 L 50,190 M 60,200 L 50,210" opacity="0.6" />

        {/* Circles */}
        <circle cx="80" cy="280" r="20" opacity="0.4" />
        <circle cx="120" cy="300" r="15" opacity="0.3" />

        {/* Zigzag */}
        <path d="M 20,350 L 40,360 L 20,370 L 40,380 L 20,390" opacity="0.5" />
      </g>

      {/* Top-right sketches */}
      <g strokeWidth="2" stroke="white" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1000, 80)">
        {/* Scribbles */}
        <path d="M 10,20 Q 20,15 30,25 T 50,20" opacity="0.5" />
        <path d="M 15,50 L 25,45 L 35,55 L 45,48" opacity="0.4" />

        {/* Checkmark-like */}
        <path d="M 20,80 L 30,90 L 45,70" opacity="0.6" strokeWidth="2.5" />

        {/* X mark */}
        <path d="M 15,120 L 35,140 M 35,120 L 15,140" opacity="0.5" />
      </g>

      {/* Bottom-left sketches */}
      <g strokeWidth="2" stroke="white" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(60, 600)">
        {/* Curved lines */}
        <path d="M 10,10 Q 30,20 50,10" opacity="0.5" />
        <path d="M 0,40 Q 20,50 40,40" opacity="0.4" />
        <path d="M 5,70 Q 25,80 45,70" opacity="0.45" />

        {/* Triangle frame */}
        <path d="M 20,100 L 40,130 L 0,130 Z" opacity="0.5" />
      </g>

      {/* Bottom-right sketches */}
      <g strokeWidth="2" stroke="white" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1080, 650)">
        {/* Dots and lines */}
        <circle cx="10" cy="10" r="2" fill="white" opacity="0.6" />
        <circle cx="25" cy="15" r="2" fill="white" opacity="0.5" />
        <circle cx="40" cy="8" r="2" fill="white" opacity="0.4" />
        <path d="M 5,30 L 45,35" opacity="0.5" />

        {/* Wave */}
        <path d="M 0,50 Q 10,45 20,50 T 40,50" opacity="0.45" />
      </g>

      {/* Center faint strokes (hint of gameplay) */}
      <g strokeWidth="1.5" stroke="white" fill="none" opacity="0.05" strokeLinecap="round">
        <path d="M 400,300 Q 420,280 450,300 T 500,300" />
        <path d="M 700,200 L 750,250 L 700,300" />
        <circle cx="600" cy="400" r="30" />
        <path d="M 550,500 L 580,480 L 610,500 L 640,480" />
      </g>
    </svg>
  )
}
