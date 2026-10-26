import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Files, FolderOpen, Pause, Play, ScanLine, Workflow } from 'lucide-react';
import { DocumentRecord } from '../types';
import { ConstructionScene } from './ConstructionScene';

interface ProjectHeroProps {
  documents: DocumentRecord[];
  projectName: string;
  onOpenMemory: () => void;
  onOpenUpload: () => void;
}

export function ProjectHero({ documents, projectName, onOpenMemory, onOpenUpload }: ProjectHeroProps) {
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(true);
  const hero = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (media.matches) setPaused(true); };
    media.addEventListener('change', reduce);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (hero.current) observer.observe(hero.current);
    return () => { media.removeEventListener('change', reduce); observer.disconnect(); };
  }, []);

  const stats = [
    { label: 'Dokumen tercatat', value: documents.length, icon: Files, detail: 'Satu tempat, setiap detail' },
    { label: 'Pekerjaan aktif', value: documents.filter(d => d.isActionable && d.kanbanStatus === 'AKTIF').length, icon: Workflow, detail: 'Langkah berikutnya dimulai di sini' },
    { label: 'Menunggu tindak lanjut', value: documents.filter(d => d.isActionable && d.kanbanStatus === 'MENUNGGU').length, icon: ScanLine, detail: 'Jaga progres tetap bergerak' },
    { label: 'Referensi proyek', value: documents.filter(d => !d.isActionable).length, icon: FolderOpen, detail: 'Pengetahuan yang terus terhubung' },
  ];

  return (
    <section ref={hero} className="project-intro" aria-label="Ringkasan ruang kerja proyek" data-paused={paused || !visible}>
      <div className="project-hero">
        <div className="hero-ambient" aria-hidden="true" />
        <div className="hero-copy">
          <div className="hero-eyebrow"><span /> BUILT FOR THE PEOPLE WHO BUILD.</div>
          <h1>Setiap progres.<br /><span>Satu kendali.</span></h1>
          <p className="hero-description">Dari lapangan ke ingatan. Satukan dokumen,<br className="hero-line-break" /> pantau pekerjaan, dan jaga setiap detail proyek.</p>
          <div className="hero-actions">
            <button className="command-button command-button-gold" onClick={() => document.getElementById('meja-kerja')?.scrollIntoView({ block: 'start' })}>
              Buka meja kerja <ArrowDown size={15} />
            </button>
            <button className="hero-secondary" onClick={onOpenMemory}>Jelajahi memori <ArrowUpRight size={16} /></button>
          </div>
          <div className="hero-context"><span className="context-line" />{projectName}<span className="hero-context-tag">RUANG KERJA</span></div>
        </div>
        <div className="hero-diorama">
          <div className="scene-topline"><span><i /> CONSTRUCTION IN MOTION</span><span>01 / UTP</span></div>
          <ConstructionScene />
          <div className="scene-bottomline"><span>DIORAMA ILUSTRATIF · BUKAN DATA LAPANGAN</span>
            <button className="motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? 'Putar animasi konstruksi' : 'Jeda animasi konstruksi'}>
              {paused ? <Play size={12} /> : <Pause size={12} />}{paused ? 'Putar animasi' : 'Jeda animasi'}
            </button>
          </div>
        </div>
      </div>
      <div className="project-stats" aria-label="Statistik metadata proyek">
        {stats.map(({ label, value, icon: Icon, detail }, index) => (
          <div className="project-stat" key={label}>
            <div className="stat-topline"><span className="stat-index">0{index + 1}</span><Icon size={16} strokeWidth={1.4} /></div>
            <div className="stat-main"><span className="stat-value">{String(value).padStart(2, '0')}</span><span>{label}</span></div>
            <p>{detail}</p>
          </div>
        ))}
      </div>
      <div className="workspace-note"><span><i /> MODE LOKAL · DATA CONTOH TERSEDIA</span><p>Metadata di browser ini. Berkas asli dan layanan cloud belum terhubung.</p><button onClick={onOpenUpload}>Catat dokumen <ArrowUpRight size={13} /></button></div>
    </section>
  );
}
