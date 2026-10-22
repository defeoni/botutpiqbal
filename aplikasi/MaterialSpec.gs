/* Spek material per proyek. Tidak memiliki bulan, periode, RAP, atau approval.
 * Create idempoten memakai fingerprint persisten pada record.
 * Jika utpWrite_ sudah menulis data lalu audit gagal, record dibaca ulang dan
 * dikembalikan sebagai sukses dengan warning tanpa write kedua. */

var SPEK_ENTITY = 'materialSpecs';
var SPEK_MAX_ITEMS = 100;
var SPEK_MAX_BRANDS = 10;

function spekText_(value, label, max, required) {
  return utpText_(value, label, max, required);
}

function spekOptionalPrice_(value, label) {
  var text = value == null ? '' : String(value).trim();

  if (!text) return null;

  if (
    typeof value !== 'number' &&
    !/^\d+(?:\.\d+)?$/.test(text)
  ) {
    throw new Error(
      label + ' harus berupa angka biasa atau dikosongkan.'
    );
  }

  var number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > 1e12
  ) {
    throw new Error(
      label +
      ' harus antara 0 dan 1 triliun, atau dikosongkan.'
    );
  }

  return number;
}

function spekActiveProject_(requested) {
  var id = workspaceProjectId_(requested, false);

  if (id === 'legacy') {
    throw new Error(
      'Proyek harus tersimpan dan aktif untuk Spek.'
    );
  }

  var project = utpGet_(
    'workspaceProjects',
    id
  );

  if (
    !project ||
    project.archived
  ) {
    throw new Error(
      'Proyek harus tersimpan dan aktif untuk Spek.'
    );
  }

  return id;
}

function spekValidateCatalog_(items) {
  var master = utpMaster_();
  var codes = {};

  master.forEach(function (row) {
    codes[utpNorm_(row.code)] = true;
  });

  items.forEach(function (item, index) {
    if (
      !codes[
        utpNorm_(item.catalogCode)
      ]
    ) {
      throw new Error(
        'Item ke-' +
        (index + 1) +
        ': kode katalog "' +
        item.catalogCode +
        '" tidak ditemukan di katalog master.'
      );
    }
  });
}

function specNormalizeRecord_(
  input,
  projectId
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'Rekaman Spek tidak valid.'
    );
  }

  var record = {
    id: spekText_(
      input.id,
      'ID Spek',
      100,
      false
    ),

    projectId: projectId,

    title: spekText_(
      input.title,
      'Judul Spek',
      200,
      true
    ),

    note: spekText_(
      input.note,
      'Catatan Spek',
      2000,
      false
    ),

    items: [],
    archived: false
  };

  if (
    record.id &&
    !/^[a-zA-Z0-9_-]{8,100}$/.test(
      record.id
    )
  ) {
    throw new Error(
      'ID Spek tidak valid.'
    );
  }

  var rawItems = utpArray_(
    input.items,
    'Item Spek',
    SPEK_MAX_ITEMS
  );

  if (!rawItems.length) {
    throw new Error(
      'Spek membutuhkan minimal satu item.'
    );
  }

  var seen = {};

  rawItems.forEach(
    function (source, index) {
      if (
        !source ||
        typeof source !== 'object' ||
        Array.isArray(source)
      ) {
        throw new Error(
          'Item ke-' +
          (index + 1) +
          ' tidak valid.'
        );
      }

      var item = {
        catalogCode: spekText_(
          source.catalogCode,
          'Kode katalog',
          60,
          true
        ),

        name: spekText_(
          source.name,
          'Nama barang',
          200,
          true
        ),

        specification: spekText_(
          source.specification,
          'Spesifikasi/ukuran',
          500,
          true
        ),

        unit: spekText_(
          source.unit,
          'Satuan',
          40,
          true
        ),

        brands: utpStrings_(
          source.brands,
          'Kandidat merek',
          SPEK_MAX_BRANDS
        ),

        price: spekOptionalPrice_(
          source.price,
          'Harga referensi'
        ),

        note: spekText_(
          source.note,
          'Catatan item',
          1000,
          false
        )
      };

      var key =
        utpNorm_(item.catalogCode) +
        '|' +
        utpNorm_(item.specification);

      if (seen[key]) {
        throw new Error(
          'Barang "' +
          item.catalogCode +
          '" dengan ukuran yang sama tercatat dua kali; ' +
          'gabungkan atau bedakan spesifikasinya.'
        );
      }

      seen[key] = true;

      record.items.push(item);
    }
  );

  spekValidateCatalog_(
    record.items
  );

  return record;
}

