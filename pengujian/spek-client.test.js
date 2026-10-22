const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_BIN,
    ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter(Boolean)
      .flatMap((base) => [
        path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      ]),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome'
  ].filter(Boolean);

  return (
    candidates.find(
      (candidate) =>
        fs.existsSync(candidate)
    ) || ''
  );
}

function buildHarness(spekView) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Spek Client Test</title>
<script>
'use strict';

let accessToken = 'session';
let activeProjectId = 'all';

const projects = {
  P1: {
    id: 'P1',
    name: 'Proyek Satu'
  },

  P2: {
    id: 'P2',
    name: 'Proyek Dua'
  }
};

const rpcLog = [];

const records = {
  P1: [
    {
      id: 'spek-existing-p1',
      projectId: 'P1',
      title: 'Existing P1',
      note: 'Dokumen awal',
      version: 1,

      items: [
        {
          catalogCode: 'MTR-001',
          name: 'Keramik',
          specification: '30x30 cm',
          unit: 'dus',
          brands: ['Aqua'],
          price: null,
          note: ''
        },
        {
          catalogCode: 'MTR-002',
          name: 'Cat',
          specification: '25 kg',
          unit: 'pail',
          brands: ['Vinilex'],
          price: 100000,
          note: ''
        }
      ]
    }
  ],

  P2: [
    {
      id: 'spek-p2',
      projectId: 'P2',
      title: 'Dokumen P2',
      note: '',
      version: 1,

      items: [
        {
          catalogCode: 'MTR-020',
          name: 'Pipa P2',
          specification: '2 inci',
          unit: 'batang',
          brands: ['Lesso'],
          price: null,
          note: ''
        }
      ]
    }
  ]
};

let saveMode = 'normal';
let delayP1List = 0;
let queryMode = false;

window.confirm = () => true;

window.ProjectWorkspace = {
  ready: async () => {},

  getActiveId:
    () => activeProjectId,

  getActive:
    () =>
      projects[
        activeProjectId
      ] || null
};

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function listFor(
  projectId,
  query
) {
  if (
    queryMode &&
    projectId === 'P2'
  ) {
    if (query === 'lama') {
      return [
        {
          id: 'query-lama',
          projectId: 'P2',
          title: 'HASIL LAMA',
          note: '',
          version: 1,
          items: []
        }
      ];
    }

    if (query === 'baru') {
      return [
        {
          id: 'query-baru',
          projectId: 'P2',
          title: 'HASIL BARU',
          note: '',
          version: 1,
          items: []
        }
      ];
    }
  }

  const all =
    records[projectId] || [];

  if (!query) {
    return clone(all);
  }

  const normalized =
    query.toLowerCase();

  return clone(
    all.filter(
      (record) =>
        JSON.stringify(record)
          .toLowerCase()
          .includes(normalized)
    )
  );
}

function catalogItems() {
  return Array.from(
    { length: 9 },
    (_, index) => ({
      code:
        'MTR-' +
        String(index + 1)
          .padStart(3, '0'),

      label:
        'Referensi katalog ' +
        (index + 1)
    })
  );
}

