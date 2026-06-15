export default function HeroBanner({ greeting, firstName, date, week }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-card-md relative mb-6">
      <svg viewBox="0 0 1200 200" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
        <defs>
          <linearGradient id="hb-sky" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2A0A14" />
            <stop offset="55%" stopColor="#4A1228" />
            <stop offset="100%" stopColor="#7A2442" />
          </linearGradient>
          <radialGradient id="hb-moon" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FAF6F1" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FAF6F1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hb-overlay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2A0A14" stopOpacity="0" />
            <stop offset="100%" stopColor="#2A0A14" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect width="1200" height="200" fill="url(#hb-sky)" />

        {/* Moon glow */}
        <ellipse cx="960" cy="65" rx="100" ry="100" fill="url(#hb-moon)" />
        <circle cx="960" cy="62" r="34" fill="#FAF6F1" opacity="0.10" />
        <circle cx="960" cy="62" r="20" fill="#FAF6F1" opacity="0.08" />

        {/* Constellation lines */}
        <g stroke="white" strokeWidth="0.6" opacity="0.18">
          <line x1="75" y1="30" x2="148" y2="50" />
          <line x1="148" y1="50" x2="218" y2="24" />
          <line x1="285" y1="40" x2="365" y2="60" />
          <line x1="730" y1="35" x2="805" y2="50" />
          <line x1="805" y1="50" x2="885" y2="30" />
          <line x1="1055" y1="40" x2="1135" y2="55" />
        </g>

        {/* Stars */}
        <circle cx="75" cy="30" r="2.2" fill="white" opacity="0.9" />
        <circle cx="148" cy="50" r="1.6" fill="white" opacity="0.75" />
        <circle cx="218" cy="24" r="1.6" fill="white" opacity="0.8" />
        <circle cx="285" cy="40" r="2.4" fill="white" opacity="0.9" />
        <circle cx="365" cy="60" r="1.4" fill="white" opacity="0.65" />
        <circle cx="435" cy="28" r="1.1" fill="white" opacity="0.55" />
        <circle cx="555" cy="65" r="1.1" fill="white" opacity="0.45" />
        <circle cx="615" cy="24" r="1.6" fill="white" opacity="0.7" />
        <circle cx="672" cy="52" r="1.8" fill="white" opacity="0.75" />
        <circle cx="730" cy="35" r="2.4" fill="white" opacity="0.9" />
        <circle cx="805" cy="50" r="1.5" fill="white" opacity="0.65" />
        <circle cx="885" cy="30" r="2.0" fill="white" opacity="0.8" />
        <circle cx="1002" cy="75" r="1.1" fill="white" opacity="0.5" />
        <circle cx="1055" cy="40" r="2.0" fill="white" opacity="0.8" />
        <circle cx="1135" cy="55" r="1.5" fill="white" opacity="0.65" />
        <circle cx="1180" cy="30" r="1.1" fill="white" opacity="0.5" />
        <circle cx="175" cy="72" r="0.9" fill="white" opacity="0.38" />
        <circle cx="335" cy="74" r="0.9" fill="white" opacity="0.35" />
        <circle cx="488" cy="55" r="0.9" fill="white" opacity="0.38" />
        <circle cx="780" cy="74" r="0.9" fill="white" opacity="0.35" />
        <circle cx="1090" cy="68" r="0.9" fill="white" opacity="0.38" />

        {/* North Star — 4-point burst */}
        <g transform="translate(500,44)" opacity="0.95">
          <line x1="0" y1="-9" x2="0" y2="9" stroke="white" strokeWidth="1.4" opacity="0.55" />
          <line x1="-9" y1="0" x2="9" y2="0" stroke="white" strokeWidth="1.4" opacity="0.55" />
          <circle cx="0" cy="0" r="2.8" fill="white" />
        </g>

        {/* Mountain layer 1 — far, soft */}
        <path
          d="M0,200 L0,138 Q60,118 130,128 Q200,115 280,92 Q360,72 440,90 Q520,108 600,88 Q680,68 760,82 Q840,96 920,78 Q1000,62 1080,76 Q1140,86 1200,70 L1200,200 Z"
          fill="#4A1228" opacity="0.65"
        />
        {/* Mountain layer 2 — mid */}
        <path
          d="M0,200 L0,160 Q90,142 190,155 Q290,140 390,125 Q460,116 540,132 Q620,148 700,128 Q790,108 890,132 Q970,150 1060,125 Q1120,112 1200,130 L1200,200 Z"
          fill="#3A0F1E" opacity="0.88"
        />
        {/* Foreground ridge */}
        <path
          d="M0,200 L0,182 Q120,170 260,180 Q400,170 540,176 Q680,170 820,180 Q960,172 1100,178 L1200,175 L1200,200 Z"
          fill="#2A0A14"
        />

        {/* Bottom text gradient overlay */}
        <rect width="1200" height="200" fill="url(#hb-overlay)" />
      </svg>

      {/* Greeting overlay */}
      <div className="absolute bottom-0 left-0 px-6 pb-5">
        <h1 className="font-serif text-[26px] md:text-[30px] text-white leading-tight tracking-tight drop-shadow-sm">
          {greeting}, {firstName}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-white/70">{date}</p>
          <span className="text-[11px] font-medium text-white/85 bg-white/15 border border-white/25 px-2.5 py-0.5 rounded-full">
            Week {week} of 4
          </span>
        </div>
      </div>
    </div>
  )
}
