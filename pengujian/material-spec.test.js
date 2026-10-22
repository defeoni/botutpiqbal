const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function environment() {
  const state = {
    props: new Map(),
    books: new Map(),
    next: 0,
    locks: 0,
    failAuditCount: 0,
    failMaterialWriteCount: 0,
    materialWrites: 0
  };

  const uid = () =>
    `uuid-${String(++state.next).padStart(8, '0')}`;

  class Range {
    constructor(
      sheet,
      row,
      col,
      rows = 1,
      cols = 1
    ) {
      Object.assign(
        this,
        {
          sheet,
          row,
          col,
          rows,
          cols
        }
      );
    }

    getValues() {
      return Array.from(
        {
          length: this.rows
        },
        (_, r) =>
          Array.from(
            {
              length: this.cols
            },
            (_, c) =>
              this.sheet.rows[
                this.row + r - 1
              ]?.[
                this.col + c - 1
              ] ?? ''
          )
      );
    }

    getDisplayValues() {
      return this
        .getValues()
        .map(
          row =>
            row.map(
              value =>
                String(value)
                  .replace(
                    /^'/,
                    ''
                  )
            )
        );
    }

    setValues(values) {
      if (
        this.sheet.name ===
          'materialSpecs' &&
        this.row > 1 &&
        state.failMaterialWriteCount >
          0
      ) {
        state.failMaterialWriteCount--;

        throw new Error(
          'Material storage unavailable (simulasi).'
        );
      }

      if (
        this.sheet.name ===
          'materialSpecs' &&
        this.row > 1
      ) {
        state.materialWrites++;
      }

      values.forEach(
        (row, r) => {
          row.forEach(
            (value, c) => {
              const target =
                this.sheet.rows[
                  this.row + r - 1
                ] ||= [];

              target[
                this.col + c - 1
              ] = value;
            }
          );
        }
      );

      return this;
    }

    createTextFinder(value) {
      const range = this;

      return {
        matchEntireCell() {
          return this;
        },

        findNext() {
          const values =
            range.getValues();

          const index =
            values.findIndex(
              row =>
                row.some(
                  cell =>
                    String(cell) ===
                    String(value)
                )
            );

          return index < 0
            ? null
            : {
                getRow:
                  () =>
                    range.row +
                    index
              };
        }
      };
    }
  }

  class Sheet {
    constructor(name) {
      this.name = name;
      this.rows = [];
    }

    getRange(...args) {
      return new Range(
        this,
        ...args
      );
    }

    getLastRow() {
      return this.rows.length;
    }

    appendRow(row) {
      if (
        this.name === 'audit' &&
        state.failAuditCount > 0
      ) {
        state.failAuditCount--;

        throw new Error(
          'Audit storage unavailable (simulasi).'
        );
      }

      this
        .getRange(
          this.rows.length + 1,
          1,
          1,
          row.length
        )
        .setValues([row]);

      return this;
    }

    setFrozenRows() {
      return this;
    }
  }

  const sandbox = {
    console,
    JSON,
    Math,
    Number,
    String,
    Array,
    Object,
    Date,
    RegExp,
    Error,
    Boolean,
    isFinite,
    isNaN,
    parseInt,
    parseFloat,

    PropertiesService: {
      getScriptProperties:
        () => ({
          getProperty:
            key =>
              state.props.get(key) ||
              null,

          setProperty:
            (key, value) =>
              state.props.set(
                key,
                value
              )
        })
    },

    SpreadsheetApp: {
      create: () => {
        const id = uid();
        const sheets =
          new Map();

        const book = {
          getId:
            () => id,

          getSheetByName:
            name =>
              sheets.get(name) ||
              null,

          insertSheet:
            name => {
              const sheet =
                new Sheet(name);

              sheets.set(
                name,
                sheet
              );

              return sheet;
            }
        };

        state.books.set(
          id,
          book
        );

        return book;
      },

      openById:
        id => {
          if (
            !state.books.has(id)
          ) {
            throw new Error(
              'Spreadsheet not found'
            );
          }

          return state.books.get(
            id
          );
        }
    },

    Utilities: {
      getUuid: uid,

      DigestAlgorithm: {
        SHA_256: 'sha256'
      },

      Charset: {
        UTF_8: 'UTF-8'
      },

      computeDigest:
        (
          algorithm,
          value
        ) => {
          assert.equal(
            algorithm,
            'sha256'
          );

          return Array.from(
            crypto
              .createHash(
                'sha256'
              )
              .update(
                String(value),
                'utf8'
              )
              .digest()
          );
        },

      base64Encode:
        bytes =>
          Buffer
            .from(bytes)
            .toString(
              'base64'
            )
    },

    LockService: {
      getScriptLock:
        () => ({
          waitLock:
            () => {
              state.locks++;
            },

          releaseLock:
            () => {
              state.locks--;
            }
        })
    },

    requireAuthorized_:
      token => {
        if (
          token !== 'session'
        ) {
          throw new Error(
            'Unauthorized'
          );
        }
      }
  };

  vm.createContext(
    sandbox
  );

  for (
    const name of [
      'UtpDomain.gs',
      'Utp.gs',
      'Workspace.gs',
      'Projects.gs',
      'MaterialSpec.gs'
    ]
  ) {
    vm.runInContext(
      fs.readFileSync(
        path.join(
          __dirname,
          '../aplikasi',
          name
        ),
        'utf8'
      ),
      sandbox,
      {
        filename: name
      }
    );
  }

  sandbox.utpDb_(true);

  function addProject(
    id,
    overrides = {}
  ) {
    return sandbox.utpWrite_(
      'workspaceProjects',
      {
        id,
        name:
          `Proyek ${id}`,
        archived: false,
        ...overrides
      },
      0
    );
  }

  addProject(
    'proyek-alpha'
  );

  addProject(
    'proyek-beta'
  );

  addProject(
    'proyek-nonaktif',
    {
      archived: true
    }
  );

  const masterBook =
    sandbox
      .SpreadsheetApp
      .create('Master');

  const master =
    masterBook
      .insertSheet(
        'master'
      );

  master.appendRow(
    sandbox.UTP_MASTER_FIELDS
  );

  [
    [
      'MTR-001',
      'Keramik 30x30',
      'Aqua',
      '',
      '',
      '30x30 cm',
      'dus',
      'lantai',
      'keramik'
    ],
    [
      'MTR-002',
      'Cat tembok',
      'Vinilex',
      '',
      '',
      '25 kg',
      'pail',
      'cat',
      'tembok'
    ]
  ].forEach(
    row =>
      master.appendRow(row)
  );

  sandbox.utpMasterSheet_ =
    () => master;

  sandbox.utpSheet_(
    'audit',
    true
  );

  const call =
    (
      action,
      payload = {},
      token = 'session'
    ) =>
      sandbox.apiMaterialSpec(
        action,
        payload,
        token
      );

  const plain =
    value =>
      JSON.parse(
        JSON.stringify(value)
      );

  const specItem =
    overrides => ({
      catalogCode:
        'MTR-001',

      name:
        'Keramik 30x30',

      specification:
        '30x30 cm',

      unit:
        'dus',

      brands:
        ['Aqua'],

      price:
        '',

      note:
        '',

      ...(overrides || {})
    });

  const specRecord =
    overrides => ({
      id:
        'spek-0001',

      title:
        'Spek lantai',

      note:
        '',

      items:
        [specItem()],

      ...(overrides || {})
    });

  return {
    state,
    sandbox,
    call,
    plain,
    specItem,
    specRecord
  };
}

