# Library Template System — Proposal

The third template system: study/reference material stored in the LangQuest DB as structured, versioned, per-language content. This is the "library" the [process template system](./review-template-system.md) reserves the name for — *the material the team reads*, vs the journal (what the team writes) and the content template (what the team translates).

FIA is the first source and the proving ground: this proposal inventories the mechanisms FIA's API actually uses, generalizes each one, and defines an **adapter contract** so other partners' APIs can be plugged in the same way. FIA gets a custom adapter; the template structure itself stays partner-agnostic.

Status: **proposal** — for review against the content and process template docs.

---

## What FIA actually is, structurally

From `fia/api_docs.md` and scraped output (`fia/output/pericope_gen-p2.json`):

```
Testament → Book → Pericope → Step (×6)            ← language-agnostic "reference" skeleton
                     │
                     ├── Terms (glossary entries)   ← flat, shared catalogs attached
                     ├── MediaItems → MediaAssets       to pericopes by reference
                     └── Maps → MapFeatures
```

Each **reference node** is language-agnostic (one `Pericope` node `gen-p2`; one `Step` node `hear-and-heart`). Language enters through **translations/renderings**: a `StepRendering` sits at the intersection of (pericope × step × language) and carries the actual text and audio. 15 target languages means 15 renderings of every step of every pericope. The same reference/translation split repeats for terms, media items, and maps.

## The mechanisms FIA uses (and what each generalizes to)

| # | FIA mechanism | Observed in API | Generalized as |
|---|---|---|---|
| M1 | Language-agnostic skeleton vs per-language content | `Pericope`/`Step` (references) vs `StepRendering`/`*Translation` | **Structure lives in the template; content lives in per-(node × languoid × version) rows.** The template never contains prose. |
| M2 | Hierarchical navigation tree | Testament → Book → Pericope → Step | Library template JSONB tree, arbitrary `node_type`s, same architecture as content templates (nanoid IDs, depth ≤ 5, tombstones) |
| M3 | Flat referenceable catalogs | Terms, MediaItems, Maps — shared corpus-wide, *attached* to pericopes | **Catalogs**: flat node sets in the same template, distinct from the tree; tree nodes reference catalog items |
| M4 | Cross-references between nodes | `Term EXISTS_IN Pericope`, `MediaItem ILLUSTRATES_PERICOPE`, `Map ILLUSTRATES_PERICOPE` | `refs` on tree nodes: typed edges to catalog node IDs (`term`, `illustration`, `map`, …) |
| M5 | Inline references inside text | Markdown links `[水果](#m387)`, `[#c47]` maps, `[#t63]` terms | Canonical inline node-reference in the rich-text format: `{ "type": "node-ref", "node_id": "…" }` — adapter rewrites partner syntax |
| M6 | Structured rich text | `textAsJson` blocks: `paragraph`, `heading`+level, `callout`+style+title, lists, `bring-attention` | A canonical **block format** (small, versioned with `format_version`), adapter converts partner formats into it |
| M7 | Action prompts embedded in content | `callout style="action"` — "pause the audio here and …" | First-class `action` block — the app can render pause-and-do-activity UX generically |
| M8 | Multi-format media with variants | audio `vbr0/vbr4/vbr6/cbr32`, images `original/500`, PDF+image maps | Content-row **attachments** with kind + variants, reusing the existing attachment/download-profile infrastructure |
| M9 | Alignment to scripture | `startChapter/startVerse/endChapter/endVerse` (+`portion`) on Pericope | **Alignment metadata** on tree nodes — declarative semantic coordinates used to align library nodes with *content-template* node ranges |
| M10 | Ordering + stable-ID splits | `sequence` + `split` ("p1" → "p1a"/"p1b" so other IDs never change) | Order = array position in the tree (like content templates); splits = new sibling nodes; upstream IDs preserved in `metadata` for idempotent re-import |
| M11 | Per-language, per-node versioning | `versionMajor/Minor/Patch` on `PericopeTranslation` and `StepRendering` (e.g. eng v2.1 while cmn is v2) | Monotonic version on **content rows**; upstream semver preserved in row metadata. Structural change = template fork (existing model) |
| M12 | Discontinuation | `dateDiscontinued` | `deleted: true` tombstones (structure) / superseded content rows (content) — both already exist |
| M13 | Partner workflow metadata | `dateCompleteScript1/2`, `dateCompleteAudio1/2`, consultant-check status | **Ignored by the schema** — adapter-side concerns; anything worth keeping goes in `metadata` |

