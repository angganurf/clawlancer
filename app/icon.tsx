import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#1a1614',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="#c9a882">
            {/* Lobster claw */}
            <ellipse cx="50" cy="65" rx="32" ry="22" />
            <ellipse cx="50" cy="65" rx="20" ry="12" fill="#1a1614"/>
            {/* Top pincers */}
            <path d="M25 40 Q15 25 30 15 Q45 10 50 25 Q40 30 35 40 Z" />
            <path d="M75 40 Q85 25 70 15 Q55 10 50 25 Q60 30 65 40 Z" />
            {/* Claw joints */}
            <ellipse cx="32" cy="48" rx="10" ry="7" />
            <ellipse cx="68" cy="48" rx="10" ry="7" />
          </g>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
