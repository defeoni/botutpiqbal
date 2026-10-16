// Focused real-browser regression checks for the standalone prototype.
// Usage: node alat/periksa-prototipe-material.cjs <playwright module directory> <browser executable>
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.argv[3] ? {executablePath:process.argv[3]} : {})});
  const page = await browser.newPage({viewport:{width:1440, height:900}});
  const errors = [];
  let prompts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(prompts.shift() ?? '');
    else if (dialog.type() === 'confirm') await dialog.accept();
    else await dialog.dismiss();
  });
  const url = pathToFileURL(path.resolve(__dirname, '../pratinjau/prototipe-material.html')).href;
  let passed = 0;
  async function check(name, work) {
    prompts = [];
    await page.goto(url);
    await page.waitForFunction(() => typeof itemReadiness === 'function');
    await work();
    assert.deepEqual(errors, [], 'No browser runtime errors');
    passed++;
    console.log('PASS ' + name);
  }
  const evaluate = (code) => page.evaluate(code);
  const validDraft = () => evaluate(() => {
    draftItems.forEach(item => {item.qtyRequested=100; item.satuan='Unit';});
  });
  const allApproved = () => evaluate(() => {
    const item = draftItems[0]; item.jalurRequired='HO'; item.qtyRequested=100; item.qtyApproved=80;
    ['PM','MK','HO'].forEach(p => {item.decisions[p]={decided:true,choice:'Disetujui',timestamp:getFormattedTime(),note:'Instruksi contoh'};});
    item.statusReview='Disetujui';
  });
  try {
    await check('New items have no decision or approved quantity; quantity validation', async () => {
      assert.equal(await evaluate(() => draftItems.every(i => i.statusReview==='Belum direview' && i.qtyApproved===null && Object.values(i.decisions).every(d=>!d.decided))), true);
      assert.equal(await evaluate(() => parseQuantity('')===null && parseQuantity('-1')===undefined && parseQuantity('0')===undefined && parseQuantity('abc')===undefined && parseQuantity('1e999')===undefined && parseQuantity('1.5')===1.5), true);
    });
    await check('Initial snapshot preserved after review begins', async () => {
      await validDraft();
      await evaluate(() => simpanDraft());
      await evaluate(() => {updateDraftQty(0,'50'); updateDraftSatuan(0,'Kg');});
      assert.deepEqual(await evaluate(() => [draftItems[0].qtyRequested,draftItems[0].satuan,draftItems[0].initialSnapshot.qtyRequested]), [100,'Unit',100]);
    });
    await check('PM alone does not complete HO; previous decision captured accurately', async () => {
      await validDraft();
      await evaluate(() => {draftItems[0].jalurRequired='HO';});
      prompts=['PM','Disetujui','Instruksi pertama'];
      await evaluate(() => quickLogDecision(0));
      assert.equal(await evaluate(() => checkApprovalFulfillment(draftItems[0])), false);
      assert.equal(await evaluate(() => draftItems[0].statusReview), 'Belum direview');
      prompts=['PM','Ditunda','Instruksi kedua'];
      await evaluate(() => quickLogDecision(0));
      assert.equal(await evaluate(() => draftItems[0].history.at(-1).before.includes('Disetujui')), true);
    });
    await check('HO requires file coverage, not merely approval', async () => {
      await allApproved();
      assert.match(await evaluate(() => itemReadiness(draftItems[0])), /Bukti final HO/);
      await evaluate(() => {hoFileUploaded='contoh.pdf'; hoCoveredItemIds=[];});
      assert.match(await evaluate(() => itemReadiness(draftItems[0])), /Bukti final HO/);
      await evaluate(() => toggleHOCoverage(draftItems[0].id,true));
      assert.equal(await evaluate(() => itemReadiness(draftItems[0])), 'Memenuhi syarat untuk dilanjutkan');
    });
    await check('One file covers multiple HO items; PM and Owner independent', async () => {
      await validDraft();
      await evaluate(() => {
        addToDraft('MAT-002'); draftItems[3].qtyRequested=10; draftItems[3].qtyApproved=10;
        for(const item of [draftItems[0],draftItems[3]]) {
          item.jalurRequired='HO'; item.qtyApproved=10; item.statusReview='Disetujui';
          ['PM','MK','HO'].forEach(p=>item.decisions[p]={decided:true,choice:'Disetujui'});
        }
        hoFileUploaded='bersama.pdf'; hoCoveredItemIds=[draftItems[0].id,draftItems[3].id];
      });
      assert.equal(await evaluate(() => [draftItems[0],draftItems[3]].every(i=>itemReadiness(i)==='Memenuhi syarat untuk dilanjutkan')), true);
      await evaluate(() => {
        hoFileUploaded=''; hoCoveredItemIds=[];
        draftItems[0].jalurRequired='PM';
      });
      assert.equal(await evaluate(() => itemReadiness(draftItems[0])), 'Memenuhi syarat untuk dilanjutkan');
      assert.equal(await evaluate(() => itemReadiness(draftItems[2])), 'Memenuhi syarat untuk dilanjutkan');
      assert.match(await evaluate(() => itemReadiness(draftItems[3])), /Bukti final HO/);
    });
    await check('Review can save without HO evidence and does not increment REV', async () => {
      await allApproved();
      await evaluate(() => simpanHasilReview());
      assert.deepEqual(await evaluate(() => [revVersion,documentVersion]), [0,2]);
    });
    await check('Revision validates party/reason, records metadata, and remains inspectable', async () => {
      await validDraft();
      await evaluate(() => {document.getElementById('revisi-alasan').value=''; prosesTerbitkanRevisi();});
      assert.equal(await evaluate(() => revVersion), 0);
      await evaluate(() => {document.getElementById('revisi-pihak').value='MK';document.getElementById('revisi-alasan').value='Perubahan spesifikasi';prosesTerbitkanRevisi();});
      assert.deepEqual(await evaluate(() => [revVersion,revisionHistory[0].party,revisionHistory[0].reason]), [1,'MK','Perubahan spesifikasi']);
      assert.match(await evaluate(() => revisionHistory[0].timestamp), /WIB/);
      assert.equal(await evaluate(() => draftItems.every(i=>i.history.at(-1).field==='Terbitkan Revisi')), true);
    });
    await check('Delete/reset cannot erase reviewed items; cancellation preserves history', async () => {
      await validDraft(); await evaluate(() => simpanDraft());
      await evaluate(() => {removeDraft(0); resetDraft();});
      assert.equal(await evaluate(() => draftItems.length), 3);
      assert.equal(await page.locator('#modal-batal-item').evaluate(el=>el.classList.contains('active')), true);
      await evaluate(() => {document.getElementById('batal-item-alasan').value='Dibatalkan lapangan';prosesBatalItem();});
      assert.equal(await evaluate(() => draftItems[0].statusReview), 'Batal');
      assert.ok(await evaluate(() => draftItems[0].history.length)>1);
    });
    await check('Conflict requires explicit field choices and actually applies them', async () => {
      await validDraft();
      await evaluate(() => {draftItems[0].qtyApproved=90;draftItems[0].spekApproved='Isian lokal'; triggerKonflik(); terapkanKonflik();});
      assert.equal(await evaluate(() => draftItems[0].qtyApproved),90);
      await page.selectOption('#konflik-choice-1','server');
      await page.selectOption('#konflik-choice-2','local');
      prompts=['HO','Rekonsiliasi sesuai instruksi HO'];
      await evaluate(() => terapkanKonflik());
      assert.deepEqual(await evaluate(() => [draftItems[0].qtyApproved,draftItems[0].spekApproved,documentVersion,serverVersion,conflictState]),[80,'Isian lokal',3,3,null]);
    });
    await check('Server or local changes invalidate an open conflict without data loss', async () => {
      await validDraft();
      await evaluate(() => {triggerKonflik();serverVersion++;});
      await page.selectOption('#konflik-choice-1','server'); await page.selectOption('#konflik-choice-2','server');
      await evaluate(() => terapkanKonflik());
      assert.equal(await evaluate(() => draftItems[0].qtyApproved),null);
      await evaluate(() => {triggerKonflik(); draftItems[0].spekApproved='Perubahan sesudah dialog';});
      await page.selectOption('#konflik-choice-1','server'); await page.selectOption('#konflik-choice-2','server');
      await evaluate(() => terapkanKonflik());
      assert.equal(await evaluate(() => draftItems[0].spekApproved),'Perubahan sesudah dialog');
    });
    await check('Risk requires its own reason; failed-save simulation keeps input', async () => {
      await validDraft();
      await evaluate(() => {draftItems[0].isRisk=true;draftItems[0].riskReason='';simpanHasilReview();});
      assert.equal(await evaluate(() => documentVersion),1);
      const before = await evaluate(() => JSON.stringify(draftItems));
      await evaluate(() => triggerGagalSimpan());
      assert.equal(await evaluate(() => JSON.stringify(draftItems)),before);
    });
    await check('Review edits record instructor/reason; initial values stay frozen', async () => {
      await validDraft(); await evaluate(() => simpanDraft());
      await evaluate(() => {draftItems[0].pemberiInstruksi='MK';});
      prompts=['Pengurangan sesuai coretan MK'];
      await evaluate(() => updateReviewQtyApproved(0,'80'));
      assert.deepEqual(await evaluate(() => [draftItems[0].qtyApproved,draftItems[0].initialSnapshot.qtyRequested,draftItems[0].history.at(-1).party]),[80,100,'MK']);
    });
    await check('HO changes keep earlier approvals; earlier-party changes reopen later decisions', async () => {
      await allApproved();
      await evaluate(() => {draftItems[0].pemberiInstruksi='HO';});
      prompts=['Instruksi final HO']; await evaluate(() => updateReviewSpekApproved(0,'Merek final HO'));
      assert.equal(await evaluate(() => checkApprovalFulfillment(draftItems[0])),true);
      await evaluate(() => {draftItems[0].pemberiInstruksi='PM';});
      prompts=['Perubahan baru dari PM']; await evaluate(() => updateReviewQtyApproved(0,'70'));
      assert.equal(await evaluate(() => draftItems[0].decisions.MK.decided || draftItems[0].decisions.HO.decided),false);
    });
    await check('Unknown brand confirmation audited without changing master', async () => {
      await validDraft();
      await evaluate(() => {draftItems[1].pemberiInstruksi='MK';});
      prompts=['Bermerek','Merek Contoh','Konfirmasi dari MK'];
      await evaluate(() => confirmClassification(1));
      assert.equal(await evaluate(() => draftItems[1].klasifikasi),'Bermerek');
      assert.equal(await evaluate(() => masterKatalog.find(i=>i.id===draftItems[1].id).klasifikasi),'Merek Belum Diketahui');
    });
    await check('Published revision snapshot is immutable; attachment coverage is audited', async () => {
      await validDraft();
      await evaluate(() => {hoFileUploaded='contoh.pdf';draftItems[0].jalurRequired='HO'; toggleHOCoverage(draftItems[0].id,true);});
      assert.match(await evaluate(() => documentHistory.at(-1).after),/MAT-001/);
      await evaluate(() => {document.getElementById('revisi-pihak').value='HO';document.getElementById('revisi-alasan').value='Terbitkan contoh';prosesTerbitkanRevisi();});
      await evaluate(() => {draftItems[0].qtyRequested=999;hoCoveredItemIds=[];});
      assert.equal(await evaluate(() => revisionHistory[0].snapshot.items[0].qtyRequested),100);
      assert.deepEqual(await evaluate(() => revisionHistory[0].snapshot.hoCoveredItemIds),['MAT-001']);
      await evaluate(() => openModalRiwayat(-1));
      assert.match(await page.locator('#riwayat-tbody').innerText(),/Snapshot REV/);
    });
    await check('HTML-looking user text stays text in catalogue and history', async () => {
      await evaluate(() => {
        document.getElementById('temp-nama').value='<img src=x onerror="window.injected=true">';
        document.getElementById('temp-merek').value='"<script>example</script>';
        tambahItemSementara();
      });
      assert.equal(await page.locator('#table-katalog-body img').count(),0);
      assert.equal(await evaluate(() => Boolean(window.injected)),false);
      await evaluate(() => {addHistory(0,'Texte','<b>avant</b>','<img src=x>','Admin','<script>exemple</script>');openModalRiwayat(0);});
      assert.equal(await page.locator('#riwayat-tbody img, #riwayat-tbody script').count(),0);
    });
    await check('Short code search, desktop/mobile tabs and horizontal containment', async () => {
      await page.fill('#search-katalog','001');
      assert.match(await page.locator('#table-katalog-body').innerText(),/MAT-001/);
      for(const tab of ['katalog','permintaan','review']) {
        await evaluate(`switchTab('${tab}')`);
        assert.equal(await page.locator('#tab-'+tab).evaluate(el=>el.classList.contains('active')),true);
      }
      await page.setViewportSize({width:390,height:844});
      for(const tab of ['katalog','permintaan','review']) {
        await evaluate(`switchTab('${tab}')`);
        assert.equal(await evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),true,'No page overflow: '+tab);
      }
    });
    console.log(`${passed}/${passed} focused browser scenarios passed.`);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