function spekCreateFingerprint_(
  record
) {
  var canonical = {
    projectId: record.projectId,
    title: record.title,
    note: record.note,
    items: record.items,
    archived: false
  };

  var digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify(canonical),
      Utilities.Charset.UTF_8
    );

  return Utilities.base64Encode(
    digest
  );
}

function spekFindCreateRetry_(
  projectId,
  fingerprint
) {
  return (
    utpRead_(
      SPEK_ENTITY,
      true
    ).find(function (row) {
      return (
        !row.archived &&
        row.projectId === projectId &&
        row.createFingerprint ===
          fingerprint
      );
    }) ||
    null
  );
}

function spekWriteRecord_(
  record,
  expectedVersion
) {
  try {
    return {
      record: utpWrite_(
        SPEK_ENTITY,
        record,
        expectedVersion
      )
    };
  } catch (error) {
    if (!error.recordSaved) {
      throw error;
    }

    var stored = utpGet_(
      SPEK_ENTITY,
      record.id
    );

    if (!stored) {
      throw new Error(
        'Data Spek dilaporkan tersimpan tetapi tidak dapat dibaca ulang ' +
        'setelah audit gagal. Muat ulang sebelum mencoba lagi.'
      );
    }

    return {
      record: stored,
      warning: error.message
    };
  }
}

