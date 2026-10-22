/* LPD resmi dan fondasi arus dana RPB/RPD.

   Desain sidecar:
   - workspaceLpd          : dokumen LPD (DRAFT/SENT/COMPLETE), tetap satu record saat koreksi.
   - workspaceLpdAudit     : event audit append-only (pelaku, waktu, nilai lama, nilai baru, ID sumber).
   - workspaceRpbTranches  : tranche M1-M2/M3-M4 per record RPB, status dan nominal pencairan.
   - workspaceRpdFinance   : periode, status keuangan, dan nominal pencairan per RPD.

   Header/riwayat RPB (RPB_HISTORY_HEADERS) dan record workspaceRpd tidak diubah.
   Data lama tetap terbaca; RPD legacy hanya dapat dipakai setelah didaftarkan eksplisit.
   Semua nilai turunan dihitung di server; klien hanya mengirim input. */

var LPD_PERIODS = ['M1-M2', 'M3-M4'];
var LPD_STATUSES = ['DRAFT', 'SENT', 'COMPLETE'];
var LPD_RPD_STATUSES = ['DIAJUKAN', 'DICAIRKAN', 'DITOLAK', 'DIBATALKAN', 'DITUTUP'];
var LPD_RPD_DISBURSED = ['DICAIRKAN', 'DITUTUP'];
var LPD_TRANCHE_STATUSES = ['BELUM_DICAIRKAN', 'DICAIRKAN'];
var LPD_STORE = {
  lpd: 'workspaceLpd',
  audit: 'workspaceLpdAudit',
  tranches: 'workspaceRpbTranches',
  rpdFinance: 'workspaceRpdFinance'
};

/* ---------- primitif ---------- */

function lpdNow_() { return new Date().toISOString(); }

function lpdTodayJakarta_() { return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'); }

function lpdDeadlineDefault_(month, period) {
  var parts = month.split('-'), year = Number(parts[0]), monthNumber = Number(parts[1]);
  var day = period === 'M1-M2' ? 15 : new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return month + '-' + String(day).padStart(2, '0');
}

function lpdDeadlineState_(record) {
  var deadline = record.deadline || {};
  var due = deadline.due || '';
  var original = deadline.original || due;
  if (!due && record.month && record.period) {
    due = lpdDeadlineDefault_(record.month, record.period);
    if (!original) original = due;
  }
  var basis = record.firstSentAt ? Utilities.formatDate(new Date(record.firstSentAt), 'Asia/Jakarta', 'yyyy-MM-dd') : (record.status === 'DRAFT' ? lpdTodayJakarta_() : '');
  return {
    due: due,
    original: original,
    late: !!due && !!basis && basis > due,
    basis: basis,
    changedAt: deadline.changedAt || '',
    changedBy: deadline.changedBy || '',
    history: Array.isArray(deadline.history) ? deadline.history : []
  };
}

function lpdDeadlineFromInput_(input, existing, month, period, actor) {
  var prior = existing && existing.deadline && typeof existing.deadline === 'object' ? existing.deadline : null;
  var fallback = lpdDeadlineDefault_(month, period);
  var rawDeadline = input && input.deadline != null ? input.deadline : '';
  if (rawDeadline && typeof rawDeadline === 'object') rawDeadline = rawDeadline.due || '';
  var requested = utpText_(rawDeadline, 'Deadline', 10, false);
  if (requested) requested = workspaceDate_(requested);
  var history = prior && Array.isArray(prior.history) ? prior.history.slice() : [];
  var original = prior ? (prior.original || prior.due || fallback) : (requested || fallback);
  var due = prior ? (prior.due || original) : original;
  if (!prior && requested) due = requested;
  if (prior && requested && requested !== due) {
    history.push({
      at: lpdNow_(),
      actor: actor,
      from: due,
      to: requested,
      reason: utpText_(input && input.deadlineReason, 'Alasan perubahan deadline', 500, false)
    });
    due = requested;
  }
  var last = history.length ? history[history.length - 1] : null;
  return {
    due: due,
    original: original,
    changedAt: last ? last.at : (prior && prior.changedAt || ''),
    changedBy: last ? last.actor : (prior && prior.changedBy || ''),
    history: history
  };
}

function lpdRound_(value) {
  if (typeof value !== 'number' || !isFinite(value)) throw new Error('Nilai keuangan tidak valid.');
  return Math.round(value * 100) / 100;
}

function lpdAmount_(value, label, optional) {
  if (value === '' || value === null || value === undefined) {
    if (optional) return 0;
    throw new Error(label + ' wajib diisi.');
  }
  if (typeof value === 'boolean' || typeof value === 'object') throw new Error(label + ' harus angka.');
  var number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!isFinite(number) || number < 0 || number > 1e15) throw new Error(label + ' harus angka 0 atau lebih.');
  return lpdRound_(number);
}

function lpdMonth_(value) {
  var text = utpText_(value, 'Bulan', 7, true);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) throw new Error('Bulan harus format YYYY-MM.');
  return text;
}

function lpdPeriod_(value) {
  var text = utpText_(value, 'Periode', 5, true);
  if (LPD_PERIODS.indexOf(text) < 0) throw new Error('Periode harus M1-M2 atau M3-M4.');
  return text;
}

function lpdProject_(value) {
  var id = workspaceProjectId_(utpText_(value, 'Proyek', 100, true), false);
  if (id === 'legacy') throw new Error('LPD resmi memerlukan proyek yang tersimpan, bukan data lama.');
  return id;
}

function lpdSourceId_(value, label) {
  if (typeof value !== 'string') throw new Error(label + ' tidak valid.');
  var text = utpText_(value, label, 100, true);
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(text)) throw new Error(label + ' tidak valid.');
  return text;
}

function lpdActor_(payload) {
  var value = payload && payload.actor != null ? payload.actor : 'Admin';
  if (typeof value !== 'string') throw new Error('Pelaku tidak valid.');
  return utpText_(value, 'Pelaku', 120, true);
}

function lpdAssertProject_(record, projectId, label) {
  var scope = lpdProject_(projectId);
  if (!record || (record.projectId || 'legacy') !== scope) {
    throw new Error((label || 'Record') + ' bukan milik proyek yang dipilih.');
  }
  return record;
}

function lpdTrancheId_(rpbId, period) { return String(rpbId) + '-' + String(period); }

/* ---------- audit append-only ---------- */

function lpdAudit_(event) {
  var payload = {
    id: Utilities.getUuid(),
    at: lpdNow_(),
    lpdId: utpText_(event.lpdId, 'ID LPD audit', 100, false),
    action: utpText_(event.action, 'Aksi audit', 80, true),
    sourceType: utpText_(event.sourceType, 'Jenis sumber', 40, false),
    sourceId: utpText_(event.sourceId, 'ID sumber', 100, false),
    actor: lpdActor_({ actor: event.actor }),
    oldValue: event.oldValue === undefined ? null : event.oldValue,
    newValue: event.newValue === undefined ? null : event.newValue,
    note: utpText_(event.note, 'Catatan audit', 1000, false)
  };
  try {
    return { record: utpWrite_(LPD_STORE.audit, payload, 0) };
  } catch (error) {
    if (error.recordSaved) return { record: utpGet_(LPD_STORE.audit, payload.id), warning: error.message };
    return { warning: 'Audit keuangan gagal dicatat: ' + error.message };
  }
}

/* ---------- penyimpanan ---------- */

function lpdRows_(key) { return utpRead_(LPD_STORE[key]); }
function lpdRow_(key, id) { return utpGet_(LPD_STORE[key], id); }

function lpdWrite_(key, record, version) {
  try {
    return { record: utpWrite_(LPD_STORE[key], record, version) };
  } catch (error) {
    if (!error.recordSaved) throw error;
    return { record: utpGet_(LPD_STORE[key], record.id), warning: error.message };
  }
}

function lpdCollectWarning_(warnings, result) {
  if (result && result.warning) warnings.push(result.warning);
  return warnings;
}

/* ---------- RPB dan tranche ---------- */

function lpdRpb_(rpbId) {
  var id = lpdSourceId_(rpbId, 'ID RPB');
  var record = getRpbHistory_().filter(function (row) { return row.id === id; })[0] || null;
  if (!record) throw new Error('RPB tidak ditemukan atau sudah dikeluarkan dari daftar aktif.');
  return record;
}

function lpdRpbMonth_(rpb) {
  var raw = String((rpb.data || {}).requestDate || rpb.requestDate || '').slice(0, 7);
  return lpdMonth_(raw);
}

function lpdRpbProject_(rpb) { return String((rpb.data || {}).projectId || 'legacy'); }

function lpdPlannedAmount_(rpb, period) {
  var total = ((rpb.data || {}).items || []).reduce(function (sum, item) {
    if (String(item.week || 'M1-M2') !== period) return sum;
    var value = item.total != null ? Number(item.total) : Number(item.quantity) * Number(item.unitPrice);
    return isFinite(value) ? sum + value : sum;
  }, 0);
  return lpdRound_(total);
}

function lpdEnsureTranche_(rpbId, period, actor) {
  var id = lpdTrancheId_(rpbId, period);
  var existing = lpdRow_('tranches', id);
  if (existing) return { record: existing, created: false };
  var rpb = lpdRpb_(rpbId);
  var record = {
    id: id,
    rpbId: rpb.id,
    projectId: lpdRpbProject_(rpb),
    month: lpdRpbMonth_(rpb),
    period: period,
    plannedAmount: lpdPlannedAmount_(rpb, period),
    amount: 0,
    status: 'BELUM_DICAIRKAN',
    disbursedAt: '',
    disbursedBy: '',
    note: ''
  };
  var saved = lpdWrite_('tranches', record, 0);
  var audit = lpdAudit_({
    lpdId: '',
    action: 'RPB_TRANCHE_REGISTERED',
    sourceType: 'RPB_TRANCHE',
    sourceId: id,
    actor: actor,
    oldValue: null,
    newValue: { rpbId: record.rpbId, projectId: record.projectId, month: record.month, period: record.period, plannedAmount: record.plannedAmount }
  });
  var warnings = lpdCollectWarning_([], saved);
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, created: true, warnings: warnings };
}

