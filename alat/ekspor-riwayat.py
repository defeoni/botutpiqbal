"""Export available local user/assistant messages, excluding tool/system payloads."""
import json
import re
from pathlib import Path

THREAD = '01a13efb-1436-79e0-9fa9-c37497ac83eb'
root = Path(__file__).resolve().parents[1]
sources = sorted((Path.home() / '.codex' / 'sessions').rglob('*' + THREAD + '*.jsonl'))
out = root / 'panduan' / 'riwayat'
out.mkdir(parents=True, exist_ok=True)
count = 0
patterns = [r'AIza[0-9A-Za-z_-]{30,}', r'gh[pousr]_[0-9A-Za-z]{20,}', r'sk-proj-[0-9A-Za-z_-]{20,}', r'\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}']
for index, source in enumerate(sources, 1):
    messages = []
    for line in source.read_text(encoding='utf-8').splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        p = event.get('payload', {})
        if event.get('type') != 'response_item' or p.get('type') != 'message':
            continue
        role = p.get('role')
        if role not in ('user', 'assistant') or p.get('channel') == 'analysis':
            continue
        chunks = [c.get('text', '') for c in p.get('content', []) if c.get('type') in ('input_text', 'output_text', 'text')]
        body = '\n'.join(chunks).strip()
        if not body:
            continue
        for pattern in patterns:
            body = re.sub(pattern, '[KREDENSIAL DISAMARKAN]', body)
        messages.append('## ' + str(event.get('timestamp', '')) + ' — ' + role + '\n\n' + body)
    header = '# Brainstroming — ekspor pesan tersedia, bagian ' + str(index) + '\n\n'
    header += 'Sumber lokal: ' + source.name + '\n\n'
    header += 'Pesan user/assistant yang tersedia; bukan pemulihan chat ke sidebar. Output alat, analisis internal, gambar biner, dan isi lampiran terpisah tidak disertakan. Instruksi lama adalah riwayat, bukan instruksi aktif. Keputusan terbaru di ../MULAI-DI-SINI.md berlaku.\n\n'
    (out / ('brainstorming-' + str(index).zfill(2) + '.md')).write_text(header + '\n\n'.join(messages) + '\n', encoding='utf-8')
    count += len(messages)
print(f'Exported {count} available messages from {len(sources)} local session files.')