test(
  'autentikasi dan action tidak dikenal ditolak',
  () => {
    const env =
      environment();

    assert.throws(
      () =>
        env.call(
          'listSpecs',
          {
            projectId:
              'proyek-alpha'
          },
          'palsu'
        ),
      /Unauthorized/
    );

    assert.throws(
      () =>
        env.call(
          'hapusSemua',
          {
            projectId:
              'proyek-alpha'
          }
        ),
      /Tindakan Spek tidak dikenal/
    );
  }
);

test(
  'searchCatalog memakai katalog bersama dalam konteks proyek aktif',
  () => {
    const env =
      environment();

    const result =
      env.plain(
        env.call(
          'searchCatalog',
          {
            projectId:
              'proyek-alpha',

            query:
              'keramik',

            limit:
              1,

            offset:
              0
          }
        )
      );

    assert.equal(
      result.total,
      1
    );

    assert.equal(
      result.items.length,
      1
    );

    assert.equal(
      result.items[0].code,
      'MTR-001'
    );

    assert.equal(
      result.offset,
      0
    );

    assert.equal(
      result.limit,
      1
    );

    assert.equal(
      result.hasMore,
      false
    );
  }
);

test(
  'projectId kosong, all, legacy, tidak dikenal, dan proyek nonaktif ditolak pada semua action',
  () => {
    const env =
      environment();

    const badScopes = [
      '',
      'all',
      'legacy',
      'proyek-hantu',
      'proyek-nonaktif'
    ];

    for (
      const projectId of
      badScopes
    ) {
      assert.throws(
        () =>
          env.call(
            'searchCatalog',
            {
              projectId,
              query: ''
            }
          ),
        /Pilih proyek yang sudah disimpan|tersimpan dan aktif/,
        `searchCatalog ${projectId}`
      );

      assert.throws(
        () =>
          env.call(
            'listSpecs',
            {
              projectId
            }
          ),
        /Pilih proyek yang sudah disimpan|tersimpan dan aktif/,
        `listSpecs ${projectId}`
      );

      assert.throws(
        () =>
          env.call(
            'saveSpec',
            {
              projectId,
              record:
                env.specRecord()
            }
          ),
        /Pilih proyek yang sudah disimpan|tersimpan dan aktif/,
        `saveSpec ${projectId}`
      );
    }
  }
);