/* ---------- RPD finance ---------- */

function lpdLinkedLpd_(lpdId) { return lpdId ? lpdRow_('lpd', lpdId) : null; }

function lpdRpdSource_(rpdId) {
  var source = utpGet_('workspaceRpd', rpdId);
  if (!source || source.archived) throw new Error('RPD tidak ditemukan pada daftar aktif.');
  return source;
}

/* ---------- kalkulasi tunggal ---------- */

function lpdRealisasiTotal_(record) {
  var total = (record.realisasi || []).reduce(function (sum, line) {
    var value = Number(line && line.amount);
    return sum + (isFinite(value) ? value : 0);
  }, 0);
  return lpdRound_(total);
}

function lpdCalculate_(record) {
  var warnings = [], amountDrift = [];
  var rpb = null, tranche = null;
  if (record.rpbId) {
    try { rpb = lpdRpb_(record.rpbId); } catch (error) { warnings.push(error.message); }
    tranche = lpdRow_('tranches', lpdTrancheId_(record.rpbId, record.period));
    if (!tranche) warnings.push('Tranche RPB ' + record.period + ' belum terdaftar untuk ' + record.rpbId + '.');
  }
  var rpds = (record.rpdIds || []).map(function (id) {
    var source = utpGet_('workspaceRpd', id);
    var finance = lpdRow_('rpdFinance', id);
    if (!source) warnings.push('RPD ' + id + ' tidak ditemukan.');
    if (!finance) {
      warnings.push('RPD ' + id + ' belum terdaftar pada periode keuangan.');
      return null;
    }
    var sourceTotal = source ? lpdRound_(Number(source.total) || 0) : 0;
    var snapshot = finance.sourceTotal == null ? finance.amount : finance.sourceTotal;
    if (snapshot !== sourceTotal) amountDrift.push({ rpdId: id, recorded: snapshot, source: sourceTotal });
    return { id: id, purpose: source ? source.purpose || source.name || '' : '', sourceTotal: sourceTotal, finance: finance };
  }).filter(Boolean);

  var trancheCair = tranche && tranche.status === 'DICAIRKAN' ? lpdRound_(Number(tranche.amount) || 0) : 0;
  var rpdCair = 0, rpdPending = 0, rpdPendingAmount = 0;
  rpds.forEach(function (row) {
    if (LPD_RPD_DISBURSED.indexOf(row.finance.status) >= 0) {
      rpdCair += Number(row.finance.disbursedAmount != null ? row.finance.disbursedAmount : row.finance.amount) || 0;
    } else if (row.finance.status === 'DIAJUKAN') {
      rpdPending++;
      rpdPendingAmount += Number(row.finance.amount) || 0;
    }
  });
  rpdCair = lpdRound_(rpdCair);
  rpdPendingAmount = lpdRound_(rpdPendingAmount);
  var danaTersedia = lpdRound_(trancheCair + rpdCair);
  var realisasi = lpdRealisasiTotal_(record);
  var saldo = lpdRound_(danaTersedia - realisasi);

  var deficit = saldo < 0 ? lpdRound_(-saldo) : 0;
  var reimbursement = [];
  rpds.forEach(function (row) {
    if (deficit <= 0 || row.finance.status !== 'DIAJUKAN') return;
    var covered = lpdRound_(Math.min(lpdRound_(Number(row.finance.amount) || 0), deficit));
    if (covered <= 0) return;
    reimbursement.push({ rpdId: row.id, amount: covered, status: 'OPEN', source: 'RPD_BELUM_CAIR' });
    deficit = lpdRound_(deficit - covered);
  });
  var reimbursementTotal = lpdRound_(reimbursement.reduce(function (sum, item) { return sum + item.amount; }, 0));
  var companyObligationGross = lpdRound_(deficit);
  var grossReturn = saldo > 0 ? saldo : 0;
  var repayment = record.repayment || { status: 'BELUM', amount: 0 };
  var repaymentPaid = repayment.status === 'LUNAS' ? lpdRound_(Number(repayment.amount) || 0) : 0;
  var companyPayment = record.companyObligationPayment || null;
  var companyPaid = companyPayment && companyPayment.status === 'PAID' ? lpdRound_(Number(companyPayment.amount) || 0) : 0;
  var openReturn = lpdRound_(Math.max(0, lpdRound_(grossReturn - repaymentPaid)));
  var openCompany = lpdRound_(Math.max(0, lpdRound_(companyObligationGross - companyPaid)));
  var saldoAkhir = lpdRound_(saldo - repaymentPaid + companyPaid);
  var settlementStatus = saldoAkhir === 0 && openReturn === 0 && openCompany === 0
    ? 'SELESAI'
    : (openReturn > 0 || openCompany > 0 ? 'TERBUKA' : 'PERLU_REKONSILIASI');
  var deadline = lpdDeadlineState_(record);

  return {
    lpdId: record.id,
    status: record.status,
    projectId: record.projectId,
    month: record.month,
    period: record.period,
    rpb: rpb ? { id: rpb.id, number: rpb.number, status: rpb.status } : null,
    tranche: tranche ? {
      id: tranche.id,
      version: Number(tranche.version) || 0,
      status: tranche.status,
      plannedAmount: lpdRound_(Number(tranche.plannedAmount) || 0),
      amount: lpdRound_(Number(tranche.amount) || 0),
      disbursedAt: tranche.disbursedAt || ''
    } : null,
    rpds: rpds.map(function (row) {
      return {
        id: row.id,
        purpose: row.purpose,
        status: row.finance.status,
        amount: lpdRound_(Number(row.finance.amount) || 0),
        disbursed: LPD_RPD_DISBURSED.indexOf(row.finance.status) >= 0,
        lpdId: row.finance.lpdId || ''
      };
    }),
    totals: { realisasi: realisasi, danaTersedia: danaTersedia, saldo: saldo, trancheCair: trancheCair, rpdCair: rpdCair },
    rpdBelumCair: { count: rpdPending, amount: rpdPendingAmount },
    menungguPengembalian: {
      amount: openReturn,
      gross: grossReturn,
      paid: repaymentPaid,
      settled: openReturn === 0 && saldoAkhir === 0,
      status: openReturn > 0 ? 'BELUM' : (repaymentPaid > 0 ? 'LUNAS' : 'TIDAK_ADA')
    },
    reimbursement: {
      items: reimbursement,
      total: reimbursementTotal,
      companyObligation: companyObligationGross,
      companyObligationPaid: companyPaid,
      companyObligationOpen: openCompany
    },
    settlement: {
      saldoSebelumPenyelesaian: saldo,
      pengembalian: {
        id: repayment.id || '',
        status: repayment.status || 'BELUM',
        amount: lpdRound_(Number(repayment.amount) || 0),
        paid: repaymentPaid,
        at: repayment.at || '',
        actor: repayment.actor || '',
        note: repayment.note || ''
      },
      pembayaranKewajiban: {
        id: companyPayment ? companyPayment.id || '' : '',
        status: companyPayment ? companyPayment.status || '' : '',
        amount: companyPayment ? lpdRound_(Number(companyPayment.amount) || 0) : 0,
        paid: companyPaid,
        at: companyPayment ? companyPayment.at || '' : '',
        actor: companyPayment ? companyPayment.actor || '' : '',
        note: companyPayment ? companyPayment.note || '' : ''
      },
      pengembalianTerbuka: openReturn,
      kewajibanPerusahaanTerbuka: openCompany,
      totalTerbuka: lpdRound_(openReturn + openCompany),
      saldoAkhir: saldoAkhir,
      selisih: saldoAkhir,
      status: settlementStatus
    },
    deadline: deadline,
    amountDrift: amountDrift,
    warnings: warnings
  };
}

function lpdAssertNoDrift_(calculation) {
  if (!calculation.amountDrift.length) return;
  throw new Error(
    'Nominal RPD berubah dari catatan keuangan (' +
    calculation.amountDrift.map(function (row) { return row.rpdId + ': ' + row.recorded + ' -> ' + row.source; }).join(', ') +
    '). Sinkronkan nominal melalui tindakan rpdSetAmount sebelum mengirim atau menyelesaikan LPD.'
  );
}

/* ---------- reservasi RPD (satu RPD satu LPD) ---------- */

function lpdReserveRpds_(record, actor) {
  var reserved = [], warnings = [];
  try {
    (record.rpdIds || []).forEach(function (id) {
      var finance = lpdRow_('rpdFinance', id);
      if (!finance) throw new Error('RPD ' + id + ' belum terdaftar pada periode keuangan.');
      if (['DITOLAK', 'DIBATALKAN'].indexOf(finance.status) >= 0) return;
      if (finance.lpdId === record.id) return;
      if (finance.lpdId) throw new Error('RPD ' + id + ' sudah direferensikan LPD lain (' + finance.lpdId + ').');
      var updated = JSON.parse(JSON.stringify(finance));
      updated.lpdId = record.id;
      updated.reservedAt = lpdNow_();
      updated.reservedBy = 'LPD';
      var saved = lpdWrite_('rpdFinance', updated, finance.version);
      reserved.push(id);
      lpdCollectWarning_(warnings, saved);
      var audit = lpdAudit_({
        lpdId: record.id,
        action: 'RPD_RESERVED_BY_LPD',
        sourceType: 'RPD',
        sourceId: id,
        actor: actor,
        oldValue: { lpdId: finance.lpdId || '' },
        newValue: { lpdId: record.id }
      });
      lpdCollectWarning_(warnings, audit);
    });
  } catch (error) {
    error.reserved = reserved.slice();
    error.reservationWarnings = warnings.slice();
    throw error;
  }
  return { reserved: reserved, warnings: warnings };
}

