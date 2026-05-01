# Template System

Everything about how LangQuest handles structural templates — what they are, how they work, and why they work that way.

---

## What templates are

A template is a tree structure that defines the shape of a project's content. Bible books, chapters, and verses. FIA pericopes. A dictionary organized by letter. A poetry anthology grouped by theme. Whatever hierarchy the user wants.

Templates are stored as a single JSONB blob in a `template` table row. Projects link to templates via a join table (`project_template_link`). Quests and assets reference individual nodes within the template by opaque ID. Quests and assets also directly reference the `project_template_link` record directly (not the template record itself).

The mobile app reads templates. The website edits them.

---

## Why this design exists

### The problem

LangQuest needs arbitrary hierarchical structure for projects. Different use cases (Bible translation, FIA, custom curricula) need wildly different tree shapes. The old approach baked structure into app logic with hardcoded `template` enum values (`bible`, `fia`, `unstructured`). This doesn't scale.

We also need the structure to be editable after work has begun, shareable across projects, and functional offline.

### Constraints that shaped the solution

| # | Constraint | Why it matters |
|---|-----------|----------------|
| C1 | Offline-first row-level sync (PowerSync + SQLite) | A single JSONB row (20–100KB) re-syncing on infrequent edits is acceptable. The app is read-only on templates. |
| C2 | No materialized `template_node` table | Template structure stored as JSONB. No O(projects × nodes) row explosion. Quests/assets reference `template_node_id` (nanoid) and `template_link_id` (FK to `project_template_link`). |
| C3 | Fork-based publishing | Each publish = new immutable row. No concurrent editing conflicts. No locks. |
| C4 | No CRDT, no pessimistic locking | Single-writer per browser. Editing is website-only. Immutable published rows eliminate concurrency problems entirely. |
| C5 | Arbitrary hierarchical structure | Not hardcoded. Users define their own trees. |
| C6 | Multiple templates per project | A project can host several independent template trees via multiple `project_template_link` rows. |
| C7 | Mid-project modification | Structure can change after work has begun. Deleted nodes handled contextually (see reconciliation rules). |
| C8 | Max depth = 5 | Validated server-side on publish. |
| C9 | Opaque node IDs | `nanoid(10)`, immutable once created. No `external_id`. Backfill scripts use tree-walking + metadata for semantic matching. |
| C10 | Selective scope | An editor can only apply changes to projects they own. |
| C11 | Frozen project links | `frozen = true` on a `project_template_link` row prevents re-pointing. Backward compatibility without blocking template forking. |
| C12 | No rollback | Reverting to a prior version isn't supported (would orphan linked contributions). `template_revision` is audit-only. |

---

## Options considered and rejected

### Materialized node rows (one DB row per template node per project)

Rejected because it creates O(projects × template_size) rows. A Bible template has ~31,000 nodes. 100 projects = 3.1 million rows just for structure. JSONB makes this one row per template, shared by all projects using it.

### Pessimistic locking (lock → edit → save → unlock)

Built initially. Rejected because:
- Stale locks from crashed browsers require timeout logic and forced takeover
- Doesn't prevent conflicts, just reduces them
- Adds three RPCs (`acquire_lock`, `heartbeat_lock`, `release_lock`) and two columns (`locked_by`, `locked_at`)
- Fork-always model eliminates the problem entirely — published rows are immutable, so there's nothing to conflict on

### CRDT-based concurrent editing

Rejected. Overkill for a single-editor-per-draft scenario. The mobile app doesn't edit templates. The website is the only editor. One person edits a draft in their browser at a time.

### `structure_version` optimistic concurrency

Built initially alongside locks. Rejected because the fork model makes it unnecessary — you don't update existing rows, you insert new ones.

### User-facing "edit mode" vs "copy mode" toggle affecting delete behavior

Considered initially. The idea was that users would explicitly choose between "hard delete" and "soft delete" modes. Rejected because it surfaces backend schema concerns to end users. Instead, the system decides contextually at publish time (see reconciliation rules below).

### Separate "hidden"/"invisible" terminology

Considered. Settled on `deleted: true` in the JSON because it matches what the user did — they deleted the node. The system preserves it as a tombstone where needed, but the user's action is just "delete."

### Template-level `locked_for_backward_compat`

Initially placed on the `template` table to prevent editing frozen legacy templates. Rejected because it conflated two concepts: (1) whether a template can be forked from (always yes), and (2) whether existing project links can be re-pointed (contextual). Replaced with `frozen` on `project_template_link` — the freeze applies to the *connection*, not the template itself.

---

## How it works now

### Database schema

Three new tables:

