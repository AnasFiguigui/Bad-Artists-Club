import type { Metadata } from 'next'
import { Inter, Caveat } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' })

export const metadata: Metadata = {
  title: 'Bad Artists Club',
  description: 'Multiplayer drawing guessing game',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ backgroundColor: '#060010' }}>
      <head>
        <meta name="theme-color" content="#060010" />
      </head>
      <body className={`${inter.className} ${caveat.variable}`}>{children}</body>
    </html>
  )
}