function lpdReleaseRpds_(ids, lpdId, actor) {
  var warnings = [];
  (ids || []).forEach(function (id) {
    var finance = lpdRow_('rpdFinance', id);
    if (!finance || finance.lpdId !== lpdId) return;
    var updated = JSON.parse(JSON.stringify(finance));
    updated.lpdId = '';
    updated.reservedAt = '';
    updated.reservedBy = '';
    try {
      var saved = lpdWrite_('rpdFinance', updated, finance.version);
      lpdCollectWarning_(warnings, saved);
      var audit = lpdAudit_({
        lpdId: lpdId,
        action: 'RPD_RELEASED_FROM_LPD',
        sourceType: 'RPD',
        sourceId: id,
        actor: actor,
        oldValue: { lpdId: lpdId },
        newValue: { lpdId: '' }
      });
      lpdCollectWarning_(warnings, audit);
    } catch (error) {
      warnings.push('RPD ' + id + ' gagal dilepas: ' + error.message);
    }
  });
  return warnings;
}

/* ---------- validasi relasi ---------- */

function lpdAssertUnique_(record, existingId) {
  var duplicate = lpdRows_('lpd').filter(function (row) {
    return row.id !== existingId && row.projectId === record.projectId && row.month === record.month && row.period === record.period;
  })[0];
  if (duplicate) throw new Error('LPD untuk proyek, bulan, dan periode ini sudah ada (' + duplicate.id + ').');
}

function lpdValidateRelations_(record, actor, selfId) {
  var warnings = [], tranche = null;
  if (record.rpbId) {
    var rpb = lpdRpb_(record.rpbId);
    if (lpdRpbProject_(rpb) !== record.projectId) throw new Error('RPB yang dipilih bukan milik proyek LPD ini.');
    if (lpdRpbMonth_(rpb) !== record.month) throw new Error('RPB yang dipilih bukan untuk bulan ' + record.month + '.');
    var ensured = lpdEnsureTranche_(record.rpbId, record.period, actor);
    (ensured.warnings || []).forEach(function (warning) { warnings.push(warning); });
    tranche = ensured.record;
    if (tranche.projectId !== record.projectId || tranche.month !== record.month || tranche.period !== record.period) {
      throw new Error('Tranche RPB tidak sesuai proyek, bulan, atau periode LPD.');
    }
  }
  (record.rpdIds || []).forEach(function (id) {
    var source = lpdRpdSource_(id);
    if ((source.projectId || 'legacy') !== record.projectId) throw new Error('RPD ' + id + ' bukan milik proyek LPD ini.');
    var finance = lpdRow_('rpdFinance', id);
    if (!finance) throw new Error('RPD ' + (source.purpose || id) + ' belum didaftarkan pada periode keuangan. Daftarkan periode RPD terlebih dahulu.');
    if (finance.projectId !== record.projectId || finance.month !== record.month || finance.period !== record.period) {
      throw new Error('RPD ' + (source.purpose || id) + ' tidak berada pada bulan dan periode yang sama dengan LPD.');
    }
    if (LPD_RPD_STATUSES.indexOf(finance.status) < 0) throw new Error('Status keuangan RPD ' + id + ' tidak valid.');
    // DITOLAK/DIBATALKAN tetap boleh tercatat historis pada LPD; kalkulator mengabaikannya sebagai sumber dana.
    if (finance.lpdId && finance.lpdId !== (selfId || '')) {
      throw new Error('RPD ' + (source.purpose || id) + ' sudah direferensikan LPD lain (' + finance.lpdId + ').');
    }
  });
  return { record: record, tranche: tranche, warnings: warnings };
}

/* ---------- bentuk record LPD ---------- */

function lpdRealisasi_(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 120) throw new Error('Realisasi maksimal 120 baris.');
  var seen = Object.create(null);
  return value.map(function (line) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) throw new Error('Baris realisasi tidak valid.');
    var description = utpText_(line.description, 'Uraian nota', 300, true);
    var id = utpText_(line.id, 'ID nota', 100, false) || Utilities.getUuid();
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(id) || seen[id]) throw new Error('ID baris realisasi tidak valid atau duplikat.');
    seen[id] = true;
    var items = [];
    if (line.items != null) {
      if (!Array.isArray(line.items) || line.items.length > 100) throw new Error('Satu nota maksimal 100 sub-item.');
      items = line.items.map(function (item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Sub-item nota tidak valid.');
        var name = utpText_(item.name, 'Uraian sub-item', 300, true);
        var quantity = workspaceNumber_(item.quantity, true);
        var price = workspaceNumber_(item.price, false);
        return { name: name, quantity: quantity, price: price, subtotal: lpdRound_(quantity * price) };
      });
    }
    var attachments = [];
    if (line.attachments != null) {
      if (!Array.isArray(line.attachments) || line.attachments.length > 10) throw new Error('Satu nota maksimal 10 foto/dokumen.');
      attachments = line.attachments.map(function (file) {
        if (!file || typeof file !== 'object' || Array.isArray(file)) throw new Error('Lampiran nota tidak valid.');
        var url = utpText_(file.url, 'Tautan bukti nota', 1000, true);
        if (!/^https:\/\/(drive|docs)\.google\.com\//i.test(url)) throw new Error('Tautan bukti nota harus Google Drive.');
        return { name: utpText_(file.name, 'Nama bukti nota', 200, false), url: url, mime: utpText_(file.mime, 'Jenis bukti nota', 100, false) };
      });
    }
    var amount = items.length
      ? lpdRound_(items.reduce(function (sum, item) { return sum + item.subtotal; }, 0))
      : lpdAmount_(line.amount, 'Nominal realisasi');
    return {
      id: id,
      date: line.date ? workspaceDate_(line.date, true) : '',
      description: description,
      amount: amount,
      items: items,
      attachments: attachments
    };
  });
}

function lpdCleanRecord_(input, existing, actor) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('LPD tidak valid.');
  var projectId = lpdProject_(input.projectId || (existing && existing.projectId));
  var month = lpdMonth_(input.month || (existing && existing.month));
  var period = lpdPeriod_(input.period || (existing && existing.period));
  if (existing && (existing.projectId !== projectId || existing.month !== month || existing.period !== period)) {
    throw new Error('Proyek, bulan, dan periode LPD tidak boleh berubah setelah dibuat. Buat LPD baru untuk periode lain.');
  }
  var rpbId = utpText_(input.rpbId != null ? input.rpbId : existing && existing.rpbId, 'ID RPB', 100, false);
  if (rpbId) lpdSourceId_(rpbId, 'ID RPB');
  var rpdIds = input.rpdIds == null ? (existing && existing.rpdIds ? existing.rpdIds : []) : input.rpdIds;
  if (!Array.isArray(rpdIds) || rpdIds.length > 100) throw new Error('Pilih maksimal 100 RPD.');
  var seen = Object.create(null);
  rpdIds = rpdIds.map(function (id) {
    var value = lpdSourceId_(id, 'ID RPD');
    if (seen[value]) throw new Error('RPD yang sama dipilih lebih dari sekali.');
    seen[value] = true;
    return value;
  });
  var repayment = existing && existing.repayment ? existing.repayment : { status: 'BELUM', amount: 0, at: '', actor: '', note: '' };
  var deadline = lpdDeadlineFromInput_(input, existing, month, period, actor);
  return {
    projectId: projectId,
    month: month,
    period: period,
    rpbId: rpbId,
    rpdIds: rpdIds,
    deadline: deadline,
    realisasi: lpdRealisasi_(input.realisasi === undefined ? (existing && existing.realisasi) : input.realisasi),
    note: utpText_(input.note === undefined ? (existing && existing.note) : input.note, 'Catatan LPD', 2000, false),
    status: existing ? existing.status : 'DRAFT',
    sentAt: existing ? existing.sentAt || '' : '',
    firstSentAt: existing ? existing.firstSentAt || '' : '',
    positiveSaldoSeen: existing ? existing.positiveSaldoSeen === true : false,
    companyObligationPayment: existing && existing.companyObligationPayment ? existing.companyObligationPayment : null,
    completedAt: existing ? existing.completedAt || '' : '',
    correctedAt: existing ? existing.correctedAt || '' : '',
    correctionCount: existing ? Number(existing.correctionCount) || 0 : 0,
    correctionReason: existing ? existing.correctionReason || '' : '',
    repayment: {
      id: repayment.id || '',
      status: repayment.status === 'LUNAS' ? 'LUNAS' : 'BELUM',
      amount: lpdAmount_(repayment.amount, 'Nominal pengembalian', true),
      at: repayment.at || '',
      actor: repayment.actor || '',
      note: repayment.note || ''
    }
  };
}

function lpdReopenRpds_(lpdId, actor) {
  var record = lpdRow_('lpd', lpdId);
  var reopened = [], warnings = [];
  if (!record) return { reopened: reopened, warnings: warnings };
  (record.rpdIds || []).forEach(function (id) {
    var finance = lpdRow_('rpdFinance', id);
    if (!finance || finance.status !== 'DITUTUP' || finance.closedByLpdId !== lpdId) return;
    var updated = JSON.parse(JSON.stringify(finance));
    updated.status = 'DICAIRKAN';
    updated.closedAt = '';
    updated.closedBy = '';
    updated.closedByLpdId = '';
    try {
      var saved = lpdWrite_('rpdFinance', updated, finance.version);
      lpdCollectWarning_(warnings, saved);
      var audit = lpdAudit_({
        lpdId: lpdId,
        action: 'RPD_REOPENED',
        sourceType: 'RPD',
        sourceId: id,
        actor: actor,
        oldValue: { status: 'DITUTUP', closedByLpdId: lpdId },
        newValue: { status: 'DICAIRKAN' }
      });
      lpdCollectWarning_(warnings, audit);
      reopened.push(id);
    } catch (error) {
      warnings.push('RPD ' + id + ' gagal dibuka kembali: ' + error.message);
    }
  });
  return { reopened: reopened, warnings: warnings };
}

