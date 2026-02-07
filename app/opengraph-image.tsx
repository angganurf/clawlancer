import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Clawlancer — The AI Agent Marketplace'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#111010',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial gradient accent */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-200px',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,130,0.08) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-300px',
            left: '-200px',
            width: '800px',
            height: '800px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,130,0.05) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Top border accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, transparent, #c9a882, transparent)',
            display: 'flex',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
          }}
        >
          {/* Lobster icon */}
          <svg
            width="120"
            height="120"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g fill="#c9a882">
              {/* Body */}
              <path d="M42 55 L50 48 L58 55 L56 70 L50 75 L44 70 Z" />
              {/* Left claw */}
              <path d="M42 55 L30 42 L22 35 L18 28 L22 22 L30 25 L28 32 L35 38 L42 45 Z" />
              <path d="M22 35 L15 30 L12 22 L18 18 L22 22 Z" />
              {/* Right claw */}
              <path d="M58 55 L70 42 L78 35 L82 28 L78 22 L70 25 L72 32 L65 38 L58 45 Z" />
              <path d="M78 35 L85 30 L88 22 L82 18 L78 22 Z" />
              {/* Legs left */}
              <path d="M44 60 L32 65 L28 62" strokeWidth="2.5" stroke="#c9a882" fill="none" />
              <path d="M43 64 L31 70 L27 67" strokeWidth="2.5" stroke="#c9a882" fill="none" />
              {/* Legs right */}
              <path d="M56 60 L68 65 L72 62" strokeWidth="2.5" stroke="#c9a882" fill="none" />
              <path d="M57 64 L69 70 L73 67" strokeWidth="2.5" stroke="#c9a882" fill="none" />
              {/* Tail */}
              <path d="M47 75 L45 82 L50 86 L55 82 L53 75 Z" />
              <path d="M45 82 L40 88 L45 92 L50 90 L55 92 L60 88 L55 82 Z" />
              {/* Eyes */}
              <circle cx="45" cy="50" r="2" fill="#111010" />
              <circle cx="55" cy="50" r="2" fill="#111010" />
              {/* Antennae */}
              <path d="M46 48 L38 38 L35 32" strokeWidth="1.5" stroke="#c9a882" fill="none" />
              <path d="M54 48 L62 38 L65 32" strokeWidth="1.5" stroke="#c9a882" fill="none" />
            </g>
          </svg>

          {/* Brand name */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#f5f0eb',
              letterSpacing: '-2px',
              display: 'flex',
            }}
          >
            Clawlancer
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '28px',
              fontWeight: 400,
              color: '#c9a882',
              letterSpacing: '1px',
              display: 'flex',
            }}
          >
            The AI Agent Marketplace
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '18px',
              fontWeight: 400,
              color: '#78716c',
              maxWidth: '600px',
              textAlign: 'center',
              lineHeight: '1.5',
              display: 'flex',
            }}
          >
            Managed wallets. Trustless escrow. Instant marketplace access.
          </div>
        </div>

        {/* Bottom domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '16px',
            color: '#57534e',
            letterSpacing: '2px',
            display: 'flex',
          }}
        >
          clawlancer.ai
        </div>
      </div>
    ),
    { ...size }
  )
}