The headline observation: FIA independently arrived at the same core split LangQuest already uses — *immutable shared structure with stable opaque IDs, language content attached per node*. Almost nothing here requires new invention; it requires placing each FIA mechanism into existing LangQuest machinery.

---

## Proposed design

### The big decision: structure in the template, content in rows

A Bible-sized *content* template (~31k nodes, names only) is already ~4MB. FIA content is prose: six steps × ~3,000 pericopes × 15 languages, plus term articles, media descriptions, and audio. Inlining content into the template JSONB would blow past PowerSync's 15MB row limit immediately, and would force every device to sync every language.

So the library template follows M1 strictly:

- **`library_template.structure`** — the skeleton only: tree + catalogs + refs + alignment. Same JSONB/fork-always/website-only-editing model as the other two template systems. A skeleton for FIA's full corpus is roughly the same order of magnitude as the Bible content template — fine.
- **`library_content`** — one row per (node × languoid × version): the rendering. Rows are **immutable once published** (new version = new row). Devices sync only the rows for their project's configured languages and download profiles.

This also gives the process template system exactly what it assumed: anchors pin to an immutable rendering. An anchor records the **content row ID** — char offsets against an immutable row never rot, which is the version-pinning the anchoring design (W3C quote selectors) requires.

### Structure JSONB shape

Type definitions (mirroring `TemplateNode`/`TemplateStructure` on the content side and `WorkflowStructure` on the process side):

```typescript
type LibraryStructure = {
  format_version: number;
  root: LibraryNode;          // the navigation tree
  catalogs: LibraryCatalog[]; // flat referenceable sets (terms, media, maps)
};

type LibraryNode = {
  id: string;                 // nanoid(10), opaque, immutable
  name: string;               // label in the template's languoid
  node_type: string;          // open vocabulary — descriptive only, never branched on
  children?: LibraryNode[];   // order = array position
  refs?: LibraryRef[];        // typed edges to catalog items (M4)
  alignment?: Alignment;      // semantic coordinates into content-template space (M9)
  completable_hint?: boolean; // authoring hint for assignment generation — NOT a completion flag
  deleted?: boolean;          // tombstone
  metadata?: {
    upstream?: Record<string, unknown>; // partner IDs/fields for idempotent adapter re-runs
    [key: string]: unknown;
  };
};

type LibraryRef = {
  rel: 'term' | 'illustration' | 'map'; // closed enum, same admission rule as link_role
  node_id: string;                      // a catalog item's id
};

type Alignment = {
  scheme: string;             // e.g. "bible" — declared, not assumed
  [key: string]: unknown;     // scheme-specific coordinates; for "bible":
  // book: string;
  // start: { chapter: number; verse: number; portion?: string };
  // end:   { chapter: number; verse: number; portion?: string };
};

type LibraryCatalog = {
  id: string;
  kind: 'glossary' | 'media' | 'maps'; // closed enum (open question: collapse maps into media?)
  items: CatalogItem[];
};

type CatalogItem = {
  id: string;                 // nanoid(10) — refs and asset_link targets point here
  name: string;
  item_type?: string;         // e.g. 'photo' | 'video' | 'illustration' | 'diagram' (FIA asset types)
  deleted?: boolean;
  metadata?: LibraryNode['metadata'];
};
```

Example instance (FIA):

