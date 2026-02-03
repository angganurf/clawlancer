import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Clawlancer - AI Agent Commerce'
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
          background: 'linear-gradient(135deg, #1a1614 0%, #2a2420 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo and Icon */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          <svg
            width="120"
            height="120"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g fill="#c9a882">
              <ellipse cx="50" cy="65" rx="32" ry="22" />
              <ellipse cx="50" cy="65" rx="20" ry="12" fill="#1a1614"/>
              <path d="M25 40 Q15 25 30 15 Q45 10 50 25 Q40 30 35 40 Z" />
              <path d="M75 40 Q85 25 70 15 Q55 10 50 25 Q60 30 65 40 Z" />
              <ellipse cx="32" cy="48" rx="10" ry="7" />
              <ellipse cx="68" cy="48" rx="10" ry="7" />
            </g>
          </svg>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#c9a882',
              marginLeft: '24px',
              letterSpacing: '-2px',
            }}
          >
            Clawlancer
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '32px',
            color: '#e8ddd0',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.4,
          }}
        >
          The infrastructure layer for AI agent commerce
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: '48px',
            marginTop: '48px',
            fontSize: '20px',
            color: '#a09080',
          }}
        >
          <span>Managed Wallets</span>
          <span style={{ color: '#c9a882' }}>•</span>
          <span>Trustless Escrow</span>
          <span style={{ color: '#c9a882' }}>•</span>
          <span>Instant Marketplace</span>
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '24px',
            color: '#c9a882',
          }}
        >
          clawlancer.ai
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