```
template
├── id (UUID, PK)
├── name, description, icon, slug
├── structure (JSONB — the full tree)
├── source_languoid_id (FK → languoid)
├── copied_from_template_id (FK → template, provenance chain)
├── auto_sync, shared, active
├── creator_id, project_count
├── download_profiles
├── created_at, last_updated
```

```
project_template_link
├── id (UUID, PK)
├── project_id (FK → project)
├── template_id (FK → template)
├── role, active
├── frozen (prevents re-pointing this link)
├── download_profiles
├── UNIQUE(project_id, template_id)
```

```
template_revision (audit only, not synced to mobile)
├── id (UUID, PK)
├── template_id (FK → template)
├── structure (JSONB snapshot)
├── actions (JSONB — structured diff of changes)
├── saved_by, saved_at
```

Columns added to existing tables:

- `quest.template_link_id`, `quest.template_node_id`
- `asset.template_link_id`, `asset.template_node_id`, `asset.span_end_template_node_id`

### JSONB structure format

```json
{
  "format_version": 1,
  "root": {
    "id": "root",
    "name": "Protestant Bible",
    "node_type": "root",
    "linkable_type": "quest",
    "children": [
      {
        "id": "4ar28cRTn5",
        "name": "Genesis",
        "node_type": "book",
        "linkable_type": "quest",
        "children": [
          {
            "id": "sr1kHCBHOL",
            "name": "Genesis 1",
            "node_type": "chapter",
            "linkable_type": "quest",
            "is_download_unit": true,
            "children": [
              {
                "id": "fKa9y8aSdj",
                "name": "Genesis 1:1",
                "node_type": "verse",
                "linkable_type": "asset",
                "allows_spanning": true
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Key node fields:
- `id` — nanoid(10), opaque, immutable  
- `name` — display name  
- `node_type` — semantic type (root, book, chapter, verse, etc.)  
- `linkable_type` — **required**. What can be linked here: `quest` or `asset`. Every node must declare this.  
- `is_download_unit` — marks the node as a download boundary (auto-enforced for quest nodes containing asset children) (only one per lineage)  
- `is_version_anchor` — marks where quest versioning occurs (only one per lineage)  
- `allows_spanning` — whether assets here can span multiple sibling nodes  
- `deleted` — `true` if soft-deleted (tombstone)  
- `short_label`, `label_template` — UI labeling (generalized, no hardcoded Bible/FIA logic)  

### RPCs

| RPC | Purpose |
|-----|---------|
| `publish_template` | Insert new template row. Optionally re-point selected non-frozen project links. Validates depth ≤ 5 and single-per-lineage flags. |
| `fork_template` | Create a named clone: requires user-provided name. Copies structure into new row. |
| `save_template_metadata` | In-place edit of name/description/icon/shared on published templates. Does not touch structure. |

Lock RPCs (`acquire`, `heartbeat`, `release`, `force_release_stale`) were removed entirely.

### Template composition (copy-from)

Users can import subtrees from another template into their draft. The imported nodes are copied with fresh nanoid IDs — there is no live reference or shared identity between templates. This is a convenience feature for constructing new templates from existing parts without building from scratch.

---

## User experience

### Creating a template

1. User goes to template list on the website
2. Clicks "New template" or "Use as starting point" on an existing one
3. A local draft opens in the tree editor (browser IndexedDB)
4. User builds the tree: add nodes, name them, set properties
5. User publishes → new `template` row inserted

### Editing a template

1. User selects a published template
2. Two entry points (these set the *default* publish intent, not a mode):
   - **"Use as starting point"** — initial intent is to make something new
   - **"Update for my projects"** — initial intent is to apply changes to existing projects
3. Draft opens in the tree editor — both entry points produce the same editing experience
4. User makes changes (add, rename, reorder, delete nodes). All deleted nodes are marked `deleted: true`.
5. Undo/redo works. Bulk operations count as single undo steps.
6. At **publish time**, the user chooses:
   - Apply to existing projects → fork published with tombstones preserved, links re-pointed
   - Make available for new projects → fork published with tombstones stripped
   - Both → two forks from the same draft (one with tombstones, one clean)
   - The initial entry point sets defaults, but the user can switch or select both

### Applying a template to a project

- New project: user picks a template during project creation
- Existing project: owner links a template via the project settings

### Deleting nodes in the editor

The user just deletes. There's no "hide" vs "remove" choice. They select a node and hit delete. The draft always stores `deleted: true`. What happens at publish time depends on the user's publish choices (see reconciliation rules).

---

## Reconciliation rules

This is the core insight of the system. The template declares *what should exist*. The system decides how to package the published output based on where it's going.

### Rule 1: Publish → existing projects (have contributions)

- Node IDs stay the same
- Deleted nodes kept as `deleted: true` (tombstones preserved)
- Existing quests/assets still reference valid node IDs
- Selected non-frozen `project_template_link` rows re-pointed to the new template row

### Rule 2: Publish → new projects / general availability (no contributions)

- Deleted nodes completely removed from JSONB
- No orphan risk — nothing references those IDs yet
- Clean template published

### Rule 3: Applying a template with tombstones to a new project

If a published template contains `deleted: true` nodes and someone applies it to a new project, the system strips them automatically — new projects start clean. This is implemented at the **read layer**: both the mobile `buildTemplateIndex` and the website `node-resolver` skip `deleted` nodes when resolving display nodes. No mutation of the shared template row is needed.

### Rule 4: Dual publish

From the same draft, the system can produce two forks:
- One with tombstones (for re-pointing existing project links)
- One clean (for new use / general availability)

Both share `copied_from_template_id` pointing to the same source.

### Rule 5: Frozen project links

`frozen = true` on a `project_template_link` prevents that link from being re-pointed to a new template. Legacy backfilled links (Bible, FIA, auto-generated) are frozen. The template itself is still freely forkable as a starting point.

---

## Compatibility checking (adopting another editor's fork)

When a project owner wants to adopt a newer version of their template (published by someone else), the system verifies compatibility at re-point time:

- Every `template_node_id` referenced by the project's existing quests/assets must exist in the target template (including tombstoned nodes)
- If any referenced node ID is missing from the target template, the re-point is blocked with an explanation

This is a runtime check — no precomputed fingerprint column needed. It runs only when someone explicitly chooses to switch their project to a different template version.

### Template history UI

Users can browse the provenance chain (`copied_from_template_id` links) to see how templates have evolved over time, who forked what, and what changed in each version (via `template_revision`).

---

## Structured revision diffs

`template_revision.actions` stores a structured diff computed at publish time by comparing the source template's structure against the new one. The diff captures:

- Nodes added (with IDs and positions)
- Nodes removed / marked deleted
- Nodes renamed
- Nodes moved (parent change or reorder)
- Property changes (linkable_type, is_download_unit, etc.)

**Implementation approach**: A custom tree-diffing function walks both structures (old and new) in parallel by node ID. Since node IDs are stable and immutable, the diff is straightforward — presence/absence/property-changes per ID. This avoids needing a full CRDT library (automerge/loro) for what is fundamentally a one-time snapshot comparison, not ongoing concurrent editing.

---

## Provenance

Every published template carries `copied_from_template_id`, forming a linked list:

```
Template A (original, copied_from = null)
  └── Template B (copied_from = A)
        └── Template C (copied_from = B)