```jsonc
{
  "format_version": 1,
  "root": {
    "id": "root",
    "name": "FIA",
    "node_type": "root",
    "children": [
      {
        "id": "aB3xK9mQ2p",
        "name": "Genesis",
        "node_type": "book",
        "metadata": {
          "upstream": { "fia_id": "gen", "lineup": 1 }
        },
        "children": [
          {
            "id": "qW8rT5nZ1c",
            "name": "Genesis 2:4–25",
            "node_type": "section",
            "alignment": {
              "scheme": "bible",
              "book": "genesis",
              "start": { "chapter": 2, "verse": 4 },
              "end": { "chapter": 2, "verse": 25 }
            },
            "refs": [
              { "rel": "term", "node_id": "tHv7..." },         // heaven
              { "rel": "illustration", "node_id": "mOx4..." }, // onyx stones
              { "rel": "map", "node_id": "cEd9..." }           // garden of Eden
            ],
            "metadata": {
              "upstream": { "fia_id": "gen-p2", "sequence": 2, "split": null }
            },
            "children": [
              {
                "id": "sHh1...",
                "name": "Hear and Heart",
                "node_type": "step",
                "completable_hint": true
              },
              {
                "id": "sSt2...",
                "name": "Setting the Stage",
                "node_type": "step"
              }
              // … steps 3–6
            ]
          }
        ]
      }
    ]
  },
  "catalogs": [
    {
      "id": "catTerms",
      "kind": "glossary",
      "items": [
        {
          "id": "tHv7...",
          "name": "heaven",
          "metadata": {
            "upstream": { "fia_id": "t63" }
          }
        }
      ]
    },
    {
      "id": "catMedia",
      "kind": "media",
      "items": [
        { "id": "mOx4...", "name": "Onyx Stones", "item_type": "photo" }
      ]
    },
    {
      "id": "catMaps",
      "kind": "maps",
      "items": [
        { "id": "cEd9...", "name": "Garden of Eden" }
      ]
    }
  ]
}
```

Notes:

- **Node IDs** are nanoid(10), opaque, immutable — identical posture to content templates (C9/C10). Upstream IDs live in `metadata.upstream`, which is what makes adapter re-runs idempotent (the existing FIA cron refresh already works this way: tree-walk + metadata matching, no `external_id` column).
- **Names in the structure are labels in the template's languoid** (the library template has the same `source_languoid_id`-means-template-language semantics as content templates). Translated *names* are just more content: a content row against the node can carry the localized title — exactly FIA's `StepTranslation.title` / `BookTranslation.title`.
- **`refs` vs `children`**: FIA terms/media/maps are shared corpus-wide and attached to many pericopes — they can't be tree children. Catalogs hold them once; `refs` express the many-to-many (M3/M4). `rel` values start as a small enum (`term`, `illustration`, `map`); same admission rule as `link_role` in the process doc — a new rel must change UI behavior.
- **`alignment`** (M9) is a declared scheme + coordinates, not a hardcoded Bible assumption. `"scheme": "bible"` coordinates can be resolved against any content template whose nodes carry comparable semantics — this is how "this pericope = Gen 2:4–25" becomes "this library section relates to *that range of content-template nodes*" in a given project. Other partners may align by other schemes (e.g. story number) or not at all.
- **`completable_hint`** is *not* a completion flag — completion stays assignment-anchored (process doc, Option B). It's an optional authoring hint for the website when generating step assignments.

### Content rows

```
library_content
├── id (UUID, PK)
├── library_template_id (FK → library_template)   — the fork this row was published under
├── node_id (TEXT — opaque ID into the structure: tree node or catalog item)
├── languoid_id (FK → languoid)
├── version (INT, monotonic per node × languoid)
├── title (TEXT, nullable — localized node name, e.g. "聆听并铭记于心")
├── body (JSONB — canonical block format, see below)
├── body_plain (TEXT — derived, for search/quote re-anchoring)
├── attachments (JSONB — [{kind: 'audio'|'image'|'pdf', variant, url/ref, bytes}])
├── metadata (JSONB — upstream version info, e.g. {fia: {vId: "v2.1", major: 2, minor: 1}})
├── published_at
├── UNIQUE(node_id, languoid_id, version)
```

- Rows are **immutable**; superseding = inserting `version + 1`. The newest version per (node, languoid) is "current"; old rows are retained because anchors point at them.
- `node_id` is an application-validated string ref into shared JSONB — accepted pattern (content-template C2, process-template C4). Like `asset_link`, rows are validated in the write path with periodic orphan checks.
- Because node IDs are stable across template forks, content rows survive structural re-publishes without rewriting — the same property that lets quests survive content-template forks.
- **Why not reuse `asset` + `asset_content_link`?** Considered. Assets are project-scoped user contributions with votes, revision chains, and project sync bucketing; library content is global read-only partner material with its own version pinning. Forcing it into `asset` would bend project bucketing (library rows have no project), `content_type` semantics, and immutability guarantees. The clean analogy: `library_content` is to the library template what `quest`/`asset` rows are to the content template — the materialized layer — except here it's system-published, not user-created.

