/**
 * LangQuest attachment sync pipeline — XState v5 model for stately.ai
 * =====================================================================
 *
 * Paste this whole file into the Stately editor ("Import" → "Code").
 * Then open the simulator and send PUBLISH_QUEST (or RECORD_AUDIO_SAVED)
 * to watch the full cascade. Delays are in the `delays` block so you can
 * tweak them to match measured timings.
 *
 * WHAT THIS MODELS (with source references):
 *
 *  Region `idsWatcher`
 *    PermAttachmentQueue.onAttachmentIdsChange (PermAttachmentQueue.ts:71)
 *      - drizzle watch over ALL of asset_synced JOIN asset_content_link_synced
 *        (no per-quest scoping) → fires on ANY change to those tables,
 *        including every audio_uploaded_at / uploaded_at stamp synced down.
 *      - 2s debounce, then emits the FULL list of attachment ids.
 *    AbstractSharedAttachmentQueue.watchAttachmentIds (:139)
 *      - loads ALL attachment rows (SELECT *), then per id:
 *          Array.find over all rows  → O(N²) total
 *          storage.fileExists(stat)  → N filesystem stats PER PASS
 *          missing rows → INSERT (QUEUED_SYNC), no-local-file → UPDATE.
 *      ⚠ HAZARD 1: cost scales quadratically; with tens of thousands of
 *        attachments a single pass takes minutes of JS-thread time and it
 *        re-runs after every checkpoint (see feedback loop below).
 *
 *  Region `uploadTrigger` / `downloadTrigger`
 *    idsToUpload / idsToDownload SQL watches (AbstractAttachmentQueue.js:260,318)
 *    with app-side debounces (AbstractSharedAttachmentQueue.ts:731,711):
 *    5000ms for uploads, 500ms for downloads. Every write to the attachments
 *    table re-fires both watches.
 *
 *  Region `uploader`
 *    uploadRecordsWithProgress (AbstractSharedAttachmentQueue.ts:574)
 *    - STRICTLY SERIAL while-loop; per file:
 *        getNextUploadRecord (SQL) → fs stat → readFile as base64 (CPU)
 *        → SupabaseStorageAdapter.uploadFile:
 *            ⚠ HAZARD 2: .list('', {search}) HTTP round trip BEFORE every
 *              .upload() HTTP round trip (SupabaseStorageAdapter.ts:40-60)
 *        → update(state=SYNCED) → re-fires both table watches.
 *    - concurrent triggers are dropped ("[UPLOAD TRIGGER] ... skipping").
 *
 *  Region `downloader`
 *    downloadRecordsWithProgress (AbstractSharedAttachmentQueue.ts:397)
 *    - drains QUEUED_DOWNLOAD **and QUEUED_SYNC** ids (25-way concurrent).
 *    ⚠ HAZARD 3 (correctness!): QUEUED_SYNC records appear in BOTH the
 *      upload and download queries. downloadRecord (AbstractAttachmentQueue
 *      .js:217) marks a record SYNCED merely because the LOCAL file exists —
 *      WITHOUT uploading it. If the download loop reaches a QUEUED_SYNC
 *      record before the serial upload loop does, the file is silently
 *      stranded: state=SYNCED locally, never sent to the server.
 *      Likely root cause for devices whose files "never arrive".
 *
 *  Region `serverSync`
 *    Each storage.objects INSERT fires the audio_uploaded_at trigger →
 *    acl row UPDATE → PowerSync checkpoint → client applies → synced tables
 *    change → idsWatcher re-fires.
 *    ⚠ HAZARD 4: feedback loop — EVERY uploaded file schedules another
 *      full O(N²)+N-stats rescan (absorbed only partially by the 2s debounce
 *      while uploads are slower than the debounce window).
 *
 *  Region `periodicTrigger`
 *    Base-class setInterval(30s) → trigger() → uploadRecords +
 *    downloadRecords + expireCache (AbstractAttachmentQueue.js:45-55).
 *    ⚠ HAZARD 5: PermAttachmentQueue.expireCache (:220) deletes local files
 *      of ARCHIVED permanent attachments, and onUploadError archives on
 *      non-retryable errors (system.ts) — an RLS/auth hiccup can delete a
 *      local file that was never uploaded.
 */

