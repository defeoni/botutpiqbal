import { useRef, useState } from 'react';
import { storageService } from '../services/storageService';

function downloadBackup() {
  const url = URL.createObjectURL(new Blob([storageService.exportBackup()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `utp-memory-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataTransfer({ onRestored }: { onRestored: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  return <aside className="migration-notice" aria-label="Status migrasi Cloudflare">
    <div><strong>Project Memory · pilot Cloudflare</strong>
      <p>Data contoh dan metadata tersimpan di browser ini. Berkas asli, Google Drive, serta data Apps Script belum terhubung.</p>
    </div>
    <div className="migration-actions">
      <button type="button" onClick={downloadBackup} disabled={busy}>Ekspor metadata</button>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}>Impor cadangan</button>
      <a href="https://script.google.com/macros/s/AKfycbx3kZ7z49hBHtZPud98NLd3VFqUvdLWYtp9il7pcr6NLBQieAQkMSFuY9xJyfPwCHZr/exec" target="_blank" rel="noopener noreferrer">Aplikasi lama ↗</a>
    </div>
    <input ref={input} type="file" accept="application/json,.json" hidden onChange={async e => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setBusy(true);
      setError(false);
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error('Cadangan maksimal 10 MB.');
        const value: unknown = JSON.parse(await file.text());
        if (!window.confirm('Impor mengganti metadata dengan ID yang sama dan mempertahankan dokumen lain. Cadangan kondisi saat ini akan diunduh dahulu. Lanjutkan?')) return;
        downloadBackup();
        const count = storageService.importBackup(value);
        onRestored();
        setMessage(`${count} dokumen dipulihkan. Berkas asli tidak termasuk cadangan metadata.`);
      } catch (err) {
        setError(true);
        setMessage(err instanceof Error ? err.message : 'Impor gagal.');
      } finally { setBusy(false); }
    }} />
    {message && <p role={error ? 'alert' : 'status'} className="migration-result">{message}</p>}
  </aside>;
}