test(
  'kode katalog divalidasi di server sebelum penyimpanan',
  () => {
    const env =
      environment();

    assert.throws(
      () =>
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                items: [
                  env.specItem({
                    catalogCode:
                      'TIDAK-ADA-999'
                  })
                ]
              })
          }
        ),
      /tidak ditemukan di katalog master/
    );

    assert.deepEqual(
      env.plain(
        env.sandbox.utpRead_(
          'materialSpecs'
        )
      ),
      []
    );
  }
);

test(
  'Spek terisolasi per proyek dan query tidak mencampur proyek',
  () => {
    const env =
      environment();

    env.call(
      'saveSpec',
      {
        projectId:
          'proyek-alpha',

        record:
          env.specRecord({
            id:
              'spek-alpha1',

            title:
              'Keramik Alpha'
          })
      }
    );

    env.call(
      'saveSpec',
      {
        projectId:
          'proyek-alpha',

        record:
          env.specRecord({
            id:
              'spek-alpha2',

            title:
              'Cat Alpha',

            items: [
              env.specItem({
                catalogCode:
                  'MTR-002',

                name:
                  'Cat tembok',

                specification:
                  '25 kg',

                unit:
                  'pail',

                brands:
                  ['Vinilex']
              })
            ]
          })
      }
    );

    env.call(
      'saveSpec',
      {
        projectId:
          'proyek-beta',

        record:
          env.specRecord({
            id:
              'spek-beta01',

            title:
              'Keramik Beta'
          })
      }
    );

    const alpha =
      env.plain(
        env.call(
          'listSpecs',
          {
            projectId:
              'proyek-alpha'
          }
        )
      );

    const beta =
      env.plain(
        env.call(
          'listSpecs',
          {
            projectId:
              'proyek-beta'
          }
        )
      );

    const queried =
      env.plain(
        env.call(
          'listSpecs',
          {
            projectId:
              'proyek-alpha',

            query:
              'Vinilex'
          }
        )
      );

    assert.deepEqual(
      alpha.records
        .map(row => row.id)
        .sort(),
      [
        'spek-alpha1',
        'spek-alpha2'
      ]
    );

    assert.deepEqual(
      beta.records.map(
        row => row.id
      ),
      ['spek-beta01']
    );

    assert.deepEqual(
      queried.records.map(
        row => row.id
      ),
      ['spek-alpha2']
    );
  }
);

test(
  'Spek menyimpan beberapa kandidat merek, harga opsional, dan tidak menyimpan RAP atau kuantitas',
  () => {
    const env =
      environment();

    const saved =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                items: [
                  env.specItem({
                    brands: [
                      'Aqua',
                      'Mulia',
                      'Roman'
                    ],

                    price: '',
                    quantity: 50,
                    subtotal: 1000000,
                    rap: 2000000
                  })
                ]
              })
          }
        )
      ).record;

    assert.deepEqual(
      saved.items[0].brands,
      [
        'Aqua',
        'Mulia',
        'Roman'
      ]
    );

    assert.equal(
      saved.items[0].price,
      null
    );

    for (
      const forbidden of [
        'quantity',
        'subtotal',
        'total',
        'rap'
      ]
    ) {
      assert.ok(
        !(
          forbidden in
          saved.items[0]
        ),
        `${forbidden} tidak boleh tersimpan`
      );
    }

    const zero =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                id:
                  'spek-price00',

                items: [
                  env.specItem({
                    price: 0
                  })
                ]
              })
          }
        )
      ).record;

    assert.equal(
      zero.items[0].price,
      0
    );

    for (
      const bad of [
        '1.000.000',
        'seratus',
        '-5',
        'Rp100'
      ]
    ) {
      assert.throws(
        () =>
          env.call(
            'saveSpec',
            {
              projectId:
                'proyek-alpha',

              record:
                env.specRecord({
                  id:
                    `spek-bad-${crypto
                      .createHash(
                        'md5'
                      )
                      .update(bad)
                      .digest(
                        'hex'
                      )
                      .slice(
                        0,
                        8
                      )}`,

                  items: [
                    env.specItem({
                      price:
                        bad
                    })
                  ]
                })
            }
          ),
        /Harga referensi/
      );
    }
  }
);