/* ---------- guard pencairan dan pengembalian ---------- */

function lpdAssertRpdDisbursable_(finance) {
  if (!finance) throw new Error('RPD belum didaftarkan pada periode keuangan.');
  if (finance.status === 'DICAIRKAN' || finance.status === 'DITUTUP') {
    throw new Error('RPD sudah dicairkan pada ' + (finance.disbursedAt || 'waktu yang tercatat') + '. Pembayaran kedua untuk RPD yang sama diblokir.');
  }
  if (finance.status !== 'DIAJUKAN') throw new Error('RPD berstatus ' + finance.status + ' dan tidak dapat dicairkan.');
}

function lpdAssertFullRepayment_(record, calculation, amount) {
  var expected = calculation.settlement.pengembalianTerbuka;
  if (expected <= 0) throw new Error('Tidak ada pengembalian yang masih terbuka pada LPD ini.');
  if (record.repayment && record.repayment.status === 'LUNAS') {
    throw new Error('Pengembalian LPD sudah tercatat; selisih ' + calculation.settlement.selisih + ' memerlukan rekonsiliasi, bukan pembayaran kedua.');
  }
  if (lpdRound_(amount) !== expected) {
    throw new Error('Pengembalian harus dibayar penuh sebesar ' + expected + '; cicilan tidak diperbolehkan.');
  }
}

function lpdOpenObligationLpds_(rpdId) {
  return lpdRows_('lpd').filter(function (row) {
    if (['SENT', 'COMPLETE'].indexOf(row.status) < 0) return false;
    if ((row.rpdIds || []).indexOf(rpdId) < 0) return false;
    var calculation = lpdCalculate_(row);
    return calculation.reimbursement.items.some(function (item) { return item.rpdId === rpdId && item.amount > 0; });
  }).map(function (row) { return row.id; });
}

function lpdLpdsReferencingRpd_(rpdId) {
  return lpdRows_('lpd').filter(function (row) {
    return (row.rpdIds || []).indexOf(rpdId) >= 0;
  });
}

function lpdLpdsReferencingTranche_(tranche) {
  return lpdRows_('lpd').filter(function (row) {
    return ['SENT', 'COMPLETE'].indexOf(row.status) >= 0 && row.rpbId === tranche.rpbId && row.period === tranche.period;
  });
}

function lpdMarkPositiveSaldo_(lpdId, actor) {
  var record = lpdRow_('lpd', lpdId);
  if (!record || ['SENT', 'COMPLETE'].indexOf(record.status) < 0 || record.positiveSaldoSeen === true) return null;
  var calculation = lpdCalculate_(record);
  if (calculation.totals.saldo <= 0) return null;
  record.positiveSaldoSeen = true;
  var saved;
  try { saved = lpdWrite_('lpd', record, record.version); }
  catch (error) { return { record: null, warnings: ['Gagal menandai saldo positif LPD ' + lpdId + ': ' + error.message] }; }
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    lpdId: lpdId,
    action: 'LPD_POSITIVE_SALDO_OBSERVED',
    sourceType: 'LPD',
    sourceId: lpdId,
    actor: actor,
    oldValue: { positiveSaldoSeen: false },
    newValue: { positiveSaldoSeen: true, saldo: calculation.totals.saldo }
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, warnings: warnings };
}

function lpdObligationSnapshot_(row) {
  var calculation = lpdCalculate_(row);
  return {
    lpdId: row.id,
    status: row.status,
    companyObligationGross: calculation.reimbursement.companyObligation,
    companyObligationPaid: calculation.reimbursement.companyObligationPaid,
    companyObligationOpen: calculation.reimbursement.companyObligationOpen,
    pengembalianTerbuka: calculation.settlement.pengembalianTerbuka,
    saldoAkhir: calculation.settlement.saldoAkhir,
    reimbursementTotal: calculation.reimbursement.total,
    pendingRpdIds: calculation.reimbursement.items.map(function (item) { return item.rpdId; })
  };
}

function lpdClosingBalance_(record, calculation) {
  return calculation.settlement.saldoAkhir;
}

function lpdAssertM3Gate_(rpbId, period) {
  if (period !== 'M3-M4') return;
  var rpb = lpdRpb_(rpbId);
  var projectId = lpdRpbProject_(rpb);
  var month = lpdRpbMonth_(rpb);
  var prior = lpdRows_('lpd').filter(function (row) {
    return row.projectId === projectId &&
      row.month === month &&
      row.rpbId === rpbId &&
      row.period === 'M1-M2' &&
      String(row.firstSentAt || '') !== '';
  })[0];
  if (!prior) {
    throw new Error('Pencairan tranche M3-M4 memerlukan LPD M1-M2 untuk proyek, bulan, dan RPB yang sama yang sudah pernah dikirim (firstSentAt terisi).');
  }
}

/* ---------- tindakan LPD ---------- */