import { assign, raise, setup } from 'xstate';

export const machine = setup({
  types: {
    context: {} as {
      /** Files waiting in QUEUED_UPLOAD / QUEUED_SYNC with a local file. */
      pendingUploads: number;
      /** Files confirmed uploaded to Supabase Storage. */
      uploaded: number;
      /** HAZARD 3: files marked SYNCED by the download loop without upload. */
      strandedWithoutUpload: number;
      /** Full id-list reconcile passes (each = N fs stats + O(N²) finds). */
      fullRescans: number;
      /** "[UPLOAD TRIGGER] Upload already in progress, skipping" count. */
      skippedUploadTriggers: number;
      /** Total attachments on device — drives rescan cost. */
      totalAttachmentsOnDevice: number;
    },
    events: {} as
      | { type: 'PUBLISH_QUEST' } // publishQuest(): crud flush + N saveAudio()
      | { type: 'RECORD_AUDIO_SAVED' } // saveAudio() → saveToQueue(QUEUED_UPLOAD)
      | { type: 'SYNCED_TABLE_CHANGED' } // asset / asset_content_link change
      | { type: 'ATTACHMENT_TABLE_WRITE' } // any write to local attachments table
      | { type: 'TRY_UPLOAD' } // uploadRecordsWithProgress() invoked
      | { type: 'TRY_DOWNLOAD' } // downloadRecordsWithProgress() invoked
      | { type: 'SERVER_OBJECT_CREATED' } // storage.objects INSERT landed
  },
  guards: {
    hasPendingUploads: ({ context }) => context.pendingUploads > 0,
    // The race only strands a file when an un-uploaded QUEUED_SYNC record
    // with a local file is drained by the download loop first.
    downloadLoopWinsRace: ({ context }) => context.pendingUploads > 0
  },
  delays: {
    // Debounces (from code)
    IDS_DEBOUNCE: 2000, // PermAttachmentQueue DEBOUNCE_MS
    UPLOAD_DEBOUNCE: 5000, // UPLOAD_BATCH_DELAY_MS
    DOWNLOAD_DEBOUNCE: 500, // DOWNLOAD_BATCH_DELAY_MS
    PERIODIC_TRIGGER: 30000, // base-class syncInterval

    // Per-file upload costs (measured/estimated, tweak to match device)
    SQL_QUERY: 15, // getNextUploadRecord / update
    FS_STAT: 5, // storage.fileExists
    READ_FILE_BASE64: 150, // readFile(EncodingType.Base64) of a WAV
    HTTP_LIST_CHECK: 300, // ⚠ pre-upload .list() existence check
    HTTP_UPLOAD_PUT: 450, // actual .upload()

    // Crud + server side
    HTTP_CRUD_BATCH: 800, // apply_table_mutation_transaction
    SERVER_TRIGGER_STAMP: 50, // audio_uploaded_at trigger fires
    CHECKPOINT_ROUND_TRIP: 400, // checkpoint sync down + apply

    // ⚠ Scales with totalAttachmentsOnDevice: SELECT * of all rows +
    // per-id Array.find (O(N²)) + per-id fs stat. ~3s at 14 files is
    // instant; at 30k files this is MINUTES of JS-thread time.
    FULL_RESCAN: 3000,

    DOWNLOAD_DRAIN: 600 // one download-loop drain pass
  }
}).createMachine({
  id: 'attachmentPipeline',
  type: 'parallel',
  context: {
    pendingUploads: 0,
    uploaded: 0,
    strandedWithoutUpload: 0,
    fullRescans: 0,
    skippedUploadTriggers: 0,
    totalAttachmentsOnDevice: 14 // set to 30000 for the big-device scenario
  },
  states: {
    /* ------------------------------------------------------------------ *
     * Entry points: publish flow / single recording                       *
     * ------------------------------------------------------------------ */
    publishFlow: {
      description:
        'utils/publishQuest.ts — copies *_local rows into *_synced, strips local/ prefix from audio names, calls saveAudio() per file, then PowerSync uploads the crud batch.',
      initial: 'idle',
      states: {
        idle: {
          on: {
            PUBLISH_QUEST: 'flushingLocalToSynced',
            RECORD_AUDIO_SAVED: {
              // saveToQueue(QUEUED_UPLOAD) triggers upload immediately,
              // bypassing the 5s debounce (AbstractSharedAttachmentQueue:326)
              actions: [
                assign({
                  pendingUploads: ({ context }) => context.pendingUploads + 1,
                  totalAttachmentsOnDevice: ({ context }) =>
                    context.totalAttachmentsOnDevice + 1
                }),
                raise({ type: 'ATTACHMENT_TABLE_WRITE' }),
                raise({ type: 'TRY_UPLOAD' })
              ]
            }
          }
        },
        flushingLocalToSynced: {
          description:
            'SQLite transaction: INSERT INTO *_synced SELECT FROM *_local; saveAudio() per audio file (each fires an immediate TRY_UPLOAD that gets skipped while one runs).',
          entry: [
            assign({
              pendingUploads: ({ context }) => context.pendingUploads + 7,
              totalAttachmentsOnDevice: ({ context }) =>
                context.totalAttachmentsOnDevice + 7
            }),
            raise({ type: 'ATTACHMENT_TABLE_WRITE' }),
            raise({ type: 'TRY_UPLOAD' }),
            raise({ type: 'SYNCED_TABLE_CHANGED' })
          ],
          after: { SQL_QUERY: 'uploadingCrudBatch' }
        },
        uploadingCrudBatch: {
          description:
            'PowerSync uploadData → apply_table_mutation_transaction RPC (22 ops). Server BEFORE INSERT triggers stamp uploaded_at (+ audio_uploaded_at when the object already exists).',
          after: { HTTP_CRUD_BATCH: 'checkpointAfterCrud' }
        },
        checkpointAfterCrud: {
          description:
            'Server checkpoint syncs the stamped rows back down → synced tables change → idsWatcher will re-fire.',
          entry: raise({ type: 'SYNCED_TABLE_CHANGED' }),
          after: { CHECKPOINT_ROUND_TRIP: 'idle' }
        }
      }
    },

    /* ------------------------------------------------------------------ *
     * onAttachmentIdsChange + watchAttachmentIds                          *
     * ------------------------------------------------------------------ */
    idsWatcher: {
      description:
        'PermAttachmentQueue.onAttachmentIdsChange: drizzle watch over ALL asset images + acl audio (entire tables, unscoped). Debounce 2s, then full reconcile.',
      initial: 'idle',
      states: {
        idle: {
          on: { SYNCED_TABLE_CHANGED: 'debouncing' }
        },
        debouncing: {
          description: 'DEBOUNCE_MS = 2000; restarted by every table change.',
          on: {
            SYNCED_TABLE_CHANGED: { target: 'debouncing', reenter: true }
          },
          after: { IDS_DEBOUNCE: 'reconciling' }
        },
        reconciling: {
          description:
            '⚠ HAZARD 1 — watchAttachmentIds: SELECT * of every attachment row, then per id: Array.find (O(N²) total) + fs stat (N stats). Missing ids → INSERT QUEUED_SYNC; missing local file → UPDATE QUEUED_DOWNLOAD. Cost scales with total attachments, runs after EVERY checkpoint.',
          entry: assign({
            fullRescans: ({ context }) => context.fullRescans + 1
          }),
          exit: raise({ type: 'ATTACHMENT_TABLE_WRITE' }),
          after: { FULL_RESCAN: 'idle' }
        }
      }
    },

    /* ------------------------------------------------------------------ *
     * idsToUpload SQL watch (5s debounce)                                 *
     * ------------------------------------------------------------------ */
    uploadTrigger: {
      description:
        'watchUploads: SQL watch on attachments table (QUEUED_UPLOAD | QUEUED_SYNC with local_uri). Every attachment write re-fires it; 5s accumulation debounce.',
      initial: 'idle',
      states: {
        idle: {
          on: { ATTACHMENT_TABLE_WRITE: 'debouncing' }
        },
        debouncing: {
          on: {
            ATTACHMENT_TABLE_WRITE: { target: 'debouncing', reenter: true }
          },
          after: {
            UPLOAD_DEBOUNCE: {
              target: 'idle',
              actions: raise({ type: 'TRY_UPLOAD' })
            }
          }
        }
      }
    },

    /* ------------------------------------------------------------------ *
     * The serial upload loop                                              *
     * ------------------------------------------------------------------ */
    uploader: {
      description:
        'uploadRecordsWithProgress: single serial while-loop. Every per-file step below happens on the JS thread that is also running the rescans.',
      initial: 'idle',
      // Any TRY_UPLOAD while busy = "[UPLOAD TRIGGER] skipping"
      on: {
        TRY_UPLOAD: {
          actions: assign({
            skippedUploadTriggers: ({ context }) =>
              context.skippedUploadTriggers + 1
          })
        }
      },
      states: {
        idle: {
          on: { TRY_UPLOAD: 'countingQueue' }
        },
        countingQueue: {
          description: 'SELECT COUNT(*) of queued records (progress total).',
          after: { SQL_QUERY: 'fetchingNextRecord' }
        },
        fetchingNextRecord: {
          description: 'getNextUploadRecord: SELECT ... ORDER BY timestamp.',
          after: {
            SQL_QUERY: [
              { guard: 'hasPendingUploads', target: 'statLocalFile' },
              { target: 'finished' }
            ]
          }
        },
        statLocalFile: {
          description: 'storage.fileExists(localUri).',
          after: { FS_STAT: 'readingFileBase64' }
        },
        readingFileBase64: {
          description:
            'readFile as base64 — CPU on JS thread; WAVs are uncompressed so this is not trivial.',
          after: { READ_FILE_BASE64: 'httpListExistenceCheck' }
        },
        httpListExistenceCheck: {
          description:
            "⚠ HAZARD 2 — SupabaseStorageAdapter.uploadFile first calls storage.list('', {search: filename}) — a full extra HTTP round trip before EVERY upload (RLS-upsert workaround). Could be replaced by upsert:false + handling the 409 'Duplicate' error the queue already understands.",
          after: { HTTP_LIST_CHECK: 'httpUploadPut' }
        },
        httpUploadPut: {
          description: 'The actual storage upload.',
          after: { HTTP_UPLOAD_PUT: 'markingSynced' }
        },
        markingSynced: {
          description:
            'update(state=SYNCED): SELECT + UPDATE on attachments table → re-fires idsToUpload AND idsToDownload watches. The new storage object also fires the server-side audio_uploaded_at trigger.',
          entry: [
            assign({
              pendingUploads: ({ context }) => context.pendingUploads - 1,
              uploaded: ({ context }) => context.uploaded + 1
            }),
            raise({ type: 'ATTACHMENT_TABLE_WRITE' }),
            raise({ type: 'SERVER_OBJECT_CREATED' })
          ],
          after: { SQL_QUERY: 'fetchingNextRecord' }
        },
        finished: {
          description: '"Finished uploading attachments"',
          always: 'idle'
        }
      }
    },

    /* ------------------------------------------------------------------ *
     * idsToDownload SQL watch (500ms debounce) + download loop            *
     * ------------------------------------------------------------------ */
    downloadTrigger: {
      description:
        'watchDownloads: SQL watch on QUEUED_DOWNLOAD | QUEUED_SYNC states — note QUEUED_SYNC overlaps with the upload query! 500ms debounce.',
      initial: 'idle',
      states: {
        idle: {
          on: { ATTACHMENT_TABLE_WRITE: 'debouncing' }
        },
        debouncing: {
          on: {
            ATTACHMENT_TABLE_WRITE: { target: 'debouncing', reenter: true }
          },
          after: {
            DOWNLOAD_DEBOUNCE: {
              target: 'idle',
              actions: raise({ type: 'TRY_DOWNLOAD' })
            }
          }
        }
      }
    },

    downloader: {
      description:
        'downloadRecordsWithProgress: drains the download queue with 25-way concurrency.',
      initial: 'idle',
      states: {
        idle: {
          on: { TRY_DOWNLOAD: 'draining' }
        },
        draining: {
          description:
            'Per id: record lookup → fs stat → if local file EXISTS, mark SYNCED without any network call; else HTTP download.',
          after: {
            DOWNLOAD_DRAIN: [
              {
                guard: 'downloadLoopWinsRace',
                target: 'strandedFileRace'
              },
              { target: 'idle' }
            ]
          }
        },
        strandedFileRace: {
          description:
            '⚠ HAZARD 3 — a QUEUED_SYNC record with a local file that has NOT been uploaded yet is marked SYNCED by downloadRecord (local file exists → state=SYNCED, no upload). The file never reaches the server and nothing will retry it. Whether this fires depends on timing: the download loop (500ms debounce, concurrent) vs the serial upload loop (5s debounce, one file at a time). With tens of thousands of queued files the upload loop is hours behind — the download loop almost always wins.',
          entry: [
            assign({
              strandedWithoutUpload: ({ context }) =>
                context.strandedWithoutUpload + 1,
              pendingUploads: ({ context }) =>
                Math.max(0, context.pendingUploads - 1)
            }),
            raise({ type: 'ATTACHMENT_TABLE_WRITE' })
          ],
          always: 'idle'
        }
      }
    },

    /* ------------------------------------------------------------------ *
     * Server side: storage trigger → checkpoint → back to the client      *
     * ------------------------------------------------------------------ */
    serverSync: {
      description:
        '⚠ HAZARD 4 — the feedback loop. Every uploaded object: storage.objects INSERT → audio_uploaded_at trigger UPDATEs the acl row → PowerSync checkpoint → client applies → asset_content_link_synced changes → idsWatcher debounce restarts → another FULL rescan.',
      initial: 'idle',
      states: {
        idle: {
          on: { SERVER_OBJECT_CREATED: 'stampingAclViaTrigger' }
        },
        stampingAclViaTrigger: {
          description:
            'AFTER INSERT ON storage.objects → set_acl_audio_uploaded_at_from_object (GIN-indexed acl.audio ? name lookup).',
          after: { SERVER_TRIGGER_STAMP: 'checkpointRoundTrip' }
        },
        checkpointRoundTrip: {
          description:
            'PowerSync pushes a new checkpoint with the stamped acl row; client validates + applies ("Validated and applied checkpoint").',
          entry: raise({ type: 'SYNCED_TABLE_CHANGED' }),
          after: { CHECKPOINT_ROUND_TRIP: 'idle' }
        }
      }
    },

    /* ------------------------------------------------------------------ *
     * 30s periodic retry (base class)                                     *
     * ------------------------------------------------------------------ */
    periodicTrigger: {
      description:
        'AbstractAttachmentQueue.init: setInterval(30s) → trigger() → uploadRecords + downloadRecords + expireCache. ⚠ HAZARD 5: PermAttachmentQueue.expireCache DELETES local files of ARCHIVED permanent attachments; onUploadError archives on non-retryable errors (RLS, "already exists") — an auth/RLS hiccup can delete a never-uploaded local file.',
      initial: 'waiting',
      states: {
        waiting: {
          after: { PERIODIC_TRIGGER: 'firing' }
        },
        firing: {
          entry: [
            raise({ type: 'TRY_UPLOAD' }),
            raise({ type: 'TRY_DOWNLOAD' })
          ],
          always: 'waiting'
        }
      }
    }
  }
});
