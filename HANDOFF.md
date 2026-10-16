# UTP implementation checkpoint — 2026-10-16

User authorized implementation/testing after extended brainstorming; goal broad contractor admin app, single admin, one project. User now concerned remaining token quota. No successful cloud push/deploy in this work. Preserve preexisting modified AGENTS.md.

## Actual state

- Existing Memo/RPB source remains active build. New UTP module NOT yet wired into build, Index, or MemoClient. New Auth.gs is also not yet in build; Memo.gs was changed to call it, so DO NOT push current staging until integration passes.
- `utp/UtpStyles.html`, `UtpView.html`: visual foundation only. No UtpClient.html yet. No integrated functional dashboard/browser test yet.
- `utp/UtpDomain.gs`: pure validation, approval matching, version rules, per-item history, manual revisions, partial approval, CSV, ordering forecasts, fund balances.
- `utp/Utp.gs`: draft Apps Script adapter apiUtp. Sheets record storage, master search/import, Drive upload, Gmail draft; known failures below.
- `shared/Auth.gs`: proposed owner long-password/salted hash login, six-digit PIN hashing, attempts throttle, cache sessions; untested. Memo.gs changed session/PIN helpers and reset-counter requires PIN. Old client still calls login without credentials: must fix before release.
- `tools/prepare_master_items.py`: completed/tested deterministic source-preserving converter. `.local/master/master_items.csv` has 28,473 original codes; 96 leading-zero codes; 14,029 explicit brands, 4,881 candidates, 9,563 unknown; no inferred generic. Source XLSX unchanged. Private CSV ignored by Git.
- `tools/build_code_graph.py`: completed structural Graphify map. `graphify-out/code-graph.json` 498 nodes/1,216 relations/14 unresolved externals at agent completion. Original graph.json retained. Query by function before reading source; refresh after later edits. No LLM extraction.
- Domain tests: 22/22 passed. Storage tests: 6/12 passed (agent report), remaining SIX failures known. No claim zero errors.

## Immediate fixes (root ownership)

1. Utp.gs importCommit incorrectly uses `utpParseCsv_` as array; actual return `{headers,rows}`. Prefer validated plan.items upsert (keeps absent fields/old codes), reject invalid before write. Two storage tests fail here.
2. Upload directory currently nested under existing archive, possibly public; create dedicated private root and enforce access. One test fails.
3. Protected FINAL/ARRIVED HO requests can lose finalFileId on save with PIN. Require registered PDF/JPEG/PNG evidence after edits for any request that reached HO. One test fails.
4. settings action missing. Must require PIN, keep settings in Sheets, use safe explicit field allowlist. One test fails.
5. Audit writes full before+after into one cell; >50k can fail AFTER main record save. Use bounded diffs/chunks, validate size ahead, avoid false success/error semantics. One test fails.
6. apiUtp validation context currently read before lock; refresh within mutation lock.
7. Auth ownerCheck_ uses UserLock inside ScriptLock (not recursive script lock); test session invalidation, missing config, attempts/expiry. Configure credentials only via private editor helper configureOwnerAccess_ reading temporary Script Properties APP_LOGIN_PASSWORD>=24chars/DELETE_PIN six new digits, hashes then deletes plaintext. Do not set arbitrary production passwords.
8. Integrate shared/Auth.gs + utp domain/server/view/styles/client into both build scripts; add login dialog and new navigation, retain legacy Memo/RPB flows. Update reset-counter client PIN call. Never use demo data as fallback for cloud failures.

## Copilot delegation

Sent successfully through `code chat --reuse-window --mode agent --add-file .local/copilot/TASK.md ...`.
Cannot confirm Copilot execution until `.local/copilot/RPB-RESULT.md` appears.
Copilot owns ONLY `rpb/*`, `tests/rpb-contract.test.js`, and that report. Do not concurrently edit those files. It audits/fixes RPB and runs local tests. No cloud writes/deploy.

## Key product constraints

- Terrasentra Bandung, PM Juhana, project TRSM-51D26-D-M. Sole admin.
- Material request -> PM -> MK -> HO as applicable; user sets required authority PM/MK/HO. Partial approval permitted. HO final requires uploaded PDF/scan. No reapproval MK after HO changes. Receipt of goods is only ARRIVED (warehouse handles quantities/damage).
- Single business record per request; REV changes only explicit published superior revision with actor PM/MK/HO and reason. Initial/final outputs, intermediate revision history internal. Number manual until official format known.
- Master official code/name preserved, aliases only search. Brands inferred cautiously from comma then before |/#; never equate empty/unknown with generic. Generic needs approval. Approved candidates ranked first. Outside approved brand allowed with reason, visible red warning, exception authority. By Owner skips approval.
- Telegram reminders weekdays 08/13/16 Jakarta including public holidays. Tasks selectively complete, evidence optional; reopen/delete critical requires PIN. Bot simple tasks/photo notes, web central. Not configured/implemented yet.
- Notes OCR draft only until human verifies; no material spend in RPB/RPD/LPD. User holds funds; vendor or PM recipients. Finance rule support exists, no complete OCR/LPD flow yet.
- Routine purchasing charts (galon etc.) use order history, not claim actual consumption/remaining stock. <3 distinct order dates insufficient. Forecast script first, AI optional. No automatic purchasing.
- No extra paid AI service, API keys, plugins needed just to finish local app. Use focused code queries; max2 subagents, compact handoffs.

## Resume commands

`node --test tests/utp-domain.test.js tests/utp-storage.test.js`

`python tools/build_code_graph.py --query apiUtp --budget 1200`

`python tools/prepare_master_items.py --self-test`

Live Apps Script identity/file list comparison still unverified. `.clasp.json` has existing target. Cloud audit agent encountered HTML instead of API JSON and then quota limit; never interpret as verified cloud match. Source authentication problem confirmed; no production correction deployed.

Remaining modules/document exports, Telegram/OCR/backup and UI are unfinished. This checkpoint covers work in this implementation session, not a verified full transcript archive.