function lpdSaveDraft_(p) {
  var actor = lpdActor_(p);
  var projectId = lpdProject_(p.projectId);
  var input = p.record || {};
  var existingId = utpText_(input.id, 'ID LPD', 100, false);
  var existing = existingId ? lpdRow_('lpd', existingId) : null;
  if (existingId && !existing) throw new Error('LPD tidak ditemukan.');
  if (input.projectId && lpdProject_(input.projectId) !== projectId) throw new Error('Proyek LPD tidak sesuai proyek yang dipilih.');
  if (existing) lpdAssertProject_(existing, projectId, 'LPD');
  input = Object.assign({}, input, { projectId: projectId });
  if (existing && existing.status !== 'DRAFT') throw new Error('LPD yang sudah dikirim harus dikoreksi sebelum diubah.');
  if (existing && existing.version !== Number(input.version)) return { conflict: true, record: existing };
  var warnings = [];
  if (existing) {
    var reopen = lpdReopenRpds_(existing.id, actor);
    reopen.warnings.forEach(function (warning) { warnings.push(warning); });
  }
  var record = lpdCleanRecord_(input, existing, actor);
  lpdAssertUnique_(record, existing ? existing.id : '');
  var relations = lpdValidateRelations_(record, actor, existing ? existing.id : '');
  warnings = warnings.concat(relations.warnings);
  record = relations.record;
  record.id = existing ? existing.id : Utilities.getUuid();
  var saved = lpdWrite_('lpd', record, existing ? existing.version : 0);
  lpdCollectWarning_(warnings, saved);

  var reservation = { reserved: [], warnings: [] };
  try { reservation = lpdReserveRpds_(saved.record, actor); }
  catch (error) {
    var released = lpdReleaseRpds_(error.reserved || [], saved.record.id, actor);
    warnings = warnings.concat(error.reservationWarnings || [], released);
    warnings.push('Draf LPD tersimpan, tetapi RPD gagal dikunci: ' + error.message + ' Simpan ulang draf yang sama sebelum mengirim.');
    return { record: saved.record, calculation: null, reservationPending: true, warnings: warnings };
  }
  warnings = warnings.concat(reservation.warnings || []);
  if (existing) warnings = warnings.concat(lpdReleaseRpds_((existing.rpdIds || []).filter(function (id) { return saved.record.rpdIds.indexOf(id) < 0; }), saved.record.id, actor));

  var calculation = lpdCalculate_(saved.record);
  var audit = lpdAudit_({
    lpdId: saved.record.id,
    action: existing ? 'LPD_DRAFT_SAVED' : 'LPD_CREATED',
    sourceType: 'LPD',
    sourceId: saved.record.id,
    actor: actor,
    oldValue: existing ? { status: existing.status, rpbId: existing.rpbId, rpdIds: existing.rpdIds, realisasi: lpdRealisasiTotal_(existing) } : null,
    newValue: {
      status: saved.record.status,
      rpbId: saved.record.rpbId,
      rpdIds: saved.record.rpdIds,
      realisasi: calculation.totals.realisasi,
      danaTersedia: calculation.totals.danaTersedia,
      saldo: calculation.totals.saldo
    }
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, calculation: calculation, warnings: warnings };
}

function lpdSend_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var record = lpdRow_('lpd', lpdSourceId_(p.id, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  if (record.status !== 'DRAFT') throw new Error('Hanya LPD DRAFT yang dapat dikirim.');
  if (record.version !== Number(p.version)) return { conflict: true, record: record };
  if (!record.rpbId) throw new Error('Pilih satu RPB sebelum mengirim LPD.');
  var warnings = [];
  var reopen = lpdReopenRpds_(record.id, actor);
  reopen.warnings.forEach(function (warning) { warnings.push(warning); });
  var relations = lpdValidateRelations_(record, actor, record.id);
  warnings = warnings.concat(relations.warnings);
  record = relations.record;
  var calculation = lpdCalculate_(record);
  lpdAssertNoDrift_(calculation);

  var reservation = { reserved: [], warnings: [] };
  try { reservation = lpdReserveRpds_(record, actor); }
  catch (error) {
    var released = lpdReleaseRpds_(error.reserved || [], record.id, actor);
    throw new Error('RPD gagal dikunci sebelum pengiriman: ' + error.message + (released.length ? ' ' + released.join(' ') : ''));
  }
  warnings = warnings.concat(reservation.warnings || []);
  var isResend = !!record.firstSentAt;
  var previous = {
    status: record.status,
    rpbId: record.rpbId,
    rpdIds: record.rpdIds,
    sentAt: record.sentAt || '',
    firstSentAt: record.firstSentAt || ''
  };
  record.status = 'SENT';
  record.sentAt = lpdNow_();
  record.completedAt = '';
  if (!record.firstSentAt) record.firstSentAt = record.sentAt;
  if (calculation.totals.saldo > 0) record.positiveSaldoSeen = true;
  record.correctionReason = '';
  var saved = lpdWrite_('lpd', record, record.version);
  lpdCollectWarning_(warnings, saved);
  calculation = lpdCalculate_(saved.record);
  var audit = lpdAudit_({
    lpdId: saved.record.id,
    action: isResend ? 'LPD_RESENT' : 'LPD_SENT',
    sourceType: 'LPD',
    sourceId: saved.record.id,
    actor: actor,
    oldValue: previous,
    newValue: {
      status: saved.record.status,
      resend: isResend,
      rpbId: saved.record.rpbId,
      rpdIds: saved.record.rpdIds,
      sentAt: saved.record.sentAt,
      firstSentAt: saved.record.firstSentAt,
      positiveSaldoSeen: saved.record.positiveSaldoSeen === true,
      trancheAmount: calculation.tranche ? calculation.tranche.amount : 0,
      danaTersedia: calculation.totals.danaTersedia,
      realisasi: calculation.totals.realisasi,
      saldo: calculation.totals.saldo
    },
    note: p.note
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, calculation: calculation, warnings: warnings };
}

function lpdCloseRpd_(rpdId, lpdId, actor) {
  var finance = lpdRow_('rpdFinance', rpdId);
  if (!finance || finance.status !== 'DICAIRKAN') return null;
  var updated = JSON.parse(JSON.stringify(finance));
  updated.status = 'DITUTUP';
  updated.closedAt = lpdNow_();
  updated.closedBy = actor;
  updated.closedByLpdId = lpdId;
  var saved = lpdWrite_('rpdFinance', updated, finance.version);
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    lpdId: lpdId,
    action: 'RPD_CLOSED',
    sourceType: 'RPD',
    sourceId: rpdId,
    actor: actor,
    oldValue: { status: 'DICAIRKAN' },
    newValue: { status: 'DITUTUP', closedByLpdId: lpdId }
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, warnings: warnings };
}

function lpdComplete_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var record = lpdRow_('lpd', lpdSourceId_(p.id, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  if (record.status !== 'SENT') throw new Error('Hanya LPD SENT yang dapat diselesaikan.');
  if (record.version !== Number(p.version)) return { conflict: true, record: record };
  var calculation = lpdCalculate_(record);
  lpdAssertNoDrift_(calculation);
  if (calculation.warnings.length) throw new Error('LPD belum dapat diselesaikan: ' + calculation.warnings.join(' '));
  var pendingRpd = calculation.rpds.filter(function (row) { return row.status === 'DIAJUKAN'; });
  if (pendingRpd.length) {
    throw new Error('LPD belum dapat diselesaikan: masih ada RPD DIAJUKAN (' + pendingRpd.map(function (row) { return row.id; }).join(', ') + ').');
  }
  if (calculation.reimbursement.items.length || calculation.reimbursement.total > 0) {
    throw new Error('LPD belum dapat diselesaikan: masih ada reimbursement RPD yang menunggu pencairan.');
  }
  var settlement = calculation.settlement;
  if (settlement.pengembalianTerbuka > 0) {
    throw new Error('LPD belum dapat diselesaikan: pengembalian masih terbuka sebesar ' + settlement.pengembalianTerbuka + '.');
  }
  if (settlement.kewajibanPerusahaanTerbuka > 0) {
    throw new Error('LPD belum dapat diselesaikan: kewajiban perusahaan masih terbuka sebesar ' + settlement.kewajibanPerusahaanTerbuka + '.');
  }
  if (settlement.saldoAkhir !== 0) {
    throw new Error('LPD belum dapat diselesaikan: selisih ' + settlement.selisih + ' memerlukan rekonsiliasi (saldo sebelum penyelesaian ' + settlement.saldoSebelumPenyelesaian + ', pengembalian ' + settlement.pengembalian.paid + ', pembayaran kewajiban ' + settlement.pembayaranKewajiban.paid + ').');
  }
  var previous = {
    status: record.status,
    firstSentAt: record.firstSentAt || '',
    danaTersedia: calculation.totals.danaTersedia,
    realisasi: calculation.totals.realisasi,
    saldo: calculation.totals.saldo,
    settlement: settlement,
    deadline: calculation.deadline,
    positiveSaldoSeen: record.positiveSaldoSeen === true
  };
  var warnings = [];
  var closed = [];
  var saved;
  try {
    // Tutup RPD lebih dahulu; bila satu penutupan gagal, jangan pernah menyimpan LPD COMPLETE
    // dengan sebagian RPD masih terbuka. RPD yang sudah ditutup dikembalikan ke DICAIRKAN.
    (record.rpdIds || []).forEach(function (id) {
      var finance = lpdRow_('rpdFinance', id);
      if (!finance || finance.status !== 'DICAIRKAN') return;
      var result = lpdCloseRpd_(id, record.id, actor);
      if (!result) return;
      closed.push(id);
      result.warnings.forEach(function (warning) { warnings.push(warning); });
    });
    record.status = 'COMPLETE';
    record.completedAt = lpdNow_();
    record.correctionReason = '';
    saved = lpdWrite_('lpd', record, record.version);
    lpdCollectWarning_(warnings, saved);
  } catch (error) {
    if (closed.length) {
      var reopened = lpdReopenRpds_(record.id, actor);
      warnings = warnings.concat(reopened.warnings || []);
    }
    throw error;
  }
  calculation = lpdCalculate_(saved.record);
  var audit = lpdAudit_({
    lpdId: saved.record.id,
    action: 'LPD_COMPLETED',
    sourceType: 'LPD',
    sourceId: saved.record.id,
    actor: actor,
    oldValue: previous,
    newValue: {
      status: saved.record.status,
      closedRpdIds: closed,
      firstSentAt: saved.record.firstSentAt || '',
      danaTersedia: calculation.totals.danaTersedia,
      realisasi: calculation.totals.realisasi,
      saldo: calculation.totals.saldo,
      settlement: calculation.settlement,
      deadline: calculation.deadline,
      positiveSaldoSeen: saved.record.positiveSaldoSeen === true
    },
    note: p.note
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, calculation: calculation, closedRpdIds: closed, warnings: warnings };
}

function lpdCorrect_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var reason = utpText_(p.reason, 'Alasan koreksi', 1000, true);
  var record = lpdRow_('lpd', lpdSourceId_(p.id, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  if (['SENT', 'COMPLETE'].indexOf(record.status) < 0) throw new Error('Hanya LPD SENT atau COMPLETE yang dapat dikoreksi.');
  if (record.version !== Number(p.version)) return { conflict: true, record: record };
  var calculation = lpdCalculate_(record);
  var previous = {
    status: record.status,
    sentAt: record.sentAt || '',
    firstSentAt: record.firstSentAt || '',
    completedAt: record.completedAt || '',
    danaTersedia: calculation.totals.danaTersedia,
    saldo: calculation.totals.saldo,
    settlement: calculation.settlement,
    deadline: calculation.deadline,
    positiveSaldoSeen: record.positiveSaldoSeen === true,
    repayment: record.repayment || null,
    companyObligationPayment: record.companyObligationPayment || null
  };
  var warnings = [];
  record.status = 'DRAFT';
  record.completedAt = '';
  record.correctedAt = lpdNow_();
  record.correctionCount = (Number(record.correctionCount) || 0) + 1;
  record.correctionReason = reason;
  var saved = lpdWrite_('lpd', record, record.version);
  lpdCollectWarning_(warnings, saved);
  var reopened = lpdReopenRpds_(record.id, actor);
  reopened.warnings.forEach(function (warning) { warnings.push(warning); });
  var audit = lpdAudit_({
    lpdId: saved.record.id,
    action: 'LPD_CORRECTED',
    sourceType: 'LPD',
    sourceId: saved.record.id,
    actor: actor,
    oldValue: previous,
    newValue: {
      status: 'DRAFT',
      firstSentAt: saved.record.firstSentAt || '',
      settlement: calculation.settlement,
      deadline: calculation.deadline,
      positiveSaldoSeen: saved.record.positiveSaldoSeen === true,
      repayment: saved.record.repayment || null,
      companyObligationPayment: saved.record.companyObligationPayment || null,
      reopenedRpdIds: reopened.reopened,
      correctionCount: saved.record.correctionCount
    },
    note: reason
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, reopenedRpdIds: reopened.reopened, warnings: warnings };
}

function lpdRecordRepayment_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var record = lpdRow_('lpd', lpdSourceId_(p.id, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  if (record.status !== 'SENT') throw new Error('Pengembalian dicatat pada LPD berstatus SENT.');
  if (record.version !== Number(p.version)) return { conflict: true, record: record };
  var calculation = lpdCalculate_(record);
  lpdAssertNoDrift_(calculation);
  var amount = lpdAmount_(p.amount, 'Nominal pengembalian');
  lpdAssertFullRepayment_(record, calculation, amount);
  var previous = record.repayment ? { id: record.repayment.id || '', status: record.repayment.status, amount: record.repayment.amount, at: record.repayment.at || '' } : null;
  record.repayment = { id: Utilities.getUuid(), status: 'LUNAS', amount: amount, at: lpdNow_(), actor: actor, note: utpText_(p.note, 'Catatan pengembalian', 500, false) };
  record.positiveSaldoSeen = true;
  var saved = lpdWrite_('lpd', record, record.version);
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    lpdId: saved.record.id,
    action: 'LPD_REPAYMENT_RECORDED',
    sourceType: 'LPD',
    sourceId: saved.record.id,
    actor: actor,
    oldValue: previous,
    newValue: { id: record.repayment.id, status: 'LUNAS', amount: amount, saldoSebelumPenyelesaian: calculation.totals.saldo, pengembalianTerbuka: calculation.settlement.pengembalianTerbuka, positiveSaldoSeen: true }
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, calculation: lpdCalculate_(saved.record), warnings: warnings };
}

function lpdPayCompanyObligation_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var record = lpdRow_('lpd', lpdSourceId_(p.id, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  if (record.status !== 'SENT') throw new Error('Pembayaran kewajiban perusahaan dicatat pada LPD berstatus SENT.');
  if (record.version !== Number(p.version)) return { conflict: true, record: record };
  var calculation = lpdCalculate_(record);
  lpdAssertNoDrift_(calculation);
  if (calculation.warnings.length) throw new Error('Kewajiban perusahaan belum dapat dibayar: ' + calculation.warnings.join(' '));
  var obligation = calculation.settlement.kewajibanPerusahaanTerbuka;
  if (record.companyObligationPayment) {
    if (obligation > 0) throw new Error('Pembayaran kewajiban perusahaan sudah tercatat; selisih terbuka ' + obligation + ' memerlukan rekonsiliasi, bukan pembayaran kedua.');
    throw new Error('Kewajiban perusahaan LPD ini sudah dibayar; pembayaran kedua diblokir.');
  }
  if (obligation <= 0) throw new Error('Tidak ada kewajiban perusahaan yang terbuka; RPD yang belum cair harus dicairkan melalui ID RPD yang sama.');
  var amount = lpdAmount_(p.amount, 'Nominal pembayaran kewajiban perusahaan');
  if (amount <= 0) throw new Error('Nominal pembayaran kewajiban perusahaan harus lebih besar dari 0.');
  if (amount !== obligation) {
    throw new Error('Pembayaran kewajiban perusahaan harus penuh sebesar ' + obligation + '; RPD yang belum cair tidak boleh dibayar melalui jalur ini dan cicilan tidak diperbolehkan.');
  }
  var payment = {
    id: Utilities.getUuid(),
    status: 'PAID',
    amount: amount,
    at: lpdNow_(),
    actor: actor,
    note: utpText_(p.note, 'Catatan pembayaran kewajiban perusahaan', 500, false)
  };
  record.companyObligationPayment = payment;
  var saved = lpdWrite_('lpd', record, record.version);
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    lpdId: saved.record.id,
    action: 'LPD_COMPANY_OBLIGATION_PAID',
    sourceType: 'LPD',
    sourceId: saved.record.id,
    actor: actor,
    oldValue: null,
    newValue: {
      transactionId: payment.id,
      amount: amount,
      companyObligationGross: calculation.reimbursement.companyObligation,
      companyObligationOpenBefore: obligation,
      companyObligationOpenAfter: 0,
      excludedRpdIds: calculation.reimbursement.items.map(function (item) { return item.rpdId; })
    },
    note: p.note
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, transactionId: payment.id, calculation: lpdCalculate_(saved.record), warnings: warnings };
}

/* ---------- tindakan RPD finance ---------- */

function lpdRpdEnroll_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var rpdId = lpdSourceId_(p.rpdId, 'ID RPD');
  var source = lpdRpdSource_(rpdId);
  var projectId = lpdProject_(p.projectId);
  if ((source.projectId || 'legacy') !== projectId) throw new Error('RPD bukan milik proyek yang dipilih.');
  var month = lpdMonth_(p.month || String(source.date || '').slice(0, 7));
  var period = lpdPeriod_(p.period);
  var amount = lpdAmount_(source.total, 'Total RPD');
  if (amount <= 0) throw new Error('RPD tanpa total tidak dapat didaftarkan sebagai sumber dana.');
  var existing = lpdRow_('rpdFinance', rpdId);
  if (existing && existing.projectId !== projectId) throw new Error('RPD sudah terdaftar pada proyek lain dan tidak dapat dipindahkan dari sini.');
  if (existing) {
    var samePeriod = existing.projectId === projectId && existing.month === month && existing.period === period;
    var linked = lpdLinkedLpd_(existing.lpdId);
    if (samePeriod && (!existing.lpdId || linked)) return { record: existing, warnings: [] };
    if (existing.status !== 'DIAJUKAN') {
      throw new Error('Status keuangan RPD sudah ' + existing.status + '; periode dan nominal tidak dapat diubah.');
    }
    if (existing.lpdId && linked) {
      throw new Error('RPD sudah direferensikan LPD ' + existing.lpdId + '; koreksi LPD tersebut terlebih dahulu.');
    }
    var previous = { projectId: existing.projectId, month: existing.month, period: existing.period, amount: existing.amount, lpdId: existing.lpdId || '' };
    if (!linked) {
      existing.lpdId = '';
      existing.reservedAt = '';
      existing.reservedBy = '';
    }
    if (!samePeriod) {
      existing.projectId = projectId;
      existing.month = month;
      existing.period = period;
      existing.amount = amount;
      existing.sourceTotal = amount;
    }
    var updated = lpdWrite_('rpdFinance', existing, existing.version);
    var warnings = lpdCollectWarning_([], updated);
    var updateAudit = lpdAudit_({
      action: samePeriod ? 'RPD_LINK_CLEARED' : 'RPD_PERIOD_CHANGED',
      sourceType: 'RPD',
      sourceId: rpdId,
      actor: actor,
      oldValue: previous,
      newValue: { projectId: existing.projectId, month: existing.month, period: existing.period, amount: existing.amount, lpdId: existing.lpdId || '' },
      note: p.note
    });
    lpdCollectWarning_(warnings, updateAudit);
    return { record: updated.record, warnings: warnings };
  }
  var record = {
    id: rpdId,
    rpdId: rpdId,
    projectId: projectId,
    month: month,
    period: period,
    status: 'DIAJUKAN',
    amount: amount,
    sourceTotal: amount,
    disbursedAmount: 0,
    disbursedAt: '',
    disbursedBy: '',
    lpdId: '',
    note: utpText_(p.note, 'Catatan RPD', 500, false)
  };
  var saved = lpdWrite_('rpdFinance', record, 0);
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    action: 'RPD_ENROLLED',
    sourceType: 'RPD',
    sourceId: rpdId,
    actor: actor,
    oldValue: null,
    newValue: { projectId: projectId, month: month, period: period, amount: amount, status: 'DIAJUKAN' }
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, warnings: warnings };
}

function lpdRpdSetAmount_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var rpdId = lpdSourceId_(p.rpdId, 'ID RPD');
  var finance = lpdRow_('rpdFinance', rpdId);
  if (!finance) throw new Error('RPD belum didaftarkan pada periode keuangan.');
  lpdAssertProject_(finance, p.projectId, 'RPD');
  if (finance.status !== 'DIAJUKAN') throw new Error('Nominal RPD hanya dapat diubah sebelum pencairan.');
  if (finance.version !== Number(p.version)) return { conflict: true, record: finance };
  var linked = lpdLinkedLpd_(finance.lpdId);
  if (linked && ['SENT', 'COMPLETE'].indexOf(linked.status) >= 0) throw new Error('Nominal RPD yang sudah dipakai LPD terkirim tidak dapat diubah.');
  var amount = lpdAmount_(p.amount, 'Nominal RPD');
  if (amount <= 0) throw new Error('Nominal RPD harus lebih besar dari 0.');
  var sourceTotal = lpdRound_(Number(lpdRpdSource_(rpdId).total) || 0);
  var previous = { amount: finance.amount, sourceTotal: finance.sourceTotal == null ? finance.amount : finance.sourceTotal };
  finance.amount = amount;
  finance.sourceTotal = sourceTotal;
  finance.note = utpText_(p.note, 'Catatan nominal RPD', 500, false) || finance.note || '';
  var saved = lpdWrite_('rpdFinance', finance, finance.version);
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    lpdId: finance.lpdId || '',
    action: 'RPD_AMOUNT_CHANGED',
    sourceType: 'RPD',
    sourceId: rpdId,
    actor: actor,
    oldValue: previous,
    newValue: { amount: amount, sourceTotal: sourceTotal },
    note: p.note
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, warnings: warnings };
}

function lpdRpdDisburse_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var rpdId = lpdSourceId_(p.rpdId, 'ID RPD');
  var finance = lpdRow_('rpdFinance', rpdId);
  if (!finance) throw new Error('RPD belum didaftarkan pada periode keuangan.');
  lpdAssertProject_(finance, p.projectId, 'RPD');
  lpdAssertRpdDisbursable_(finance);
  if (finance.version !== Number(p.version)) return { conflict: true, record: finance };
  var amount = p.amount == null || p.amount === '' ? finance.amount : lpdAmount_(p.amount, 'Nominal pencairan RPD');
  if (amount <= 0) throw new Error('Nominal pencairan RPD harus lebih besar dari 0.');
  if (amount !== finance.amount) throw new Error('Pencairan RPD harus penuh sebesar ' + finance.amount + '; nominal berbeda atau cicilan belum didukung.');
  var affected = lpdOpenObligationLpds_(rpdId);
  var previous = { status: finance.status, amount: finance.amount, disbursedAmount: finance.disbursedAmount || 0 };
  finance.status = 'DICAIRKAN';
  finance.disbursedAmount = amount;
  finance.disbursedAt = lpdNow_();
  finance.disbursedBy = actor;
  finance.note = utpText_(p.note, 'Catatan pencairan RPD', 500, false) || finance.note || '';
  var saved = lpdWrite_('rpdFinance', finance, finance.version);
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    lpdId: finance.lpdId || '',
    action: 'RPD_DISBURSED',
    sourceType: 'RPD',
    sourceId: rpdId,
    actor: actor,
    oldValue: previous,
    newValue: { status: 'DICAIRKAN', amount: amount, disbursedAmount: amount, affectedLpdIds: affected }
  });
  lpdCollectWarning_(warnings, audit);
  affected.forEach(function (lpdId) {
    var closure = lpdAudit_({
      lpdId: lpdId,
      action: 'REIMBURSEMENT_CLOSED_BY_RPD_DISBURSEMENT',
      sourceType: 'RPD',
      sourceId: rpdId,
      actor: actor,
      oldValue: { obligationOpen: true },
      newValue: { obligationOpen: false, disbursedAmount: amount }
    });
    lpdCollectWarning_(warnings, closure);
  });
  var positive = [];
  lpdLpdsReferencingRpd_(rpdId).filter(function (row) {
    return ['SENT', 'COMPLETE'].indexOf(row.status) >= 0;
  }).forEach(function (row) {
    var marked = lpdMarkPositiveSaldo_(row.id, actor);
    if (!marked) return;
    marked.warnings.forEach(function (warning) { warnings.push(warning); });
    if (marked.record) positive.push(row.id);
  });
  return { record: saved.record, affectedLpdIds: affected, positiveSaldoLpdIds: positive, warnings: warnings };
}