```

`template_revision` stores a full JSONB snapshot + structured diff for each publish event. Together they give complete traceability.

---

## What changed in the codebase

### Supabase migrations (5 files)

- `20260416120000` — Core DDL: `template`, `project_template_link`, `template_revision` tables. Columns on `quest` and `asset`. Trigger for `project_count`. RLS policies. PowerSync publication.
- `20260416120001` — RPCs: `publish_template`, `fork_template`, `save_template_metadata`. Validation helpers.
- `20260416120002` — Backfill: seeds Bible/FIA templates, creates frozen links for existing projects, populates `template_link_id` on quests/assets.
- `20260416120003` — `pg_cron` schedule for daily FIA template refresh.
- `20260416120004` — Auto-generates templates for existing unstructured projects with frozen links.

### Mobile app (langquest)

- **Drizzle schema** (`db/drizzleSchemaColumns.ts`, `drizzleSchema.ts`, `drizzleSchemaSynced.ts`, `drizzleSchemaLocal.ts`) — Added `template` and `project_template_link` table definitions.
- **Constants** (`constants/templateTypes.ts`) — `TemplateNode`, `TemplateStructure` types, validation constants.
- **Hooks** (`hooks/useProjectTemplate.ts`, `hooks/useQuestCreationFromTemplate.ts`) — Data fetching for template-linked projects.
- **Utils** (`utils/templateUtils.ts`) — Structure validation, index building, node lookup.
- **Views** (`views/new/TemplateNodeList.tsx`) — Tree display component.
- **Recording service** (`views/new/recording/services/recordingService.ts`) — Updated column references.
- **Sync rules** (`supabase/config/sync-rules.yml`) — Added template tables to sync.
- **Edge function** (`supabase/functions/fia-refresh-templates/`) — Daily FIA pericope refresh.
- **Migration** (`db/migrations/2.3-to-3.0.ts`) — Local SQLite schema migration.

### Website (langquest-website)

- **`src/lib/template/`** — Core library: types, RPCs, actions, node resolver, draft store (IndexedDB), create-draft, hidden-nodes utilities.
- **Components** — `template-editor-tree.tsx` (react-arborist tree), `template-node-panel.tsx` (side panel), `template-picker.tsx` (selection UI).
- **Pages** — Template list, single-template view, draft editor, new template.
- **Quest explorer** — Updated to resolve nodes from templates.

### Dev docs (langquest-dev-docs)

- **Interactive diagrams** — React Flow-based lifecycle diagrams showing forking, reconciliation, and node ID behavior.
- **Reference SQL** (`database_schema.sql`) — Full schema documentation.
- **Design documents** — `template-design-constraints.md`, `template-lifecycle.md`, `template-system.md` (this file).

### Scripts

- `scripts/generate-bible-template.py` — Generates full Bible JSONB tree and backfills node IDs.

---

## Terminology

| Term | Meaning |
|------|---------|
| Template | A JSONB tree structure defining content hierarchy |
| Node | A single element in the template tree (book, chapter, verse, etc.) |
| Template link | The `project_template_link` row connecting a project to a template |
| Frozen link | A template link with `frozen = true` — cannot be re-pointed |
| Fork | Creating a new template row based on an existing one |
| Tombstone | A node marked `deleted: true` — hidden but preserved for referential integrity |
| Publish | Inserting a new immutable template row |
| Draft | Local-only (IndexedDB) working copy of a template being edited |
| Reconciliation | The system's contextual decision about how to package template changes for different targets |
| Provenance | The `copied_from_template_id` chain linking forks back to their source |
| Composition | Copying subtrees from another template into a draft (fresh IDs, no shared identity) |

---

## Search and discovery

### Filtering

The template list page provides two filtering mechanisms:

1. **Languoid dropdown** — filters templates by `source_languoid_id`. Defaults to the user's preferred languoid (or "All languages"). Uses the existing `LanguoidCombobox` component with search-as-you-type.
2. **Text search** — client-side filter on name, slug, and description.

Results are always sorted by `project_count DESC` (popularity). The languoid filter is applied server-side for efficiency; text search is client-side on the returned set.

### Provenance panel

Clicking a template card opens a slide-out panel showing:

- Template metadata (name, description, creator, stats)
- **Fork lineage tree** — the full family of templates connected via `copied_from_template_id`, rendered as an indented tree. Each node shows name and project count. Users can click any node in the tree to view its revision history.
- **Revision history** — `template_revision` entries for the focused template, showing date and change summary.
- Action buttons ("Use as starting point", "Update for my projects")

### RPCs supporting discovery

| RPC | Purpose |
|-----|---------|
| `get_template_lineage` | Given any template ID, walks `copied_from_template_id` up to the root ancestor and down to all descendants. Returns flat JSONB array of the full family. |
| `get_template_revisions` | Returns revision history (date, author, actions summary) for a single template. |
| `adopt_template_fork` | Re-points a `project_template_link` to a different template in the same lineage. Validates ownership, frozen status, and node compatibility before updating. |
| `link_template_to_project` | Creates a new `project_template_link` for a project that doesn't have one, or adds a new link. Validates ownership and template existence. |

### Adopt fork

On the project page, owners see their current template with an "Adopt a fork" button. This opens a dialog showing all templates in the same lineage (via `get_template_lineage`). Selecting one triggers `adopt_template_fork`, which re-points the link after verifying that all existing contribution node IDs exist in the target template.

### Link / change template

Owners can also link a template to a project that doesn't have one, or change the current template via the "Link template" / "Change template" button. This opens a dialog showing all shared templates. The `link_template_to_project` RPC handles the insert.

---

## Structured revision diffs

The `template_revision.actions` column stores a `TemplateDiff` JSONB object computed at publish time by `computeTreeDiff(before, after)`. The diff walks both trees by stable node ID and produces entries of type: `add`, `remove`, `rename`, `move`, `hide`, `unhide`, `property_change`. Each entry includes `nodeId`, `nodeName`, and relevant `details`. A `summary` object provides counts per type for quick display.

## Compatibility checking

Before re-pointing project template links, `check_template_compatibility` (server-side RPC) validates that all `template_node_id` values currently referenced by quests in the target projects exist in the new structure. If any are missing, publish is blocked with an actionable error message suggesting the user mark those nodes as hidden instead of removing them.

## Template composition

Editors can import sections from any shared template into their draft via the import dialog. Imported subtrees receive entirely fresh node IDs — no shared identity with the source. This enables mixing and matching content from multiple templates without unintended linkage.

---

## Open questions (to be explored)

1. **Template naming and search** — `fork_template` requires a user-provided name. Duplicate names are allowed (only `slug` is unique). The current approach uses languoid filtering + text search + popularity sort. May need refinement as the template count grows.