function apiMaterialSpec(
  action,
  payload,
  token
) {
  requireAuthorized_(token);

  var p = payload || {};

  if (
    action === 'searchCatalog'
  ) {
    spekActiveProject_(
      p.projectId
    );

    var result =
      utpSearchItems_(
        utpMaster_(),
        p,
        []
      );

    return {
      items: result.items,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      hasMore: result.hasMore,
      brands: result.brands
    };
  }

  if (
    action === 'listSpecs'
  ) {
    var projectId =
      spekActiveProject_(
        p.projectId
      );

    var limit =
      Math.max(
        1,
        Math.min(
          100,
          Number(p.limit) || 100
        )
      );

    var offset =
      p.offset == null
        ? 0
        : Number(p.offset);

    if (
      !Number.isSafeInteger(
        offset
      ) ||
      offset < 0
    ) {
      throw new Error(
        'Posisi halaman tidak valid.'
      );
    }

    var query =
      utpNorm_(
        p.query || ''
      );

    var rows =
      utpRead_(
        SPEK_ENTITY
      )
      .filter(
        function (row) {
          if (
            row.projectId !==
            projectId
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          var itemText =
            (row.items || [])
            .map(
              function (item) {
                return [
                  item.name,
                  item.catalogCode,
                  item.specification,
                  item.unit
                ]
                .concat(
                  item.brands || []
                )
                .join(' ');
              }
            );

          var haystack =
            utpNorm_(
              [
                row.title,
                row.note
              ]
              .concat(itemText)
              .join(' ')
            );

          return (
            haystack.indexOf(
              query
            ) >= 0
          );
        }
      )
      .sort(
        function (a, b) {
          return (
            String(
              b.updatedAt || ''
            ).localeCompare(
              String(
                a.updatedAt || ''
              )
            ) ||
            String(
              a.title || ''
            ).localeCompare(
              String(
                b.title || ''
              ),
              'id'
            )
          );
        }
      );

    return {
      records: rows.slice(
        offset,
        offset + limit
      ),

      total: rows.length,
      offset: offset,
      limit: limit,

      hasMore:
        offset + limit <
        rows.length
    };
  }

  if (
    action === 'saveSpec'
  ) {
    var saveProjectId =
      spekActiveProject_(
        p.projectId
      );

    var desired =
      specNormalizeRecord_(
        p.record || {},
        saveProjectId
      );

    var hasExpectedVersion =
      p.expectedVersion != null &&
      String(
        p.expectedVersion
      ).trim() !== '';

    var lock =
      LockService.getScriptLock();

    lock.waitLock(30000);

    try {
      var existing =
        desired.id
          ? utpGet_(
              SPEK_ENTITY,
              desired.id
            )
          : null;

      var fingerprint =
        spekCreateFingerprint_(
          desired
        );

      if (existing) {
        if (
          existing.archived
        ) {
          throw new Error(
            'Spek tersebut sudah diarsipkan.'
          );
        }

        if (
          existing.projectId !==
          saveProjectId
        ) {
          throw new Error(
            'Spek tersebut milik proyek lain; ' +
            'pemindahan lintas proyek tidak diizinkan.'
          );
        }

        /*
         * Tidak ada expectedVersion berarti ini diperlakukan
         * sebagai retry create, bukan update.
         */
        if (
          !hasExpectedVersion
        ) {
          if (
            existing.createFingerprint &&
            existing.createFingerprint ===
              fingerprint
          ) {
            return {
              record: existing,
              deduplicated: true
            };
          }

          throw new Error(
            'ID Spek sudah pernah dipakai dengan isi berbeda. ' +
            'Gunakan ID baru.'
          );
        }

        var expectedVersion =
          Number(
            p.expectedVersion
          );

        if (
          !Number.isSafeInteger(
            expectedVersion
          ) ||
          expectedVersion < 1
        ) {
          throw new Error(
            'Versi yang diharapkan wajib berupa bilangan bulat ' +
            'minimal 1 untuk memperbarui Spek.'
          );
        }

        if (
          existing.version !==
          expectedVersion
        ) {
          return {
            conflict: true,
            record: existing
          };
        }

        desired.id =
          existing.id;

        /*
         * Fingerprint create adalah metadata internal persisten.
         * Update tidak menghapusnya.
         */
        if (
          existing.createFingerprint
        ) {
          desired.createFingerprint =
            existing.createFingerprint;
        }

        return spekWriteRecord_(
          desired,
          existing.version
        );
      }

      if (
        hasExpectedVersion
      ) {
        throw new Error(
          'Spek yang akan diperbarui tidak ditemukan. ' +
          'Muat ulang data sebelum menyimpan.'
        );
      }

      /*
       * Jika client tidak membawa ID stabil, payload create yang
       * identik tetap dapat dikenali secara persisten dalam proyek
       * yang sama lewat fingerprint.
       */
      if (!desired.id) {
        var retry =
          spekFindCreateRetry_(
            saveProjectId,
            fingerprint
          );

        if (retry) {
          return {
            record: retry,
            deduplicated: true
          };
        }

        desired.id =
          Utilities.getUuid();
      }

      desired.createFingerprint =
        fingerprint;

      return spekWriteRecord_(
        desired,
        0
      );
    } finally {
      lock.releaseLock();
    }
  }

  throw new Error(
    'Tindakan Spek tidak dikenal: ' +
    action
  );
}

function spekFindOrphans_() {
  var known =
    utpRead_(
      'workspaceProjects',
      true
    ).map(
      function (project) {
        return project.id;
      }
    );

  return utpRead_(
    SPEK_ENTITY,
    true
  )
  .filter(
    function (row) {
      return (
        known.indexOf(
          row.projectId
        ) < 0
      );
    }
  )
  .map(
    function (row) {
      return {
        id: row.id,
        projectId:
          row.projectId,
        title: row.title
      };
    }
  );
}