function fakeMaterialSpec(
  action,
  payload,
  onSuccess,
  onFailure
) {
  rpcLog.push({
    action,
    payload: clone(payload)
  });

  if (action === 'listSpecs') {
    const delay =
      payload.projectId === 'P1'
        ? delayP1List
        : (
            queryMode &&
            payload.query === 'lama'
              ? 700
              : 15
          );

    setTimeout(
      () => {
        const rows =
          listFor(
            payload.projectId,
            payload.query || ''
          );

        onSuccess({
          records: rows,
          total: rows.length,
          offset: 0,
          limit:
            payload.limit || 100,
          hasMore: false
        });
      },
      delay
    );

    return;
  }

  if (
    action ===
    'searchCatalog'
  ) {
    setTimeout(
      () => {
        const all =
          catalogItems();

        const start =
          Number(
            payload.offset || 0
          );

        const limit =
          Number(
            payload.limit || 8
          );

        const page =
          all.slice(
            start,
            start + limit
          );

        onSuccess({
          items: page,
          total: all.length,
          offset: start,
          limit,
          hasMore:
            start + limit <
            all.length
        });
      },
      15
    );

    return;
  }

  if (action === 'saveSpec') {
    setTimeout(
      () => {
        if (
          saveMode === 'fail'
        ) {
          onFailure(
            new Error(
              'Simpan sengaja gagal'
            )
          );

          return;
        }

        const currentList =
          records[
            payload.projectId
          ] ||
          (
            records[
              payload.projectId
            ] = []
          );

        const currentIndex =
          currentList.findIndex(
            (record) =>
              record.id ===
              payload.record.id
          );

        if (
          saveMode ===
          'conflict'
        ) {
          const existing =
            currentIndex >= 0
              ? currentList[
                  currentIndex
                ]
              : {
                  ...payload.record,
                  version: 2
                };

          const serverRecord = {
            ...clone(existing),
            title: 'Judul Server',

            version:
              Number(
                existing.version ||
                1
              ) + 1
          };

          if (
            currentIndex >= 0
          ) {
            currentList[
              currentIndex
            ] = serverRecord;
          }

          onSuccess({
            conflict: true,
            record:
              clone(serverRecord)
          });

          return;
        }

        let saved;

        if (
          currentIndex >= 0
        ) {
          saved = {
            ...clone(
              payload.record
            ),

            projectId:
              payload.projectId,

            version:
              Number(
                currentList[
                  currentIndex
                ].version || 1
              ) + 1
          };

          currentList[
            currentIndex
          ] = saved;
        } else {
          saved = {
            ...clone(
              payload.record
            ),

            projectId:
              payload.projectId,

            version: 1
          };

          currentList.push(
            saved
          );
        }

        if (
          saveMode ===
          'warning'
        ) {
          onSuccess({
            record:
              clone(saved),

            warning:
              'Audit gagal tetapi record tersimpan.'
          });

          return;
        }

        onSuccess({
          record:
            clone(saved)
        });
      },
      80
    );

    return;
  }

  onFailure(
    new Error(
      'Action tidak dikenal: ' +
      action
    )
  );
}

function invokeServer(
  functionName,
  args,
  onSuccess,
  onFailure
) {
  if (
    functionName !==
    'apiMaterialSpec'
  ) {
    onFailure(
      new Error(
        'Endpoint salah: ' +
        functionName
      )
    );

    return;
  }

  const [
    action,
    payload,
    token
  ] = args;

  if (
    token !== accessToken
  ) {
    onFailure(
      new Error(
        'Token transport tidak sesuai.'
      )
    );

    return;
  }

  fakeMaterialSpec(
    action,
    payload,
    onSuccess,
    onFailure
  );
}
</script>
</head>

<body>

${spekView}

<pre id="test-results">RUNNING</pre>