function lpdRpdSetStatus_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var reason = utpText_(p.reason, 'Alasan perubahan status RPD', 1000, true);
  var target = utpText_(p.status, 'Status RPD', 20, true).toUpperCase();
  if (['DITOLAK', 'DIBATALKAN'].indexOf(target) < 0) throw new Error('Status RPD hanya dapat diubah ke DITOLAK atau DIBATALKAN melalui tindakan ini.');
  var rpdId = lpdSourceId_(p.rpdId, 'ID RPD');
  var finance = lpdRow_('rpdFinance', rpdId);
  if (!finance) throw new Error('RPD belum didaftarkan pada periode keuangan.');
  lpdAssertProject_(finance, p.projectId, 'RPD');
  if (finance.status !== 'DIAJUKAN') throw new Error('Hanya RPD berstatus DIAJUKAN yang dapat ditolak atau dibatalkan.');
  if (finance.version !== Number(p.version)) return { conflict: true, record: finance };
  var referencing = lpdLpdsReferencingRpd_(rpdId);
  var before = referencing.map(lpdObligationSnapshot_);
  var previous = { status: finance.status, lpdId: finance.lpdId || '' };
  finance.status = target;
  finance.closedAt = lpdNow_();
  finance.closedBy = actor;
  var saved = lpdWrite_('rpdFinance', finance, finance.version);
  var warnings = lpdCollectWarning_([], saved);
  var after = referencing.map(lpdObligationSnapshot_);
  var affectedLpdIds = referencing.map(function (row) { return row.id; });
  var audit = lpdAudit_({
    lpdId: finance.lpdId || '',
    action: 'RPD_STATUS_CHANGED',
    sourceType: 'RPD',
    sourceId: rpdId,
    actor: actor,
    oldValue: previous,
    newValue: { status: target, lpdId: finance.lpdId || '', affectedLpdIds: affectedLpdIds, obligations: after },
    note: reason
  });
  lpdCollectWarning_(warnings, audit);
  referencing.forEach(function (row, index) {
    var obligationAudit = lpdAudit_({
      lpdId: row.id,
      action: 'LPD_RPD_OBLIGATION_UPDATED',
      sourceType: 'RPD',
      sourceId: rpdId,
      actor: actor,
      oldValue: before[index],
      newValue: after[index],
      note: reason
    });
    lpdCollectWarning_(warnings, obligationAudit);
  });
  return { record: saved.record, affectedLpdIds: affectedLpdIds, warnings: warnings };
}

