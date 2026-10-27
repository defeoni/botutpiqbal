import { useId } from 'react';

// A shared isometric projection keeps every object on the same ground plane.
const project = (x: number, y: number, z = 0) => [550 + (x - y) * .88, 340 + (x + y) * .43 - z];
const point = (x: number, y: number, z = 0) => project(x, y, z).join(',');

interface BlockProps {
  x: number; y: number; z?: number; width: number; depth: number; height: number;
  top?: string; front?: string; side?: string;
}

function Block({ x, y, z = 0, width: w, depth: d, height: h, top = '#f5f3ed', front = '#c8cdd0', side = '#a2adb5' }: BlockProps) {
  return <g stroke="#526472" strokeOpacity=".12" strokeWidth=".65" strokeLinejoin="round">
    <polygon points={[point(x, y + d, z), point(x + w, y + d, z), point(x + w, y + d, z + h), point(x, y + d, z + h)].join(' ')} fill={front} />
    <polygon points={[point(x + w, y, z), point(x + w, y + d, z), point(x + w, y + d, z + h), point(x + w, y, z + h)].join(' ')} fill={side} />
    <polygon points={[point(x, y, z + h), point(x + w, y, z + h), point(x + w, y + d, z + h), point(x, y + d, z + h)].join(' ')} fill={top} />
  </g>;
}

function Worker({ x, y, z = 0, walking = false, delay = '0s' }: { x: number; y: number; z?: number; walking?: boolean; delay?: string }) {
  const [px, py] = project(x, y, z);
  return <g transform={`translate(${px} ${py})`}>
    <g className={walking ? 'site-worker' : undefined} style={{ animationDelay: delay }}>
      <ellipse cy="1" rx="7" ry="2.5" fill="#475569" opacity=".16" />
      <path className={walking ? 'worker-leg-a' : undefined} d="M-2-8-4 0" stroke="#334155" strokeWidth="2.6" strokeLinecap="round" />
      <path className={walking ? 'worker-leg-b' : undefined} d="M2-8 4 0" stroke="#536b7d" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M-4-19 4-19 5-8H-5Z" fill="#f29d38" /><path d="M-2-19v11m4-11v11M-4-12h8" stroke="#fff6cf" strokeWidth="1.3" />
      <path d="m-5-17-3 7m13-7 3 6" stroke="#d4a680" strokeWidth="2.3" strokeLinecap="round" />
      <circle cy="-23" r="3.6" fill="#d4a680" /><path d="M-5-24c0-7 10-7 10 0m-11 0H6" fill="#fff3d1" stroke="#dca84d" strokeWidth="1" />
    </g>
  </g>;
}