test(
  'spesifikasi wajib; ukuran berbeda tetap berbeda; kode dan ukuran sama ditolak',
  () => {
    const env =
      environment();

    assert.throws(
      () =>
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                items: [
                  env.specItem({
                    specification:
                      ''
                  })
                ]
              })
          }
        ),
      /Spesifikasi\/ukuran wajib diisi/
    );

    const saved =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                items: [
                  env.specItem({
                    specification:
                      '30x30 cm'
                  }),

                  env.specItem({
                    specification:
                      '60x60 cm'
                  })
                ]
              })
          }
        )
      ).record;

    assert.deepEqual(
      saved.items.map(
        item =>
          item.specification
      ),
      [
        '30x30 cm',
        '60x60 cm'
      ]
    );

    assert.throws(
      () =>
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                id:
                  'spek-duplikat',

                items: [
                  env.specItem({
                    specification:
                      '30x30 cm'
                  }),

                  env.specItem({
                    specification:
                      ' 30X30 CM '
                  })
                ]
              })
          }
        ),
      /tercatat dua kali/
    );
  }
);

test(
  'update lintas proyek ditolak',
  () => {
    const env =
      environment();

    const created =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord()
          }
        )
      ).record;

    assert.throws(
      () =>
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-beta',

            expectedVersion:
              created.version,

            record: {
              ...created,
              projectId:
                'proyek-beta'
            }
          }
        ),
      /milik proyek lain/
    );
  }
);

test(
  'konflik versi mengembalikan record terbaru dan tidak menulis',
  () => {
    const env =
      environment();

    const created =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord()
          }
        )
      ).record;

    const updated =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            expectedVersion:
              created.version,

            record: {
              ...created,
              title:
                'Spek revisi'
            }
          }
        )
      ).record;

    const writesBeforeConflict =
      env.state.materialWrites;

    const conflict =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            expectedVersion:
              created.version,

            record: {
              ...created,
              title:
                'Timpa versi lama'
            }
          }
        )
      );

    assert.equal(
      updated.version,
      2
    );

    assert.equal(
      conflict.conflict,
      true
    );

    assert.equal(
      conflict.record.version,
      2
    );

    assert.equal(
      conflict.record.title,
      'Spek revisi'
    );

    assert.equal(
      env.state.materialWrites,
      writesBeforeConflict,
      'konflik tidak melakukan write'
    );

    assert.equal(
      env.sandbox.utpGet_(
        'materialSpecs',
        created.id
      ).title,
      'Spek revisi'
    );
  }
);

test(
  'create dengan ID stabil idempoten secara persisten',
  () => {
    const env =
      environment();

    const first =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord()
          }
        )
      );

    const writesAfterFirst =
      env.state.materialWrites;

    const retry =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord()
          }
        )
      );

    assert.equal(
      retry.deduplicated,
      true
    );

    assert.equal(
      retry.record.id,
      first.record.id
    );

    assert.equal(
      retry.record.version,
      first.record.version
    );

    assert.equal(
      env.state.materialWrites,
      writesAfterFirst,
      'retry tidak menulis ulang'
    );

    assert.equal(
      env.plain(
        env.call(
          'listSpecs',
          {
            projectId:
              'proyek-alpha'
          }
        )
      ).total,
      1
    );
  }
);

test(
  'create tanpa ID juga idempoten melalui fingerprint persisten pada proyek yang sama',
  () => {
    const env =
      environment();

    const record =
      env.specRecord({
        id: ''
      });

    const first =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',
            record
          }
        )
      );

    const writesAfterFirst =
      env.state.materialWrites;

    const retry =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',
            record
          }
        )
      );

    assert.equal(
      retry.deduplicated,
      true
    );

    assert.equal(
      retry.record.id,
      first.record.id
    );

    assert.equal(
      env.state.materialWrites,
      writesAfterFirst
    );

    assert.equal(
      env.plain(
        env.call(
          'listSpecs',
          {
            projectId:
              'proyek-alpha'
          }
        )
      ).total,
      1
    );
  }
);

