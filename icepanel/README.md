# LangQuest IcePanel tooling

Git-driven sync for the shared **LangQuest** IcePanel landscape.

## What this does

1. **Model** — upserts objects/connections from `model/landscape-import.yaml` via the REST SDK (`model.objects.upsert` / `model.connections.upsert`). The bulk `/import` endpoint is kept as the YAML schema, but it does not reliably upsert objects first created via MCP/UI.
2. **Views** — upserts the Mobile auth app diagram + sign-in happy-path flow via `@icepanel/sdk` (MCP cannot create these)

## Setup

1. Copy credentials into `.env` (gitignored):

```bash
ICEPANEL_API_KEY=...
ICEPANEL_LANDSCAPE_KEY=...   # landscape id from IcePanel URL
ICEPANEL_ORGANIZATION_ID=...
```

2. Install and sync:

```bash
npm install
npm run sync
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run sync` | Import model + upsert diagram/flow |
| `npm run import-model` | Model only |
| `npm run sync-views` | Diagram + flow only (assumes model exists) |
| `npm run sync-review` | Future process/review template model + diagrams + ADR |

## Editing

- Prefer editing `model/landscape-import.yaml` for structure/relationships
- Diagram layout + flow steps live in `src/sync.ts` for now (stable IDs in `src/ids.ts`)
- IcePanel requires **20-character IDs**. After a namespaced `/import`, IcePanel may assign new IDs and store your originals in labels — always sync `src/ids.ts` to the landscape’s real IDs.
- Prefer `npm run sync` (SDK upserts) over UI/API bulk import for day-to-day updates on this landscape.