/* ---------- tindakan tranche RPB ---------- */

function lpdRpbTrancheSave_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var rpbId = lpdSourceId_(p.rpbId, 'ID RPB');
  var period = lpdPeriod_(p.period);
  var rpb = lpdRpb_(rpbId);
  lpdAssertProject_({ projectId: lpdRpbProject_(rpb) }, p.projectId, 'RPB');
  var ensured = lpdEnsureTranche_(rpbId, period, actor);
  var tranche = ensured.record;
  if (tranche.status !== 'BELUM_DICAIRKAN') throw new Error('Tranche RPB sudah dicairkan; nominal perencanaan tidak dapat diubah.');
  var month = p.month ? lpdMonth_(p.month) : tranche.month;
  if (month !== tranche.month) throw new Error('Bulan tranche harus sama dengan bulan pengajuan RPB (' + tranche.month + ').');
  var plannedAmount = p.plannedAmount == null || p.plannedAmount === '' ? tranche.plannedAmount : lpdAmount_(p.plannedAmount, 'Nominal perencanaan tranche');
  var note = p.note == null ? tranche.note || '' : utpText_(p.note, 'Catatan tranche', 500, false);
  if (plannedAmount === tranche.plannedAmount && note === (tranche.note || '')) {
    return { record: tranche, warnings: ensured.warnings || [] };
  }
  var previous = { plannedAmount: tranche.plannedAmount, note: tranche.note || '' };
  tranche.plannedAmount = plannedAmount;
  tranche.note = note;
  var saved = lpdWrite_('tranches', tranche, tranche.version);
  var warnings = (ensured.warnings || []).slice();
  lpdCollectWarning_(warnings, saved);
  var audit = lpdAudit_({
    action: 'RPB_TRANCHE_PLANNED',
    sourceType: 'RPB_TRANCHE',
    sourceId: tranche.id,
    actor: actor,
    oldValue: previous,
    newValue: { plannedAmount: plannedAmount, note: note }
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, warnings: warnings };
}

function lpdRpbTrancheDisburse_(p) {
  requireDeletePin_(p.pin);
  var actor = lpdActor_(p);
  var rpbId = lpdSourceId_(p.rpbId, 'ID RPB');
  var period = lpdPeriod_(p.period);
  var rpb = lpdRpb_(rpbId);
  lpdAssertProject_({ projectId: lpdRpbProject_(rpb) }, p.projectId, 'RPB');
  lpdAssertM3Gate_(rpbId, period);
  var ensured = lpdEnsureTranche_(rpbId, period, actor);
  var tranche = ensured.record;
  var replace = p.replace === true;
  if (tranche.status === 'DICAIRKAN' && !replace) {
    throw new Error('Tranche RPB ' + period + ' sudah dicairkan pada ' + (tranche.disbursedAt || 'waktu yang tercatat') + '. Pencairan kedua diblokir; gunakan replace hanya untuk koreksi nominal.');
  }
  if (!ensured.created && p.version != null && tranche.version !== Number(p.version)) return { conflict: true, record: tranche };
  var amount = lpdAmount_(p.amount, 'Nominal pencairan tranche');
  if (amount <= 0) throw new Error('Nominal pencairan tranche harus lebih besar dari 0.');
  var previous = { status: tranche.status, amount: tranche.amount, disbursedAt: tranche.disbursedAt || '' };
  tranche.status = 'DICAIRKAN';
  tranche.amount = amount;
  tranche.disbursedAt = lpdNow_();
  tranche.disbursedBy = actor;
  tranche.note = utpText_(p.note, 'Catatan pencairan tranche', 500, false) || tranche.note || '';
  var saved = lpdWrite_('tranches', tranche, tranche.version);
  var warnings = (ensured.warnings || []).slice();
  lpdCollectWarning_(warnings, saved);
  var audit = lpdAudit_({
    action: replace ? 'RPB_TRANCHE_CORRECTED' : 'RPB_TRANCHE_DISBURSED',
    sourceType: 'RPB_TRANCHE',
    sourceId: tranche.id,
    actor: actor,
    oldValue: previous,
    newValue: { status: 'DICAIRKAN', amount: amount, disbursedAt: tranche.disbursedAt }
  });
  lpdCollectWarning_(warnings, audit);
  var positive = [];
  lpdLpdsReferencingTranche_(tranche).forEach(function (row) {
    var marked = lpdMarkPositiveSaldo_(row.id, actor);
    if (!marked) return;
    marked.warnings.forEach(function (warning) { warnings.push(warning); });
    if (marked.record) positive.push(row.id);
  });
  return { record: saved.record, replaced: replace, positiveSaldoLpdIds: positive, warnings: warnings };
}