<script>
(async () => {
  const results = [];

  const out =
    document.getElementById(
      'test-results'
    );

  const root =
    document.getElementById(
      'blank-SPEC'
    );

  root.hidden = false;

  function pass(name) {
    results.push(
      'PASS ' + name
    );
  }

  function check(
    condition,
    name
  ) {
    if (!condition) {
      throw new Error(name);
    }

    pass(name);
  }

  function sleep(ms) {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          ms
        )
    );
  }

  function input(
    selector,
    value
  ) {
    const node =
      root.querySelector(
        selector
      );

    if (!node) {
      throw new Error(
        'Elemen tidak ditemukan: ' +
        selector
      );
    }

    node.value = value;

    node.dispatchEvent(
      new Event(
        'input',
        {
          bubbles: true
        }
      )
    );

    return node;
  }

  function click(selector) {
    const node =
      root.querySelector(
        selector
      );

    if (!node) {
      throw new Error(
        'Tombol tidak ditemukan: ' +
        selector
      );
    }

    node.click();
    return node;
  }

  function rowByText(value) {
    return Array
      .from(
        root.querySelectorAll(
          '[data-spek-body] > tr'
        )
      )
      .find(
        (row) =>
          row.textContent
            .includes(value)
      );
  }

  try {
    const beforeAll =
      rpcLog.length;

    await window
      .SpekWorkspace
      .open();

    check(
      rpcLog.length === beforeAll,
      'project all tidak memanggil backend'
    );

    check(
      root
        .querySelector(
          '[data-spek-state]'
        )
        .textContent
        .includes(
          'Pilih proyek'
        ),

      'project all meminta pengguna memilih proyek'
    );

    activeProjectId = 'P1';

    await window
      .SpekWorkspace
      .open();

    await sleep(30);

    check(
      root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes(
          'Existing P1'
        ),

      'listSpecs proyek aktif tampil'
    );

    check(
      root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes('2'),

      'dokumen multi-item ditampilkan'
    );

    click(
      '[data-spek-action="add"]'
    );

    input(
      '[data-spek-title]',
      'Spek Baru'
    );

    click(
      '[data-spek-action="pick-catalog"]'
    );

    input(
      '[data-spek-catalog-search]',
      'keramik'
    );

    await sleep(340);
    await sleep(40);

    check(
      root.querySelectorAll(
        '[data-spek-catalog-results] .spek-catalog-result'
      ).length === 8,

      'pencarian katalog memakai limit backend'
    );

    click(
      '[data-spek-action="catalog-next"]'
    );

    await sleep(40);

    const searchCalls =
      rpcLog.filter(
        (entry) =>
          entry.action ===
          'searchCatalog'
      );

    check(
      searchCalls.some(
        (entry) =>
          entry.payload.offset === 8
      ),

      'pagination katalog meneruskan offset backend'
    );

    click(
      '[data-spek-action="catalog-prev"]'
    );

    await sleep(40);

    click(
      '[data-spek-catalog-results] [data-spek-action="catalog-choose"]'
    );

    input(
      '[data-spek-item-name="0"]',
      'Keramik 60x60'
    );

    input(
      '[data-spek-item-spec="0"]',
      '60x60 cm'
    );

    input(
      '[data-spek-item-unit="0"]',
      'dus'
    );

    input(
      '[data-spek-item-brands="0"]',
      'Roman\\nGranito'
    );

    input(
      '[data-spek-item-price="0"]',
      ''
    );

    saveMode = 'fail';

    const form =
      root.querySelector(
        '[data-spek-form]'
      );

    const saveBefore =
      rpcLog.filter(
        (entry) =>
          entry.action ===
          'saveSpec'
      ).length;

    form.requestSubmit();
    form.requestSubmit();

    await sleep(120);

    const failedSaves =
      rpcLog.filter(
        (entry) =>
          entry.action ===
          'saveSpec'
      );

    check(
      failedSaves.length ===
      saveBefore + 1,

      'klik simpan berulang tidak menggandakan RPC'
    );

    const failedPayload =
      failedSaves[
        failedSaves.length - 1
      ].payload;

    check(
      root
        .querySelector(
          '[data-spek-editor]'
        )
        .open,

      'simpan gagal mempertahankan dialog'
    );

    check(
      root
        .querySelector(
          '[data-spek-title]'
        )
        .value ===
        'Spek Baru',

      'simpan gagal mempertahankan isian'
    );

    check(
      failedPayload
        .record
        .items[0]
        .price === null,

      'harga kosong diteruskan sebagai null'
    );

    check(
      JSON.stringify(
        failedPayload
          .record
          .items[0]
          .brands
      ) ===
      JSON.stringify(
        [
          'Roman',
          'Granito'
        ]
      ),

      'beberapa kandidat merek diteruskan benar'
    );

    const stableCreateId =
      failedPayload.record.id;

    check(
      /^spek-/.test(
        stableCreateId
      ),

      'create memakai ID client stabil'
    );

    saveMode = 'normal';

    form.requestSubmit();

    await sleep(140);

    const retryPayload =
      rpcLog.filter(
        (entry) =>
          entry.action ===
          'saveSpec'
      ).at(-1).payload;

    check(
      retryPayload.record.id ===
      stableCreateId,

      'retry mempertahankan ID create'
    );

    check(
      !root
        .querySelector(
          '[data-spek-editor]'
        )
        .open,

      'save sukses menutup editor'
    );

    check(
      root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes(
          'Spek Baru'
        ),

      'record hasil simpan muncul di daftar'
    );

    const newRow =
      rowByText(
        'Spek Baru'
      );

    newRow
      .querySelector(
        '[data-spek-action="edit"]'
      )
      .click();

    input(
      '[data-spek-title]',
      'Spek Baru Revisi'
    );

    saveMode = 'normal';

    root
      .querySelector(
        '[data-spek-form]'
      )
      .requestSubmit();

    await sleep(140);

    const updatePayload =
      rpcLog.filter(
        (entry) =>
          entry.action ===
          'saveSpec'
      ).at(-1).payload;

    check(
      updatePayload
        .expectedVersion === 1,

      'edit mengirim expectedVersion di payload'
    );

    check(
      updatePayload.record.id ===
      stableCreateId,

      'edit mempertahankan ID record'
    );

    check(
      !Object.prototype
        .hasOwnProperty
        .call(
          updatePayload.record,
          'version'
        ),

      'version tidak dipindah ke record save'
    );

    check(
      root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes(
          'Spek Baru Revisi'
        ),

      'record dapat dibuka dan diedit'
    );

    const revisedRow =
      rowByText(
        'Spek Baru Revisi'
      );

    revisedRow
      .querySelector(
        '[data-spek-action="edit"]'
      )
      .click();

    input(
      '[data-spek-title]',
      'Isian Lokal Conflict'
    );

    saveMode = 'conflict';

    root
      .querySelector(
        '[data-spek-form]'
      )
      .requestSubmit();

    await sleep(110);

    check(
      root
        .querySelector(
          '[data-spek-editor]'
        )
        .open,

      'conflict mempertahankan editor'
    );

    check(
      root
        .querySelector(
          '[data-spek-title]'
        )
        .value ===
        'Isian Lokal Conflict',

      'conflict tidak menimpa isian lokal'
    );

    check(
      root
        .querySelector(
          '[data-spek-error]'
        )
        .textContent
        .includes(
          'Konflik versi'
        ),

      'conflict ditampilkan terpisah'
    );

    click(
      '[data-spek-action="close-editor"]'
    );

    await window
      .SpekWorkspace
      .open();

    await sleep(30);

    const warningRow =
      rowByText(
        'Judul Server'
      );

    warningRow
      .querySelector(
        '[data-spek-action="edit"]'
      )
      .click();

    input(
      '[data-spek-note]',
      'Catatan warning'
    );

    saveMode = 'warning';

    root
      .querySelector(
        '[data-spek-form]'
      )
      .requestSubmit();

    await sleep(150);

    check(
      !root
        .querySelector(
          '[data-spek-editor]'
        )
        .open,

      'warning tetap dianggap record tersimpan'
    );

    check(
      root
        .querySelector(
          '[data-spek-status]'
        )
        .textContent
        .includes(
          'peringatan'
        ),

      'warning server ditampilkan berbeda dari sukses biasa'
    );

    delayP1List = 220;
    queryMode = false;
    activeProjectId = 'P1';

    const oldOpen =
      window
        .SpekWorkspace
        .open();

    await sleep(15);

    activeProjectId = 'P2';

    document.dispatchEvent(
      new CustomEvent(
        'utp-project-change',
        {
          detail: {
            projectId: 'P2'
          }
        }
      )
    );

    await sleep(280);
    await oldOpen;

    check(
      root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes(
          'Dokumen P2'
        ),

      'respons proyek baru tampil'
    );

    check(
      !root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes(
          'Existing P1'
        ),

      'respons proyek lama tidak menimpa proyek baru'
    );

    queryMode = true;
    delayP1List = 0;

    input(
      '[data-spek-search]',
      'lama'
    );

    await sleep(320);

    input(
      '[data-spek-search]',
      'baru'
    );

    await sleep(350);

    check(
      root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes(
          'HASIL BARU'
        ),

      'respons query baru tampil'
    );

    await sleep(430);

    check(
      !root
        .querySelector(
          '[data-spek-body]'
        )
        .textContent
        .includes(
          'HASIL LAMA'
        ),

      'respons query lama tidak menimpa query baru'
    );

    window
      .SpekWorkspace
      .reset();

    check(
      root
        .querySelector(
          '[data-spek-state]'
        )
        .textContent
        .includes(
          'Spek belum dibuka'
        ),

      'reset sesi membersihkan data Spek'
    );

    check(
      !window
        .SpekWorkspace
        .isDirty() &&
      !window
        .SpekWorkspace
        .isBusy(),

      'reset membersihkan dirty dan busy'
    );

    activeProjectId = 'P1';
    accessToken = '';

    const beforePreview =
      rpcLog.length;

    await window
      .SpekWorkspace
      .open();

    await sleep(20);

    check(
      rpcLog.length ===
      beforePreview,

      'mode preview tanpa token tidak mengirim RPC'
    );

    check(
      root
        .querySelector(
          '[data-spek-action="add"]'
        )
        .disabled,

      'mode preview tidak mengaktifkan mutasi'
    );

    out.textContent =
      'ALL_PASS\\n' +
      results.join('\\n');

    document
      .documentElement
      .dataset
      .testDone = 'true';
  } catch (error) {
    out.textContent =
      'FAIL\\n' +
      error.message +
      '\\n' +
      (error.stack || '');

    document
      .documentElement
      .dataset
      .testDone = 'true';
  }
})();
</script>
</body>
</html>`;
}

function freePort() {
  return new Promise(
    (resolve, reject) => {
      const server =
        net.createServer();

      server.on(
        'error',
        reject
      );

      server.listen(
        0,
        '127.0.0.1',
        () => {
          const address =
            server.address();

          const port =
            address.port;

          server.close(
            (error) =>
              error
                ? reject(error)
                : resolve(port)
          );
        }
      );
    }
  );
}

async function waitForTarget(
  port,
  expectedName,
  timeoutMs = 8000
) {
  const deadline =
    Date.now() + timeoutMs;

  let lastError;

  while (
    Date.now() < deadline
  ) {
    try {
      const response =
        await fetch(
          'http://127.0.0.1:' +
          port +
          '/json'
        );

      if (response.ok) {
        const targets =
          await response.json();

        const page =
          targets.find(
            (target) =>
              target.type ===
                'page' &&
              target
                .webSocketDebuggerUrl &&
              String(
                target.url || ''
              ).includes(
                expectedName
              )
          );

        if (page) {
          return page;
        }
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          50
        )
    );
  }

  throw (
    lastError ||
    new Error(
      'Target Chromium tidak tersedia.'
    )
  );
}

function connectCdp(url) {
  return new Promise(
    (resolve, reject) => {
      const ws =
        new WebSocket(url);

      let nextId = 0;

      const pending =
        new Map();

      ws.addEventListener(
        'open',
        () => {
          resolve({
            evaluate(expression) {
              return new Promise(
                (
                  resolveEval,
                  rejectEval
                ) => {
                  const id =
                    ++nextId;

                  pending.set(
                    id,
                    {
                      resolve:
                        resolveEval,

                      reject:
                        rejectEval
                    }
                  );

                  ws.send(
                    JSON.stringify({
                      id,

                      method:
                        'Runtime.evaluate',

                      params: {
                        expression,
                        returnByValue:
                          true,
                        awaitPromise:
                          true
                      }
                    })
                  );
                }
              );
            },

            close() {
              ws.close();
            }
          });
        }
      );

      ws.addEventListener(
        'message',
        (event) => {
          const message =
            JSON.parse(
              String(event.data)
            );

          if (
            !message.id ||
            !pending.has(
              message.id
            )
          ) {
            return;
          }

          const entry =
            pending.get(
              message.id
            );

          pending.delete(
            message.id
          );

          if (message.error) {
            entry.reject(
              new Error(
                message.error.message
              )
            );

            return;
          }

          entry.resolve(
            message.result &&
            message.result.result
              ? message
                  .result
                  .result
                  .value
              : undefined
          );
        }
      );

      ws.addEventListener(
        'error',
        () => {
          reject(
            new Error(
              'WebSocket CDP gagal.'
            )
          );
        }
      );
    }
  );
}

test(
  'SpekWorkspace behavior with fake transport',
  {
    timeout: 30000
  },
  async () => {
    const chromium =
      findChromium();

    assert.ok(
      chromium,
      'Chromium tidak tersedia untuk pemeriksaan frontend.'
    );

    const sourcePath =
      path.join(
        __dirname,
        '../aplikasi/SpekView.html'
      );

    const spekView =
      fs.readFileSync(
        sourcePath,
        'utf8'
      );

    const html =
      buildHarness(
        spekView
      );

    const profilePath =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'spek-chromium-'
        )
      );

    const cdpPort =
      await freePort();

    const browser =
      spawn(
        chromium,
        [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--remote-debugging-port=' +
            cdpPort,
          '--user-data-dir=' +
            profilePath,
          'about:blank'
        ],
        {
          stdio: [
            'ignore',
            'ignore',
            'pipe'
          ]
        }
      );

    let stderr = '';

    browser.stderr
      .setEncoding('utf8');

    browser.stderr
      .on(
        'data',
        (chunk) => {
          stderr += chunk;
        }
      );

    let cdp;

    try {
      const target =
        await waitForTarget(
          cdpPort,
          'about:blank'
        );

      cdp =
        await connectCdp(
          target
            .webSocketDebuggerUrl
        );

      await cdp.evaluate(
        'document.open(); document.write(' +
        JSON.stringify(html) +
        '); document.close(); true;'
      );

      const deadline =
        Date.now() + 12000;

      let done = false;

      while (
        Date.now() < deadline
      ) {
        done =
          await cdp.evaluate(
            "document.documentElement.dataset.testDone === 'true'"
          );

        if (done) {
          break;
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              50
            )
        );
      }

      if (!done) {
        const href =
          await cdp.evaluate(
            'location.href'
          );

        const body =
          await cdp.evaluate(
            "document.body ? document.body.innerText.slice(0,2000) : 'NO_BODY'"
          );

        const workspaceType =
          await cdp.evaluate(
            'typeof window.SpekWorkspace'
          );

        const logType =
          await cdp.evaluate(
            'typeof rpcLog'
          );

        assert.equal(
          done,
          true,

          'Harness browser belum selesai. href=' +
          href +
          ' SpekWorkspace=' +
          workspaceType +
          ' rpcLog=' +
          logType +
          ' body=' +
          body +
          ' Chromium stderr: ' +
          stderr.slice(-1200)
        );
      }

      const output =
        await cdp.evaluate(
          "document.getElementById('test-results').textContent"
        );

      assert.match(
        output,
        /^ALL_PASS/m,
        output
      );
    } finally {
      if (cdp) {
        cdp.close();
      }

      if (!browser.killed) {
        browser.kill(
          'SIGKILL'
        );
      }

      await new Promise(
        (resolve) => {
          if (
            browser.exitCode !==
              null ||
            browser.signalCode !==
              null
          ) {
            resolve();
            return;
          }

          const timer =
            setTimeout(
              resolve,
              1000
            );

          browser.once(
            'exit',
            () => {
              clearTimeout(timer);
              resolve();
            }
          );
        }
      );

      try {
        fs.rmSync(
          profilePath,
          {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 100
          }
        );
      } catch (_) {
      }
    }
  }
);

test(
  'MemoClient memasang hook buka dan reset Spek',
  () => {
    const source =
      fs.readFileSync(
        path.join(
          __dirname,
          '../aplikasi/MemoClient.html'
        ),
        'utf8'
      );

    assert.match(
      source,
      /if \(window\.SpekWorkspace\) window\.SpekWorkspace\.reset\(\);/
    );

    assert.match(
      source,
      /if \(page === 'SPEC' && window\.SpekWorkspace\) window\.SpekWorkspace\.open\(\);/
    );
  }
);