### Canonical block format (M6/M7/M5)

A small, versioned block vocabulary — essentially FIA's `textAsJson` with the partner-specific edges sanded off:

```typescript
type Block =
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'heading'; level: 1|2|3; content: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'callout'; style: string; title?: string; content: Block[] }
  | { type: 'action'; content: Block[] }                       // pause-and-do — first-class (M7)
  ;

type Inline =
  | string
  | { type: 'emphasis' | 'strong'; content: Inline[] }
  | { type: 'node-ref'; node_id: string; content: Inline[] };  // canonical inline reference (M5)
```

- The **adapter** converts: FIA `textAsJson` maps nearly 1:1; `callout style="action"` → `action`; `bring-attention` → `strong`; `[水果](#m387)` → `node-ref` to the catalog item whose `metadata.upstream.fia_id` is `m387`. A partner that only has Markdown or HTML gets a degraded-but-valid conversion (paragraphs + headings).
- `node-ref` is what makes the library *navigable*: tap a term reference → glossary panel; tap a map reference → image. All generic, no FIA-specific UI.
- `body_plain` is derived from `body` at publish time — it's the surface that text anchors (offsets + exact quote) are measured against.

### Attachments and variants (M8)

FIA serves the same audio at four bitrates and images at multiple sizes. Generalization: the `attachments` array carries `{kind, variant, url, bytes}` entries; which variant a device downloads is a client/download-profile decision — the same posture as existing attachment handling. Whether files are mirrored into LangQuest storage or hotlinked from the partner CDN is an adapter-level choice per partner (FIA's S3 URLs are stable and public; mirroring is still likely preferable for offline guarantees — flagged as an open question).

### Tables

```
library_template              — id, name, description, slug, structure (JSONB), source_languoid_id,
                                copied_from_template_id, auto_sync, shared, active,
                                creator_id (null = system/adapter), timestamps
                                (no project_count — popularity computed by query; see template-system.md
                                 "Fields that must stay off the template row")
library_template_revision     — audit only, not synced (same as the other two systems)
project_library_link          — id, project_id, library_template_id, frozen, active, created_at
library_content               — as above
```

- `project_library_link` stays a real junction table: a project can use several reference libraries, and a library can be applied to many projects — a many-to-many relationship needs a junction table. (Content and workflow are one-per-project, so those links collapse onto `project`; library doesn't.)
- Adoption mutates the link's pointer under a compatibility check (every node_id referenced by the project's anchors/assignments must exist in the target fork) — verbatim the mechanism the other two systems use.
- RPCs mirror the content system: `publish_library_template`, `fork_library_template`, `save_library_template_metadata`, `link_library_to_project`, `adopt_library_fork`, plus `check_library_compatibility`.

### Sync (PowerSync)

- `library_template` — synced like content templates (active, linked-to-project + `auto_sync` globals). Skeleton-only keeps it well under the size cap.
- `library_content` — synced **filtered**: rows for the linked template's lineage, in the project's configured languoid(s), current version + any version still referenced by a local anchor. Download profiles gate the heavy attachment kinds. This per-row granularity is the payoff of not inlining content.
- `library_template_revision` — server-only.

### How the three template systems now relate

| | Content template | Library template | Process template |
|---|---|---|---|
| Declares | what gets translated | what the team reads to prepare | how finished work is validated |
| Structure | JSONB tree | JSONB tree + catalogs | JSONB phases/slots |
| Materialized layer | quests + assets (user-created) | `library_content` rows (adapter-published) | groups, assignments, decisions |
| Linked by | `project.template_id` (1/project) | `project_library_link` (many-to-many) | `project.workflow_template_id` (1/project) |
| Cross-links | ← library `alignment` resolves to content node ranges | contributions anchor to library nodes/rows (`asset_link`) | assignments target content *and* library nodes |

The process doc's assumptions A3 (study material in our DB, stable node IDs) and the anchoring design (version-pinned immutable material, quote selectors) are satisfied by construction. FIA's source-side glossary (library terms catalog) stays distinct from the project's Key Terms journal list — the team can `references`-link their own key-term decisions to the library's term nodes.

---

## The adapter contract

An adapter is a server-side job (edge function + cron, like today's `fia-refresh-templates`) owning everything partner-specific. Its obligations:

1. **Fetch** upstream content (API, scrape, file drop — adapter's business).
2. **Map IDs idempotently** — match upstream entities to existing nodes via `metadata.upstream`; mint nanoids only for genuinely new nodes. Upstream splits (p1 → p1a/p1b) become new nodes; the old node is tombstoned, never renamed-in-place.
3. **Publish structure changes** as a template fork — additive changes flow automatically; destructive changes (node disappears while referenced) are flagged for human review rather than auto-published.
4. **Publish content rows** — new immutable `library_content` versions for changed renderings; never mutate existing rows.
5. **Normalize rich text** into the canonical block format, rewriting inline references (`#m387` → `node-ref`).
6. **Normalize attachments** into `{kind, variant}` entries; mirror files if the partner CDN isn't suitable for long-term offline use.
7. **Declare alignment** — emit `alignment` metadata in the scheme the partner's material supports.
8. **Drop what doesn't generalize** — partner workflow fields (FIA's `dateComplete*`) stay out of the schema; preserve anything potentially useful in `metadata`.

Everything downstream of the adapter — sync, navigation, anchoring, assignments, completion, key-term linking — is partner-agnostic. A new partner = a new adapter, never new schema or app code. (Same shape as the process-engine claim: "a new review process is a new template, never new transition code.")

The existing FIA edge functions (`fia-pericopes`, `fia-pericope-steps`, `fia-pericope-text`) and the daily refresh are the seed of the FIA adapter; they currently target the content-template side and would be extended/relocated to publish the library template + content rows.

---

## What this deliberately does not do

- **No CRDTs, no offline structure editing** — library templates are website/adapter-published, fork-always, read-only on devices. Same boogeyman-starving posture as the other systems.
- **No per-partner schema** — no `fia_*` tables, no FIA enums. FIA specificity ends at the adapter boundary and `metadata.upstream`.
- **No completion machinery** — steps are completable because assignments target them (process doc Option B). The library only *hints* which nodes make natural assignment units.
- **No attempt to model partner approval workflows** (consultant checks, script/audio sign-off dates) — that's the partner's pipeline, not ours.

---

## Open questions

1. **One library per project, or several?** Starting unique-per-project for symmetry, but a project plausibly wants FIA *and* a dictionary/reference resource. Relaxing is an index drop + UI; the `refs`/anchor model already disambiguates by node ID. Decide before MVP if a real second-library use case exists.
2. **Content-row size and count** — ~3,000 pericopes × 6 steps × 15 languages ≈ 270k rows upstream; a single project syncs ~1/15th of the text (its languages) and far less with download profiles. Validate row counts and bucket sizes the same way as the content-template size question (generate + measure).
3. **Attachment mirroring policy** — mirror partner media into LangQuest storage vs hotlink. Offline-first argues for mirroring at least the audio of configured languages; cost says be selective.
4. **Alignment resolution** — where does scheme resolution live (e.g. `"bible"` coords → content-template node range)? Likely a pure client/website utility over both templates' metadata; needs a defined home and a fallback when a project's content template lacks the scheme.
5. **Catalog kinds** — start with `glossary` | `media` | `maps`? Or collapse maps into media (`item_type: 'map'`)? FIA treats maps separately mostly because of the GEOJSON future; a single media catalog with `item_type` may be enough.
6. **Block format governance** — the canonical block vocabulary needs the same admission rule as `link_role`/`rel`: a new block type must change rendering behavior, else it's a `callout` style.
7. **Re-anchoring job** — already deferred in the process doc; content rows make the trigger concrete (project adopts a fork / a new content version becomes current). The quote-selector design is the migration key.