test(
  'ID create sama dengan payload berbeda ditolak dan tidak mengubah record',
  () => {
    const env =
      environment();

    env.call(
      'saveSpec',
      {
        projectId:
          'proyek-alpha',

        record:
          env.specRecord()
      }
    );

    const writesBefore =
      env.state.materialWrites;

    assert.throws(
      () =>
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                title:
                  'Payload berbeda'
              })
          }
        ),
      /ID Spek sudah pernah dipakai dengan isi berbeda/
    );

    assert.equal(
      env.state.materialWrites,
      writesBefore
    );

    assert.equal(
      env.sandbox.utpGet_(
        'materialSpecs',
        'spek-0001'
      ).title,
      'Spek lantai'
    );
  }
);

test(
  'expectedVersion pada record yang tidak ada ditolak tanpa create terselubung',
  () => {
    const env =
      environment();

    assert.throws(
      () =>
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            expectedVersion:
              4,

            record:
              env.specRecord({
                id:
                  'spek-hilang1'
              })
          }
        ),
      /tidak ditemukan/
    );

    assert.equal(
      env.plain(
        env.call(
          'listSpecs',
          {
            projectId:
              'proyek-alpha'
          }
        )
      ).total,
      0
    );
  }
);

test(
  'audit gagal setelah create: record dibaca ulang, warning dikembalikan, dan tidak ada write kedua',
  () => {
    const env =
      environment();

    const before =
      env.state.materialWrites;

    env.state.failAuditCount =
      1;

    const result =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                id:
                  'spek-audit01',

                title:
                  'Audit create'
              })
          }
        )
      );

    assert.match(
      result.warning,
      /pencatatan audit gagal/i
    );

    assert.equal(
      result.record.id,
      'spek-audit01'
    );

    assert.equal(
      result.record.version,
      1
    );

    assert.equal(
      result.record.title,
      'Audit create'
    );

    assert.equal(
      env.state.materialWrites -
        before,
      1,
      'audit gagal tidak memicu write kedua'
    );

    assert.equal(
      env.sandbox.utpGet_(
        'materialSpecs',
        'spek-audit01'
      ).version,
      1
    );

    assert.equal(
      env.state.locks,
      0
    );
  }
);

test(
  'audit gagal setelah update: perubahan versi 2 tetap tersimpan, warning dikembalikan, tanpa write ulang',
  () => {
    const env =
      environment();

    const created =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                id:
                  'spek-audit02'
              })
          }
        )
      ).record;

    const before =
      env.state.materialWrites;

    env.state.failAuditCount =
      1;

    const result =
      env.plain(
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            expectedVersion:
              created.version,

            record: {
              ...created,
              title:
                'Audit update'
            }
          }
        )
      );

    assert.match(
      result.warning,
      /pencatatan audit gagal/i
    );

    assert.equal(
      result.record.version,
      2
    );

    assert.equal(
      result.record.title,
      'Audit update'
    );

    assert.equal(
      env.state.materialWrites -
        before,
      1,
      'audit gagal tidak memicu write kedua'
    );

    assert.equal(
      env.sandbox.utpGet_(
        'materialSpecs',
        created.id
      ).version,
      2
    );

    assert.equal(
      env.state.locks,
      0
    );
  }
);

test(
  'kegagalan write inti tetap dilempar dan tidak dilaporkan sebagai sukses',
  () => {
    const env =
      environment();

    env.state.failMaterialWriteCount =
      1;

    assert.throws(
      () =>
        env.call(
          'saveSpec',
          {
            projectId:
              'proyek-alpha',

            record:
              env.specRecord({
                id:
                  'spek-write01'
              })
          }
        ),
      /Material storage unavailable/
    );

    assert.equal(
      env.sandbox.utpGet_(
        'materialSpecs',
        'spek-write01'
      ),
      null
    );

    assert.equal(
      env.state.locks,
      0
    );
  }
);

test(
  'Spek tidak membuat atau menulis approval',
  () => {
    const env =
      environment();

    env.call(
      'saveSpec',
      {
        projectId:
          'proyek-alpha',

        record:
          env.specRecord()
      }
    );

    assert.deepEqual(
      env.plain(
        env.sandbox.utpRead_(
          'approvals'
        )
      ),
      []
    );
  }
);