function Tree({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${project(x, y).join(' ')})`}>
    <ellipse rx="20" ry="7" fill="#395c4b" opacity=".12" /><path d="M0 0v-24" stroke="#9c8168" strokeWidth="4" />
    <path d="M0-66-20-24 0-15Z" fill="#8daf95" /><path d="M0-66 21-24 0-15Z" fill="#577f69" />
    <path d="M0-78-15-44 0-35Z" fill="#a7c2a6" /><path d="M0-78 16-44 0-35Z" fill="#71957c" />
  </g>;
}

// Original decorative artwork. Activity is illustrative, not site telemetry.
export function ConstructionScene() {
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}-${name})`;
  return <svg className="construction-scene" viewBox="0 -145 1100 825" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b8d9e4" /><stop offset=".5" stopColor="#769cab" /><stop offset="1" stopColor="#496a7c" /></linearGradient>
      <linearGradient id={`${id}-red`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ed5360" /><stop offset="1" stopColor="#b71d30" /></linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#516578" stopOpacity=".23" /><stop offset="1" stopColor="#516578" stopOpacity="0" /></radialGradient>
      <pattern id={`${id}-blueprint`} width="48" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 24 0 48 12 24 24Z" stroke="#8295a3" strokeOpacity=".09" strokeWidth=".7" /></pattern>
    </defs>

    <ellipse cx="553" cy="520" rx="497" ry="141" fill={ref('shadow')} />
    <path d="M34 398 550 140 1066 398 550 656Z" fill={ref('blueprint')} />
    <Block x={-285} y={-245} z={-22} width={600} depth={550} height={22} top="#eeeae1" front="#d0d5d6" side="#b5c1c8" />
    <Block x={-285} y={-245} z={-5} width={600} depth={550} height={5} top="#f1eee7" front="#e2e5e4" side="#ced5d6" />
    <path d={`M${point(-265, 248, 1)} ${point(270, 248, 1)} ${point(270, -215, 1)}`} stroke="#788794" strokeWidth="51" />
    <path d={`M${point(-265, 248, 2)} ${point(270, 248, 2)} ${point(270, -215, 2)}`} stroke="#f7f5ee" strokeWidth="1.8" strokeDasharray="13 12" />
    <path d={`M${point(-280, 292)} ${point(306, 292)} ${point(306, -235)}`} stroke="#c42b3d" strokeWidth="3" />

    {/* Office and material yard behind the structure. */}
    <Tree x={-245} y={-182} /><Tree x={286} y={-222} />
    <Block x={-235} y={-190} width={94} depth={47} height={39} top="#f9fafb" front="#db3144" side="#9c2133" />
    {[-225, -198, -171].map(x => <Block key={x} x={x} y={-142} z={13} width={17} depth={1} height={15} top="#fff" front="#c4e0e9" side="#7495a3" />)}
    <Block x={105} y={-175} width={85} depth={80} height={7} top="#d2c8b5" front="#b4ab9a" side="#a59a87" />
    {[0, 1, 2].map(i => <Block key={i} x={113 + i * 23} y={-166} z={7} width={7} depth={64} height={22} top="#e6d5af" front="#bfa274" side="#a68b60" />)}

    {/* Red crane, counterweight, travelling trolley and cable. */}
    <g className="site-crane">
      <Block x={125} y={-90} width={48} depth={46} height={12} top="#f3f0ea" front="#adb6bc" side="#82939e" />
      <Block x={142} y={-76} z={12} width={12} depth={12} height={325} top="#f86e76" front={ref('red')} side="#9b1d30" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${point(143, -63, 15 + i * 26)} ${point(154, -63, 41 + i * 26)} M${point(154, -63, 15 + i * 26)} ${point(143, -63, 41 + i * 26)}`} stroke="#ffafb4" strokeWidth="1" />)}
      <Block x={-170} y={-80} z={333} width={415} depth={15} height={17} top="#ee5965" front="#d8283e" side="#9c1a2d" />
      {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${point(-165 + i * 23, -64, 335)} ${point(-154 + i * 23, -64, 349)} ${point(-142 + i * 23, -64, 335)}`} stroke="#ffb7bb" strokeWidth="1.2" />)}
      <path d={`M${point(-168, -72, 351)} ${point(148, -72, 394)} ${point(244, -72, 351)} M${point(148, -72, 394)} ${point(148, -72, 350)}`} stroke="#b92237" strokeWidth="1.8" />
      <Block x={209} y={-84} z={305} width={37} depth={24} height={26} top="#a6b4bf" front="#687b8a" side="#445a6c" />
      <Block x={121} y={-62} z={309} width={23} depth={23} height={21} top="#fff5ef" front="#f4c0b8" side="#c73b4c" />
      <path d={`M${point(124, -38, 313)} ${point(140, -38, 313)} ${point(140, -38, 325)} ${point(124, -38, 325)}Z`} fill="#668b9e" />
    </g>

    <path d={`M${point(-95, -80)} ${point(88, -80)} ${point(195, 130)} ${point(20, 210)}Z`} fill="#647a8b" opacity=".12" />
    {/* Floors: lower glazing, open concrete frame, exposed top-floor rebar. */}
    <g className="site-building">
      {[0, 48, 96, 144, 192, 240].map((z, floor) => <g key={z}>
        {[-83, -7, 69].flatMap(x => [-68, 3, 74].map(y => <Block key={`${x}-${y}`} x={x} y={y} z={z} width={9} depth={9} height={43} top="#f3f0e9" front="#c3c9ca" side="#92a1a9" />))}
        {floor < 3 && <>
          <polygon points={[point(-83, 84, z + 5), point(78, 84, z + 5), point(78, 84, z + 42), point(-83, 84, z + 42)].join(' ')} fill={ref('glass')} />
          <polygon points={[point(79, -68, z + 5), point(79, 84, z + 5), point(79, 84, z + 42), point(79, -68, z + 42)].join(' ')} fill="#a3c3ce" opacity=".9" />
          {Array.from({ length: 8 }, (_, i) => <g key={i} stroke="#e5f1f3" strokeWidth="1.2" opacity=".75"><path d={`M${point(-80 + i * 22, 85, z + 5)} ${point(-80 + i * 22, 85, z + 42)}`} /><path d={`M${point(80, -63 + i * 21, z + 5)} ${point(80, -63 + i * 21, z + 42)}`} /></g>)}
        </>}
        <Block x={-93} y={-79} z={z + 42} width={183} depth={174} height={7} top={floor > 2 ? '#eee9df' : '#f8f7f2'} front="#d9dcdc" side="#b7c3c9" />
        {floor > 2 && <path d={`M${point(-87, 95, z + 54)} ${point(90, 95, z + 54)} ${point(90, -73, z + 54)}`} stroke="#cf4350" strokeWidth="1.4" />}
      </g>)}
      {[-80, -4, 72].flatMap(x => [-65, 7, 78].map(y => <path key={`${x}-${y}`} d={`M${point(x, y, 288)} ${point(x, y, 308)}`} stroke="#9b8e7e" strokeWidth="1.3" />))}
      <Block x={-62} y={-48} z={289} width={45} depth={28} height={11} top="#c9b28b" front="#ab8d63" side="#89734f" />
      <Worker x={49} y={55} z={289} /><Worker x={10} y={92} z={193} />
    </g>
    <g transform={`translate(${project(-120, -64, 333).join(' ')})`}>
      <g className="crane-hoist">
        <rect x="-5" y="-4" width="15" height="7" rx="2" fill="#405466" />
        <g className="crane-cable"><path d="M0 0V129M6 0V129" stroke="#637582" strokeWidth="1.1" /></g>
        <g className="crane-load">
          <path d="m-17 144 20-15 25 14" stroke="#5e7382" strokeWidth="1.4" />
          <path d="m-23 143 28-14 34 18-29 14Z" fill="#f5f1e8" /><path d="m-23 143 33 18v12l-33-18Z" fill="#c4c6c2" /><path d="m10 161 29-14v12l-29 14Z" fill="#98a8ad" />
        </g>
      </g>
    </g>

    {/* Scaffolding and a material lift. */}
    <g stroke="#718998" strokeWidth="1.5" opacity=".85">
      {[106, 126].map(x => [-58, 5, 68].map(y => <path key={`${x}-${y}`} d={`M${point(x, y, 3)} ${point(x, y, 248)}`} />))}
      {[24, 72, 120, 168, 216].map(z => <g key={z}><path d={`M${point(105, -58, z)} ${point(126, -58, z)} ${point(126, 78, z)} ${point(105, 78, z)}`} /><path d={`M${point(126, -58, z)} ${point(126, 5, z + 45)} ${point(126, 68, z)}`} /></g>)}
    </g>
    <Block x={107} y={53} z={12} width={25} depth={24} height={38} top="#ec7980" front="#da3548" side="#a82438" />

    {/* Pallets, steel, sand and concrete pipes. */}
    {[0, 1, 2].map(i => <Block key={i} x={-233} y={-40 + i * 23} width={67} depth={16} height={14 + i * 5} top="#d8bd91" front="#b18c5f" side="#8d6d48" />)}
    {[0, 1, 2, 3, 4].map(i => <Block key={i} x={-228 + i * 10} y={68} width={6} depth={75} height={6} top="#a4b0b6" front="#6d818e" side="#4d6574" />)}
    <path d={`M${point(164, 100)} ${point(191, 66, 20)} ${point(224, 102)} ${point(193, 122)}Z`} fill="#d2bc91" />
    <path d={`M${point(191, 66, 20)} ${point(224, 102)} ${point(193, 122)}Z`} fill="#b9a078" />
    {[-210, -185, -160].map(x => <g key={x} transform={`translate(${project(x, 165, 10).join(' ')})`}><path d="m-12-4 22-11 14 8-22 11Z" fill="#bdc6c9" /><ellipse cy="2" rx="13" ry="12" fill="#dce1e0" /><ellipse cy="2" rx="8" ry="7" fill="#7b8e98" /></g>)}

    {/* Excavator: tracks, cab, pivoting boom, hydraulic rod and bucket. */}
    <g transform={`translate(${project(172, 147).join(' ')})`}>
      <ellipse cy="4" rx="49" ry="13" fill="#34495c" opacity=".15" />
      <path d="m-38-9 38-18 42 22L4 14Z" fill="#344c5b" /><path d="m-38-9 42 23v11l-42-23Zm42 23 38-19v11L4 25Z" fill="#263d4d" />
      <path d="m-30-1 34 18 30-16" stroke="#9aadb6" strokeWidth="3" strokeDasharray="4 4" />
      <path d="m-23-24 30-15 33 17L9-6Z" fill="#ffd178" /><path d="m-23-24 32 18v16l-32-18Z" fill="#e4a537" /><path d="m9-6 31-16v16L9 10Z" fill="#b87a27" />
      <path d="M-8-18v-26l20-10 19 10v26L12-8Z" fill="#efba58" stroke="#ffdf99" /><path d="M-4-22v-19l14-7v19Z" fill="#6b9aaf" /><path d="m15-28 12 6v-18l-12-7Z" fill="#365e76" />
      <g className="excavator-boom"><path d="m-13-20-22-53-12 5 24 53Z" fill="#efb446" stroke="#ffdd90" /><path d="m-38-69-45 24 4 11 44-24Z" fill="#d59631" stroke="#f6cd76" /><path d="m-81-44-9 24-19-9 10-23Z" fill="#566e7c" /><path d="m-17-24-23-42m-7 2-31 18" stroke="#e8edf0" strokeWidth="3" /><circle cx="-41" cy="-65" r="4" fill="#7e6947" /></g>
    </g>

    {/* Delivery truck has a dedicated front service lane. */}
    <g transform={`translate(${project(-72, 248).join(' ')})`}>
      <g className="site-truck-route">
        <ellipse cx="-3" cy="7" rx="57" ry="15" fill="#34495c" opacity=".18" />
        <path d="m-53-26 31-16 61 31L8 5Z" fill="#e9e6de" /><path d="m-53-26 61 31v15l-61-31Z" fill="#c4c8c4" /><path d="m8 5 31-16V4L8 20Z" fill="#98a9b0" />
        <path d="m-46-28 25-12 52 27-24 12Z" fill="#bdaa8b" /><path d="m-39-30 47 24m-35-29 47 24" stroke="#e9d4af" strokeWidth="4" />
        <path d="m8-7 23-12 27 14V18L35 31 8 17Z" fill="#d52f43" /><path d="m13-7 18-9 19 10-18 9Z" fill="#fa6d78" /><path d="m35 7 18-9v13l-18 9Z" fill="#9cc4d4" /><path d="m13-3 17 9v13l-17-9Z" fill="#4a7389" />
        {[-38, 9, 39].map((x, i) => <g key={x}><ellipse cx={x} cy={i === 0 ? -2 : i === 1 ? 21 : 22} rx="6" ry="9" fill="#253e4c" /><ellipse cx={x} cy={i === 0 ? -2 : i === 1 ? 21 : 22} rx="2.5" ry="4.5" fill="#9fb0ba" /></g>)}
        <path d="m51 15 5-3v4l-5 3Z" fill="#fff1bd" />
      </g>
    </g>
    <Worker x={-130} y={121} walking /><Worker x={150} y={190} walking delay="-5s" /><Worker x={-183} y={17} /><Worker x={69} y={152} />

    {/* Low perimeter barriers. */}
    {[-230, -159, -88, 105, 176, 247].map(x => <g key={x}><Block x={x} y={291} width={53} depth={5} height={25} top="#f5eded" front={x < 0 ? '#e3e8e8' : '#db3949'} side="#b5c0c5" />{[0, 1, 2].map(i => <path key={i} d={`M${point(x + i * 17, 297, 3)} ${point(x + i * 17 + 12, 297, 23)}`} stroke={x < 0 ? '#c83144' : '#fff3ee'} strokeWidth="6" />)}</g>)}
    <Tree x={-267} y={183} /><Tree x={293} y={215} />
    <g fontFamily="'JetBrains Mono', monospace" fontSize="10" fill="#7b8d9b" letterSpacing="2">
      <text x="77" y="224">01 / STRUCTURE</text><path d="M78 235h102l51 30" stroke="#bac8ce" fill="none" />
      <text x="819" y="290">02 / MATERIAL</text><path d="M818 302h95l-30 45" stroke="#bac8ce" fill="none" />
      <text x="550" y="644" textAnchor="middle" fill="#a53142">U T P   /   B U I L D I N G   T O M O R R O W</text>
    </g>
  </svg>;
}
