'use client'

export function HandDrawnBorder() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 500"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 10px 25px rgba(0, 0, 0, 0.3))' }}
      preserveAspectRatio="none"
    >
      {/* Hand-drawn border effect (wavy, not perfect) */}
      <path
        d="M 8,8 Q 15,5 25,8 T 50,8 T 75,8 T 100,8 T 125,8 T 150,8 T 175,8 T 200,8 T 225,8 T 250,8 T 275,8 T 300,8 T 325,8 T 350,8 T 375,8 T 392,10 L 395,25 Q 395,40 393,60 T 392,100 T 392,150 T 392,200 T 392,250 T 392,300 T 392,350 T 392,400 T 393,450 L 392,485 Q 385,492 375,492 T 350,492 T 325,492 T 300,492 T 275,492 T 250,492 T 225,492 T 200,492 T 175,492 T 150,492 T 125,492 T 100,492 T 75,492 T 50,492 T 25,492 Q 10,490 8,485 L 8,470 Q 8,450 8,430 T 8,380 T 8,330 T 8,280 T 8,230 T 8,180 T 8,130 T 8,80 T 8,40 Z"
        fill="none"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Decorative scribbles in corners */}
      <g opacity="0.3">
        {/* Top-left scribble */}
        <path d="M 15,15 Q 18,20 15,25 Q 12,20 15,15 M 20,10 Q 22,15 20,20" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Top-right scribble */}
        <path d="M 385,15 Q 382,20 385,25 Q 388,20 385,15 M 380,10 Q 378,15 380,20" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Bottom-left scribble */}
        <path d="M 15,485 Q 18,480 15,475 Q 12,480 15,485 M 20,490 Q 22,485 20,480" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Bottom-right scribble */}
        <path d="M 385,485 Q 382,480 385,475 Q 388,480 385,485 M 380,490 Q 378,485 380,480" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