function lpdSetDeadline_(p) {
  var actor = lpdActor_(p);
  var record = lpdRow_('lpd', lpdSourceId_(p.id, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  if (record.version !== Number(p.version)) return { conflict: true, record: record };
  var deadline = lpdDeadlineFromInput_(p, record, record.month, record.period, actor);
  if (deadline.due === (record.deadline && record.deadline.due)) {
    return { record: record, calculation: lpdCalculate_(record), warnings: [] };
  }
  var previous = record.deadline || null;
  record.deadline = deadline;
  var saved = lpdWrite_('lpd', record, record.version);
  var warnings = lpdCollectWarning_([], saved);
  var audit = lpdAudit_({
    lpdId: saved.record.id,
    action: 'LPD_DEADLINE_CHANGED',
    sourceType: 'LPD',
    sourceId: saved.record.id,
    actor: actor,
    oldValue: previous,
    newValue: deadline,
    note: p.reason
  });
  lpdCollectWarning_(warnings, audit);
  return { record: saved.record, calculation: lpdCalculate_(saved.record), warnings: warnings };
}

function lpdUpload_(p) {
  var projectId = lpdProject_(p.projectId);
  var lpdId = utpText_(p.lpdId, 'ID LPD', 100, false);
  if (lpdId) lpdAssertProject_(lpdRow_('lpd', lpdId), projectId, 'LPD');
  var uploaded = utpUpload_({
    name: p.name,
    mime: p.mime,
    base64: p.base64,
    kind: 'LPD_NOTA',
    recordId: lpdId || projectId
  });
  DriveApp.getFileById(uploaded.id).moveTo(workspaceProjectFolder_(projectId, 'LPD'));
  return uploaded;
}

/* ---------- pembacaan ---------- */

function lpdRelatedAudit_(record) {
  var ids = [record.id];
  if (record.rpbId) {
    ids.push(record.rpbId);
    ids.push(lpdTrancheId_(record.rpbId, record.period));
  }
  (record.rpdIds || []).forEach(function (id) { ids.push(id); });
  return lpdRows_('audit').filter(function (event) {
    return ids.indexOf(event.lpdId) >= 0 || ids.indexOf(event.sourceId) >= 0;
  }).sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
}

function lpdList_(p) {
  var scope = workspaceProjectId_(p.projectId, true);
  var month = p.month ? lpdMonth_(p.month) : '';
  var period = p.period ? lpdPeriod_(p.period) : '';
  var records = lpdRows_('lpd').filter(function (row) {
    return workspaceProjectMatches_(row, scope) && (!month || row.month === month) && (!period || row.period === period);
  }).sort(function (a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  }).map(function (row) {
    return Object.assign({}, row, { calculation: lpdCalculate_(row) });
  });
  return { projectId: scope, records: records };
}

function lpdDetail_(p) {
  var record = lpdRow_('lpd', lpdSourceId_(p.id, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  return { record: record, calculation: lpdCalculate_(record), audit: lpdRelatedAudit_(record) };
}

function lpdSummary_(p) {
  var scope = workspaceProjectId_(p.projectId, true);
  var byStatus = {}, lateCount = 0;
  LPD_STATUSES.forEach(function (status) {
    byStatus[status] = { count: 0, danaTersedia: 0, realisasi: 0, saldo: 0, saldoAkhir: 0, totalTerbuka: 0, menungguPengembalian: 0, kewajibanPerusahaan: 0, rpdBelumCair: 0, selisihRekonsiliasi: 0, terlambat: 0 };
  });
  lpdRows_('lpd').filter(function (row) {
    return workspaceProjectMatches_(row, scope);
  }).forEach(function (record) {
    var calculation = lpdCalculate_(record);
    var bucket = byStatus[record.status] || byStatus.DRAFT;
    bucket.count++;
    bucket.danaTersedia = lpdRound_(bucket.danaTersedia + calculation.totals.danaTersedia);
    bucket.realisasi = lpdRound_(bucket.realisasi + calculation.totals.realisasi);
    bucket.saldo = lpdRound_(bucket.saldo + calculation.totals.saldo);
    bucket.saldoAkhir = lpdRound_(bucket.saldoAkhir + calculation.settlement.saldoAkhir);
    bucket.totalTerbuka = lpdRound_(bucket.totalTerbuka + calculation.settlement.totalTerbuka);
    bucket.menungguPengembalian = lpdRound_(bucket.menungguPengembalian + calculation.settlement.pengembalianTerbuka);
    bucket.kewajibanPerusahaan = lpdRound_(bucket.kewajibanPerusahaan + calculation.settlement.kewajibanPerusahaanTerbuka);
    bucket.rpdBelumCair = lpdRound_(bucket.rpdBelumCair + calculation.rpdBelumCair.amount);
    bucket.selisihRekonsiliasi = lpdRound_(bucket.selisihRekonsiliasi + calculation.settlement.selisih);
    if (calculation.deadline.late) { bucket.terlambat++; lateCount++; }
  });
  var finances = lpdRows_('rpdFinance').filter(function (row) { return workspaceProjectMatches_(row, scope); });
  var tranches = lpdRows_('tranches').filter(function (row) { return workspaceProjectMatches_(row, scope); });
  function financeCount(status) { return finances.filter(function (row) { return row.status === status; }).length; }
  return {
    projectId: scope,
    count: Object.keys(byStatus).reduce(function (sum, key) { return sum + byStatus[key].count; }, 0),
    lateCount: lateCount,
    byStatus: byStatus,
    rpdFinance: {
      registered: finances.length,
      pending: financeCount('DIAJUKAN'),
      disbursed: financeCount('DICAIRKAN'),
      rejected: financeCount('DITOLAK'),
      cancelled: financeCount('DIBATALKAN'),
      closed: financeCount('DITUTUP')
    },
    rpbTranches: {
      registered: tranches.length,
      disbursed: tranches.filter(function (row) { return row.status === 'DICAIRKAN'; }).length,
      plannedAmount: lpdRound_(tranches.reduce(function (sum, row) { return sum + (Number(row.plannedAmount) || 0); }, 0)),
      disbursedAmount: lpdRound_(tranches.reduce(function (sum, row) { return sum + (row.status === 'DICAIRKAN' ? Number(row.amount) || 0 : 0); }, 0))
    }
  };
}

function lpdRpdFinanceList_(p) {
  var scope = workspaceProjectId_(p.projectId, true);
  var month = p.month ? lpdMonth_(p.month) : '';
  var period = p.period ? lpdPeriod_(p.period) : '';
  var selfLpd = utpText_(p.lpdId, 'ID LPD', 100, false);
  var records = utpRead_('workspaceRpd').filter(function (row) {
    return workspaceProjectMatches_(row, scope);
  }).map(function (source) {
    var finance = lpdRow_('rpdFinance', source.id);
    var eligible = !!finance && !!month && !!period &&
      finance.month === month && finance.period === period &&
      (finance.status === 'DIAJUKAN' || LPD_RPD_DISBURSED.indexOf(finance.status) >= 0) &&
      (!finance.lpdId || finance.lpdId === selfLpd);
    return {
      id: source.id,
      projectId: source.projectId || 'legacy',
      purpose: source.purpose || source.name || '',
      date: source.date || '',
      total: lpdRound_(Number(source.total) || 0),
      status: source.status || '',
      enrolled: !!finance,
      eligible: eligible,
      finance: finance ? {
        version: Number(finance.version) || 0,
        month: finance.month,
        period: finance.period,
        status: finance.status,
        amount: lpdRound_(Number(finance.amount) || 0),
        sourceTotal: finance.sourceTotal == null ? lpdRound_(Number(source.total) || 0) : lpdRound_(Number(finance.sourceTotal) || 0),
        disbursedAmount: lpdRound_(Number(finance.disbursedAmount) || 0),
        disbursedAt: finance.disbursedAt || '',
        lpdId: finance.lpdId || ''
      } : null
    };
  }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  return { projectId: scope, records: records };
}

function lpdRpbList_(p) {
  var scope = workspaceProjectId_(p.projectId, true);
  var month = p.month ? lpdMonth_(p.month) : '';
  var period = p.period ? lpdPeriod_(p.period) : 'M1-M2';
  var records = getRpbHistory_().filter(function (rpb) {
    if (!workspaceProjectMatches_(rpb.data || {}, scope)) return false;
    try { return !month || lpdRpbMonth_(rpb) === month; } catch (error) { return false; }
  }).map(function (rpb) {
    var tranche = lpdRow_('tranches', lpdTrancheId_(rpb.id, period));
    return {
      id: rpb.id,
      number: rpb.number,
      status: rpb.status,
      projectId: lpdRpbProject_(rpb),
      month: lpdRpbMonth_(rpb),
      requestDate: rpb.requestDate,
      period: period,
      plannedAmount: lpdPlannedAmount_(rpb, period),
      tranche: tranche || null
    };
  }).sort(function (a, b) { return String(b.requestDate || '').localeCompare(String(a.requestDate || '')); });
  return { projectId: scope, records: records };
}

function lpdRpbTrancheList_(p) {
  var scope = workspaceProjectId_(p.projectId, true);
  var rpbId = utpText_(p.rpbId, 'ID RPB', 100, false);
  var month = p.month ? lpdMonth_(p.month) : '';
  var period = p.period ? lpdPeriod_(p.period) : '';
  var records = lpdRows_('tranches').filter(function (row) {
    return workspaceProjectMatches_(row, scope) && (!rpbId || row.rpbId === rpbId) && (!month || row.month === month) && (!period || row.period === period);
  }).map(function (row) {
    var rpb = null;
    try { rpb = lpdRpb_(row.rpbId); } catch (error) { rpb = null; }
    return Object.assign({}, row, {
      rpbNumber: rpb ? rpb.number : '',
      rpbStatus: rpb ? rpb.status : '',
      plannedNow: rpb ? lpdPlannedAmount_(rpb, row.period) : null
    });
  });
  return { projectId: scope, records: records };
}

function lpdAuditList_(p) {
  var record = lpdRow_('lpd', lpdSourceId_(p.lpdId, 'ID LPD'));
  if (!record) throw new Error('LPD tidak ditemukan.');
  lpdAssertProject_(record, p.projectId, 'LPD');
  return { events: lpdRelatedAudit_(record) };
}

/* ---------- RPC ---------- */

function apiLpd(action, payload, token) {
  requireAuthorized_(token);
  var p = payload || {};
  if (action === 'list') return lpdList_(p);
  if (action === 'detail') return lpdDetail_(p);
  if (action === 'calculate') return lpdDetail_(p).calculation;
  if (action === 'summary') return lpdSummary_(p);
  if (action === 'audit') return lpdAuditList_(p);
  if (action === 'rpdFinanceList') return lpdRpdFinanceList_(p);
  if (action === 'rpbTrancheList') return lpdRpbTrancheList_(p);
  if (action === 'rpbList') return lpdRpbList_(p);
  if (action === 'upload') return lpdUpload_(p);
  var mutations = ['saveDraft', 'send', 'complete', 'correct', 'recordRepayment', 'payCompanyObligation', 'setDeadline',
    'rpdEnroll', 'rpdSetAmount', 'rpdDisburse', 'rpdSetStatus',
    'rpbTrancheSave', 'rpbTrancheDisburse'];
  if (mutations.indexOf(action) < 0) throw new Error('Tindakan LPD belum didukung: ' + action);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (action === 'saveDraft') return lpdSaveDraft_(p);
    if (action === 'send') return lpdSend_(p);
    if (action === 'complete') return lpdComplete_(p);
    if (action === 'correct') return lpdCorrect_(p);
    if (action === 'recordRepayment') return lpdRecordRepayment_(p);
    if (action === 'payCompanyObligation') return lpdPayCompanyObligation_(p);
    if (action === 'setDeadline') return lpdSetDeadline_(p);
    if (action === 'rpdEnroll') return lpdRpdEnroll_(p);
    if (action === 'rpdSetAmount') return lpdRpdSetAmount_(p);
    if (action === 'rpdDisburse') return lpdRpdDisburse_(p);
    if (action === 'rpdSetStatus') return lpdRpdSetStatus_(p);
    if (action === 'rpbTrancheSave') return lpdRpbTrancheSave_(p);
    if (action === 'rpbTrancheDisburse') return lpdRpbTrancheDisburse_(p);
    throw new Error('Tindakan LPD belum didukung: ' + action);
  } finally {
    lock.releaseLock();
  }
}
