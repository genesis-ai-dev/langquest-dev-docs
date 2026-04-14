# Template Design — Constraints

Canonical list of constraints guiding the `template_node` design. Updated as the design evolves.

---

## Architecture

| # | Constraint | Notes |
|---|-----------|-------|
| C1 | **Offline-first row-level sync** | PowerSync + SQLite. Every change syncs as individual rows. Large JSON blobs force full re-sync and are undesirable. |
| C2 | **No cascading sibling updates** | Inserting/reordering a node must not require updating every sibling. Solved via fractional indexing (`order_key`). |
| C3 | **FK integrity over embedded references** | Real foreign keys (not JSON-embedded IDs) so the database enforces referential integrity and enables joins. |

## Template Structure

| # | Constraint | Notes |
|---|-----------|-------|
| C4 | **Arbitrary hierarchical structure** | Users define their own template trees — Bible, FIA, dictionary, video timestamps, poetry, stories, etc. Not hard-coded. |
| C5 | **Multiple templates per project** | A single project can host several independent template trees (e.g. Bible + dictionary). Each is a separate mother node under the same `project_id`. |
| C6 | **Mid-project modification** | Nodes can be added, removed, reordered, or renamed after work has begun. Soft-delete (`active`) preserves existing contributions when nodes are removed. |
| C7 | **Template sharing & copying** | `shared` flag allows others to copy a template. Copies are independent (changes don't propagate). `source_copied_id` tracks provenance. |
| C8 | **Efficient ordering** | Sibling order maintained via lexicographic `order_key` (fractional indexing). Insert/reorder = 1 row write, 0 sibling updates. |
| C9 | **Download boundary** | Certain nodes serve as the download unit (the level at which content is bundled for offline use). Currently chapter for Bible, pericope for FIA. Expressed via `is_download_unit` flag — flexible per-node, copies with the template. |

## Versioning & Contributions

| # | Constraint | Notes |
|---|-----------|-------|
| C10 | **Quest versioning** | Multiple quests pointing to the same `template_node_id` = versions of that structural unit. Replaces metadata-matching. |
| C11 | **No verse splitting** | Users cannot split a verse into sub-parts (e.g. 1:1a, 1:1b). This was rejected for complexity reasons. |
| C12 | **Verse spanning (combining)** | A single asset can cover a contiguous range of template nodes via `template_node_id` (start) + `span_end_node_id` (end). |
| C13 | **Remixing (future)** | Create a new quest version from the best contributions across existing versions. Each remixed version can pull individual assets and define its own spans. |

## Querying & Data Integrity

| # | Constraint | Notes |
|---|-----------|-------|
| C14 | **Efficient completion queries** | "Which slots have contributions?" must be answerable with a simple join on `template_node_id` — no JSON parsing or tag lookups. |
| C15 | **Distinguish dedicated vs. spanning** | Queries for a specific node must clearly separate assets dedicated to that single node (`span_end_node_id IS NULL`) from assets that span a range including it. |
| C16 | **Efficient tree queries** | `root_id` on every node avoids recursive traversal. "All nodes in template X" = `WHERE root_id = ?`. |

## Migration & Compatibility

| # | Constraint | Notes |
|---|-----------|-------|
| C17 | **Minimal migration** | All new columns are nullable. Existing tables are reused (not renamed or replaced). Legacy fields (`quest.metadata`, `project.template` enum) remain until full migration. |
| C18 | **Backward compatibility** | Unstructured projects keep working via `quest.parent_id` hierarchy. Template-aware code checks `template_node_id` first, falls back to legacy fields. |
