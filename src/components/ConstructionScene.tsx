import { useId } from 'react';

// Decorative illustration only: nothing here represents measured site activity.
export function ConstructionScene() {
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className="construction-scene" viewBox="0 0 720 470" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-ground`} x1="200" y1="170" x2="580" y2="430" gradientUnits="userSpaceOnUse">
          <stop stopColor="#243038" /><stop offset="1" stopColor="#101a22" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="250" y1="100" x2="450" y2="360" gradientUnits="userSpaceOnUse">
          <stop stopColor="#63888e" /><stop offset="0.5" stopColor="#293d48" /><stop offset="1" stopColor="#14212a" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="70" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe0a1" /><stop offset="1" stopColor="#bd8540" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor="#b28b4f" stopOpacity=".18" /><stop offset="1" stopColor="#b28b4f" stopOpacity="0" /></radialGradient>
        <pattern id={`${id}-grid`} width="35" height="20" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .5 -1 .5 350 80)">
          <path d="M35 0H0V20" stroke="#d5be8d" strokeOpacity=".1" strokeWidth=".7" />
        </pattern>
      </defs>

      <ellipse cx="378" cy="280" rx="330" ry="190" fill={ref('halo')} />
      <g className="site-orbit" stroke="#d8b77c" strokeOpacity=".14">
        <ellipse cx="370" cy="316" rx="315" ry="119" strokeDasharray="2 10" />
        <path d="M27 316H70M669 316H712M370 185V204M370 427V447" />
      </g>
      <ellipse cx="365" cy="363" rx="265" ry="71" fill="#000" opacity=".35" />

      {/* The floating site / bevelled foundation. */}
      <path d="M63 282 359 129 665 282 366 439Z" fill="#080d12" />
      <path d="M63 265V282L366 439V421Z" fill="#1c2730" />
      <path d="M366 421 665 265V282L366 439Z" fill="#101a23" />
      <path d="M63 265 359 112 665 265 366 421Z" fill={ref('ground')} stroke="#b49a66" strokeOpacity=".36" />
      <path d="M63 265 359 112 665 265 366 421Z" fill={ref('grid')} />
      <path className="site-edge-light" d="m64 265 302 156 298-156" stroke="#e3b96e" strokeOpacity=".55" />

      {/* Service road, lane markings, stacks and landscape. */}
      <path d="m98 274 258 132 261-136-45-23-216 112-215-109Z" fill="#0c141b" stroke="#35424a" />
      <path d="m118 272 238 122 235-122" stroke="#d2b983" strokeOpacity=".45" strokeDasharray="12 11" />
      <g stroke="#49555c" strokeWidth="1.5">
        <path d="m173 245 42-22 35 18-42 22Z" fill="#8b795e" />
        <path d="m173 245 35 18v14l-35-18Z" fill="#5c503f" />
        <path d="m208 263 42-22v14l-42 22Z" fill="#74634a" />
        <path d="m181 241 35 18m-23-24 35 18m-8-16v16" />
      </g>
      <g fill="#41554a" stroke="#718072" strokeOpacity=".5">
        <path d="m145 271 14-41 15 40-14 8Z" /><path d="m550 276 16-46 17 44-17 9Z" />
        <path d="m583 258 12-35 13 35-13 6Z" />
      </g>

      {/* A partly built tower with solid slabs, inset glazing and warm windows. */}
      <path d="m253 195 109-56 104 54-109 57Z" fill="#3a4a54" stroke="#7e9298" strokeOpacity=".45" />
      <path d="m253 195 104 55v115l-104-54Z" fill="#25343f" />
      <path d="m357 250 109-57v114l-109 58Z" fill={ref('glass')} />
      <g stroke="#7e9aa4" strokeOpacity=".25">
        {[0, 1, 2, 3].map(i => <path key={i} d={`m253 ${218 + i * 24} 104 54 109-57`} />)}
        {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${375 + i * 18} ${241 - i * 9.4}v112`} />)}
        {[0, 1, 2, 3].map(i => <path key={i} d={`M${273 + i * 21} ${207 + i * 11}v112`} />)}
      </g>
      <g fill="#d0ae71" opacity=".58">
        <path d="m279 234 12 6v13l-12-6Z" /><path d="m320 279 13 7v14l-13-7Z" />
        <path className="site-window" d="m381 264 12-6v14l-12 6Z" /><path d="m420 289 12-6v14l-12 6Z" />
      </g>
      <g stroke="#8a9696" strokeWidth="3">
        <path d="M253 195v-53m104 108v-54m109-3v-52M307 168v-53m105 51v-52" />
        <path d="m253 142 109-57 104 56-109 55Z" fill="#182630" />
        <path d="m253 165 104 55 109-56m-159-49 105 51m-105-24 105-55" strokeWidth="1.2" strokeOpacity=".6" />
      </g>
      <path d="m253 142 104 54 109-55" stroke="#d9b16f" strokeWidth="2" />
      <g stroke="#a1a3a0" strokeWidth="1.3" opacity=".7">
        <path d="M259 138v-15m43-7v-15m56 90v-16m53-39v-15m48 15v-15" />
        <path d="m259 123 99 52 101-54" />
      </g>

      {/* Tower crane and travelling hoist. */}
      <g stroke="#d3a45d" strokeLinejoin="round">
        <path d="m484 291 18-9 18 9-18 10Z" fill="#695637" />
        <path d="M495 287V58h15v229" fill="#796239" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5, 6].map(i => <path key={i} d={`m495 ${70 + i * 30} 15 30m-15 0 15-30`} strokeOpacity=".8" />)}
        <path d="m347 60 259-20v13L347 74Z" fill="#b38b4e" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <path key={i} d={`m${355 + i * 27} ${60 - i * 2} 17 11 10-13`} stroke="#f0cd8d" strokeWidth="1" />)}
        <path d="m354 60 148-37 100 17M502 23v31" strokeWidth="1.3" />
        <path d="m474 58 17-2v19l-17 2Z" fill="#d7b473" />
        <path d="m478 61 9-1v9l-9 1Z" fill="#20333f" stroke="none" />
        <path d="m582 43 21-2v25l-21 2Z" fill="#4f5556" />
      </g>
      <g className="crane-hoist">
        <path d="M380 72v88m9-89v90" stroke="#c7b587" strokeWidth="1.2" />
        <g className="crane-load">
          <path d="m376 166 9-8 10 8m-10-8v-4" stroke="#eac686" strokeWidth="2" />
          <path d="m367 171 20-10 27 13-21 11Z" fill="#b7b5a3" />
          <path d="m367 171 26 14v13l-26-14Z" fill="#777e78" />
          <path d="m393 185 21-11v13l-21 11Z" fill="#93998c" />
        </g>
      </g>

      {/* Excavator: a tracked base and independently pivoting boom. */}
      <g transform="translate(480 287)">
        <ellipse cx="14" cy="37" rx="45" ry="14" fill="#050a0d" opacity=".55" />
        <path d="m-19 21 39-19 30 16-39 21Z" fill="#16222a" />
        <path d="m-19 21 30 18v10l-30-17Zm30 18 39-21v10L11 49Z" fill="#0b1219" stroke="#5b6466" />
        <path d="m-12 31 23 13 30-16" stroke="#7b8180" strokeWidth="2" strokeDasharray="3 4" />
        <path d="m-5 9 24-13 27 14-25 13Z" fill="#f0c782" />
        <path d="m-5 9 26 14v13L-5 22Z" fill="#b58341" />
        <path d="m21 23 25-13v13L21 36Z" fill="#dab06c" />
        <path d="M4 10V-9l17-9 16 8v20l-16 9Z" fill="#b78645" stroke="#f0cc8c" />
        <path d="M8 7V-7l12-6v17Z" fill="#233743" /><path d="m24 3 9 5V-7l-9-4Z" fill="#415965" />
        <g className="excavator-boom">
          <path d="m0 7-22-39-11 4 23 41Z" fill="#d8a75f" stroke="#f6cf8e" />
          <path d="m-26-29-32 14 3 10 34-16Z" fill="#bd8c48" stroke="#e4b978" />
          <path d="m-55-13-8 19-13-3 7-20Z" fill="#566366" stroke="#8d9690" />
          <path d="m-1 4-21-32m-8 1-23 13" stroke="#e5d9bc" strokeWidth="2" />
          <circle cx="-24" cy="-27" r="3" fill="#4d4636" />
        </g>
      </g>

      {/* Truck stays on the service road. */}
      <g className="site-truck-route">
        <g transform="translate(236 335)">
          <ellipse cx="4" cy="25" rx="42" ry="12" fill="#02080c" opacity=".65" />
          <path d="m-34-10 33-17 38 20L4 10Z" fill="#d7d0b8" />
          <path d="m-34-10 38 20v18l-38-20Z" fill="#817862" />
          <path d="M4 10 37-7v18L4 28Z" fill="#b8ad8f" />
          <path d="m-27-8 28 14 27-14" stroke="#eee1bc" strokeWidth="1.4" />
          <path d="m4 9 17 9 19-10V-9L23-18 4-8Z" fill="#eac17a" />
          <path d="m23-14 14 7v10L23-4Z" fill="#3d5663" /><path d="m8-6 12-6v10L8 4Z" fill="#203441" />
          <ellipse cx="-20" cy="10" rx="5" ry="7" fill="#080d12" transform="rotate(-25 -20 10)" />
          <ellipse cx="9" cy="25" rx="5" ry="7" fill="#080d12" transform="rotate(-25 9 25)" />
          <ellipse cx="32" cy="15" rx="4" ry="6" fill="#080d12" transform="rotate(25 32 15)" />
          <path d="m36 4 3-2v5l-3 2Z" fill="#ffe7af" />
        </g>
      </g>

      {/* Miniature workers with articulated walking legs. */}
      {[{ x: 185, y: 286, cls: 'worker-one' }, { x: 426, y: 332, cls: 'worker-two' }, { x: 335, y: 325, cls: 'worker-three' }].map(({ x, y, cls }) => (
        <g key={cls} transform={`translate(${x} ${y})`}>
          <g className={`site-worker ${cls}`}>
            <ellipse cx="0" cy="17" rx="9" ry="3" fill="#050a0d" opacity=".65" />
            <path className="worker-leg-a" d="M-2 6-5 17" stroke="#99a6a9" strokeWidth="3" strokeLinecap="round" />
            <path className="worker-leg-b" d="M2 6 5 16" stroke="#667b86" strokeWidth="3" strokeLinecap="round" />
            <path d="M-4-5 4-5 5 7-4 7Z" fill="#d9ac58" />
            <path d="M-3-4 1 6M3-4-1 6" stroke="#f8e6a9" strokeWidth="1" />
            <path d="m-5-3-4 8M5-3l3 7" stroke="#c6b39a" strokeWidth="2.5" strokeLinecap="round" />
            <circle cy="-10" r="4" fill="#d1b293" /><path d="M-5-10c0-7 10-7 10 0Z" fill="#f6cf7d" />
            <path d="M-6-10H6" stroke="#f6cf7d" strokeWidth="2" />
          </g>
        </g>
      ))}

      {/* Technical callouts deliberately describe the illustration, not live telemetry. */}
      <g className="scene-callout" fontFamily="'JetBrains Mono', monospace" fontSize="9" letterSpacing="1.2">
        <path d="M520 95h63l18-18h74" stroke="#a48a5e" strokeOpacity=".6" /><circle cx="520" cy="95" r="3" fill="#e8c78f" />
        <text x="675" y="68" fill="#b4b9b5" textAnchor="end">BUILDING TOMORROW</text>
        <path d="m170 226-42-22H44" stroke="#a48a5e" strokeOpacity=".6" /><circle cx="170" cy="226" r="3" fill="#e8c78f" />
        <text x="44" y="194" fill="#b4b9b5">EVERY DETAIL MATTERS</text>
      </g>
      <g fill="#e3bd79" className="site-sparks">
        <circle cx="229" cy="176" r="1.5" /><circle cx="548" cy="140" r="1.7" /><circle cx="137" cy="337" r="1.3" /><circle cx="612" cy="335" r="1.2" />
      </g>
    </svg>
  );
}
