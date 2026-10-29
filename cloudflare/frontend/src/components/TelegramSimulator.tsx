import React, { useState } from 'react';
import { DocumentRecord, ProjectInfo } from '../types';
import { 
  Send, 
  Bot, 
  Smartphone, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface TelegramSimulatorProps {
  projects: ProjectInfo[];
  documents: DocumentRecord[];
  onOpenDocument: (doc: DocumentRecord) => void;
}

interface ChatMessage {
  id: string;
  sender: 'BOT' | 'USER';
  text: string;
  timestamp: string;
  buttons?: { label: string; action: () => void }[];
  fileAttachment?: { name: string; type: 'IMAGE' | 'DOC' };
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  projects,
  documents,
  onOpenDocument,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'BOT',
      text: 'Halo Admin Proyek PT UTP! 🏗️\nBot UTP Project Memory siap menerima berkas dan memberikan ringkasan tindak lanjut.',
      timestamp: '10:00',
      buttons: [
        { label: '📊 Status Semua Proyek', action: () => handleShowAllProjects() },
        { label: '⏰ Cek Dokumen Mendekati Tenggat', action: () => handleShowDeadlines() },
        { label: '📸 Simulasi Kirim Foto Nota', action: () => handleSimulateSendNota() },
        { label: '📄 Simulasi Kirim File Memo', action: () => handleSimulateSendMemo() },
      ]
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const addBotMessage = (text: string, buttons?: ChatMessage['buttons']) => {
    setMessages(prev => [
      ...prev,
      {
        id: `bot-${Date.now()}`,
        sender: 'BOT',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        buttons
      }
    ]);
  };

  const addUserMessage = (text: string, fileAttachment?: ChatMessage['fileAttachment']) => {
    setMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'USER',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fileAttachment
      }
    ]);
  };

  const handleShowAllProjects = () => {
    addUserMessage('Lihat Semua Proyek');
    const summary = projects.map(p => {
      const pDocs = documents.filter(d => d.projectId === p.id && !d.isArchived);
      const pending = pDocs.filter(d => d.kanbanStatus === 'MENUNGGU').length;
      return `• *${p.code}* - ${p.name}\n  (Total: ${pDocs.length} berkas, ${pending} menunggu tindak lanjut)`;
    }).join('\n\n');

    setTimeout(() => {
      addBotMessage(
        `Ringkasan Proyek PT UTP:\n\n${summary}\n\nPilih proyek untuk persempit:`,
        projects.map(p => ({
          label: `${p.code}`,
          action: () => handleSelectProject(p)
        }))
      );
    }, 300);
  };

  const handleSelectProject = (project: ProjectInfo) => {
    addUserMessage(`Pilih proyek ${project.code}`);
    const pDocs = documents.filter(d => d.projectId === project.id && !d.isArchived);
    const waiting = pDocs.filter(d => d.kanbanStatus === 'MENUNGGU');

    setTimeout(() => {
      addBotMessage(
        `📌 *Proyek: ${project.name}*\nPM: ${project.pmName}\nMK: ${project.mkName}\n\n` +
        `Anda memiliki *${waiting.length} dokumen* yang sedang menunggu persetujuan / balasan.`,
        waiting.slice(0, 3).map(doc => ({
          label: `Buka: ${doc.title.slice(0, 24)}...`,
          action: () => onOpenDocument(doc)
        }))
      );
    }, 300);
  };

  const handleShowDeadlines = () => {
    addUserMessage('Cek dokumen mendekati tenggat');
    const urgentDocs = documents.filter(d => d.deadline && d.kanbanStatus !== 'SELESAI' && !d.isArchived);

    setTimeout(() => {
      const list = urgentDocs.map(d => 
        `⏳ *${d.deadline}* | ${d.projectId}\n${d.title}\nMenunggu: ${d.waitingPersonName || d.waitingParty}`
      ).join('\n\n');

      addBotMessage(
        `🚨 *Tenggat Waktu Pekerjaan Minggu Ini:*\n\n${list}\n\n_Semua berkas aman di Project Memory._`,
        [
          { label: 'Kembali ke Menu Utama', action: () => handleResetMenu() }
        ]
      );
    }, 300);
  };

  const handleSimulateSendNota = () => {
    addUserMessage('Kirim foto nota material lapangan', { name: 'Foto_Nota_Semen_Holcim_Cikarang.jpg', type: 'IMAGE' });
    setTimeout(() => {
      addBotMessage(
        `Foto nota berhasil diterima! 📸\n\nSesuai aturan PT UTP, silakan tentukan tujuan berkas ini (bukan tebakan sistem):`,
        [
          { 
            label: '💰 Masukkan ke Nota/Keuangan (RPD)', 
            action: () => handleConfirmNotaDestination('Nota/Keuangan (RPD)') 
          },
          { 
            label: '📂 Simpan ke Arsip Foto Lapangan', 
            action: () => handleConfirmNotaDestination('Arsip Foto Lapangan') 
          }
        ]
      );
    }, 400);
  };

  const handleConfirmNotaDestination = (destination: string) => {
    addUserMessage(`Pilih: ${destination}`);
    setTimeout(() => {
      addBotMessage(
        `✅ Berkas telah tersimpan ke *${destination}* di Proyek Cikarang (PRJ-CKR).\n` +
        `Berkas asli tersimpan aman di Google Drive dan memori proyek terbarui.`
      );
    }, 300);
  };

  const handleSimulateSendMemo = () => {
    addUserMessage('Kirim draft memo', { name: 'Memo_Penambahan_Manpower_No042.docx', type: 'DOC' });
    setTimeout(() => {
      addBotMessage(
        `Dokumen Memo Penambahan Manpower terdeteksi! 📄\n` +
        `• Proyek: PRJ-BDG (Apartemen Bandung)\n` +
        `• Posisi: 4 Personel Teknisi ME & Spv Sipil\n` +
        `• Status: Usulan (Menunggu paraf PM Ir. Bambang)\n\n` +
        `Kartu kerja telah dibuat di kolom *Menunggu*.`,
        [
          { label: 'Lihat Detail di Web', action: () => {
            const doc = documents.find(d => d.category === 'MEMO_MANPOWER');
            if (doc) onOpenDocument(doc);
          }}
        ]
      );
    }, 400);
  };

  const handleResetMenu = () => {
    addBotMessage(
      'Pilih menu bot UTP:',
      [
        { label: '📊 Status Semua Proyek', action: () => handleShowAllProjects() },
        { label: '⏰ Cek Dokumen Mendekati Tenggat', action: () => handleShowDeadlines() },
        { label: '📸 Kirim Foto Nota', action: () => handleSimulateSendNota() },
        { label: '📄 Kirim File Memo', action: () => handleSimulateSendMemo() },
      ]
    );
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const txt = inputText;
    setInputText('');
    addUserMessage(txt);
    setTimeout(() => {
      handleResetMenu();
    }, 400);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Overview Info */}
      <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>Simulator Integrasi Bot Telegram (@UTPProjectBot)</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Interaksi berbasis tombol: menerima berkas, memilih tujuan nota, dan memantau tenggat tanpa form manual.
          </p>
        </div>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
          WEBHOOK AKTIF
        </span>
      </div>

      {/* Telegram Chat Frame */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-[520px]">
        {/* Chat Header */}
        <div className="bg-slate-900/90 p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
              UTP
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>UTP Project Memory Bot</span>
                <span className="text-[10px] text-slate-400 font-normal">@utp_project_bot</span>
              </div>
              <p className="text-[10px] text-emerald-400 font-medium">bot siap melayani</p>
            </div>
          </div>

          <button
            onClick={() => setMessages(messages.slice(0, 1))}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            Bersihkan Chat
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-slate-950/60">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 space-y-1.5 shadow-xs ${
                  msg.sender === 'USER'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none'
                }`}
              >
                {/* File Attachment Pill */}
                {msg.fileAttachment && (
                  <div className="p-2 bg-blue-700/60 rounded flex items-center gap-2 text-xs mb-1 border border-blue-400/30">
                    {msg.fileAttachment.type === 'IMAGE' ? (
                      <ImageIcon className="w-4 h-4 text-amber-300 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-amber-300 shrink-0" />
                    )}
                    <span className="truncate font-mono text-[11px]">{msg.fileAttachment.name}</span>
                  </div>
                )}

                <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.text}</p>
                <div
                  className={`text-[9px] text-right font-mono ${
                    msg.sender === 'USER' ? 'text-blue-200' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {/* Inline Keyboard Buttons */}
              {msg.buttons && msg.buttons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
                  {msg.buttons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={btn.action}
                      className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 rounded transition-colors text-left font-medium"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendText} className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ketik perintah atau pesan apa pun untuk membuka menu..."
            className="flex-1 bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500/80"
          />
          <button
            type="submit"
            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
