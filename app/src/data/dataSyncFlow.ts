// ── Data Sync Flow step & diagram data ──

export interface SyncNode {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  label: string;
  desc: string;
  badge: string;
  color: "cyan" | "green" | "purple";
  tooltip: { name: string; desc: string; file: string };
}

export interface SyncConnection {
  id: string;
  from: string;
  fromEdge: "top" | "bottom" | "left" | "right";
  to: string;
  toEdge: "top" | "bottom" | "left" | "right";
  label: string;
}

export interface SyncStep {
  title: string;
  description: string;
  pulse: string[];
  paths: string[];
  labels: string[];
  color: string | null;
}

export interface SyncScenario {
  id: string;
  name: string;
  icon: string;
  steps: SyncStep[];
}

export const DEFAULT_NODES: SyncNode[] = [
  { id: "local", cx: 650, cy: 745, w: 190, h: 58, label: "Local-Only Tables", desc: "Draft content, device-only", badge: "SQLite", color: "cyan", tooltip: { name: "Local-Only Tables", desc: "Draft content in <code>*_local</code> SQLite tables. PowerSync ignores these — no upload queue entries are created. Content stays here until <code>publishQuest()</code> copies rows to synced counterparts.", file: "db/drizzleSchemaLocal.ts" } },
  { id: "synced", cx: 650, cy: 645, w: 190, h: 58, label: "Synced Tables", desc: "PowerSync-managed (*_synced)", badge: "SQLite", color: "cyan", tooltip: { name: "Synced Tables", desc: "<code>*_synced</code> tables managed by PowerSync. Writes here auto-create <code>ps_crud</code> entries. Uses <code>trackMetadata: true</code> so ops carry schema version info for server transforms.", file: "db/powersync/system.ts" } },
  { id: "psCrud", cx: 190, cy: 505, w: 190, h: 58, label: "ps_crud Queue", desc: "Pending upload operations", badge: "Queue", color: "cyan", tooltip: { name: "ps_crud Upload Queue", desc: "Internal PowerSync FIFO queue. Persists across restarts and survives offline. Three op types: PUT (INSERT), PATCH (UPDATE), DELETE.", file: "PowerSync internal table" } },
  { id: "connector", cx: 140, cy: 325, w: 190, h: 58, label: "uploadData()", desc: "Batches ops → Supabase RPC", badge: "Connector", color: "cyan", tooltip: { name: "SupabaseConnector · uploadData()", desc: "Drains <code>ps_crud</code> via <code>getNextCrudTransaction()</code>, normalizes composite keys/JSON arrays, sends batch via <code>supabase.rpc('apply_table_mutation_transaction')</code>.", file: "db/supabase/SupabaseConnector.ts" } },
  { id: "rpc", cx: 260, cy: 125, w: 190, h: 58, label: "RPC Function", desc: "Schema transforms + DML", badge: "Function", color: "green", tooltip: { name: "apply_table_mutation_transaction", desc: "Single RPC for all client writes. Chains transforms <code>v0→v1→v2→v2.2</code>, then <code>_apply_single_json_dml</code> per op in a transaction.", file: "supabase/migrations/" } },
  { id: "tables", cx: 650, cy: 125, w: 190, h: 58, label: "Database Tables", desc: "Canonical source of truth", badge: "Postgres", color: "green", tooltip: { name: "Postgres Tables", desc: "Source of truth: <code>profile</code>, <code>project</code>, <code>quest</code>, <code>asset</code>, <code>vote</code>, <code>tag</code>, links, <code>languoid</code>, etc. Most include <code>download_profiles[]</code> for per-user sync filtering.", file: "supabase/migrations/" } },
  { id: "wal", cx: 1040, cy: 125, w: 190, h: 58, label: "WAL / Publication", desc: "Logical replication feed", badge: "Replication", color: "green", tooltip: { name: "WAL / Publication", desc: "Postgres WAL with logical replication. The <code>powersync</code> publication captures every committed change. Tables added via <code>ALTER PUBLICATION \"powersync\" ADD TABLE</code>.", file: "supabase/migrations/" } },
  { id: "powersync", cx: 1160, cy: 325, w: 190, h: 58, label: "PowerSync Service", desc: "Replicates + routes data", badge: "Sync Engine", color: "purple", tooltip: { name: "PowerSync Service", desc: "Self-hosted sync engine. Reads Postgres WAL, processes sync rules, splits data into buckets, persists op history in MongoDB. Authenticates clients via Supabase JWTs.", file: "supabase/config/powersync.yml" } },
  { id: "syncRules", cx: 1110, cy: 505, w: 190, h: 58, label: "Sync Rules / Streams", desc: "Per-user data filtering", badge: "Config", color: "purple", tooltip: { name: "Sync Rules / Streams", desc: "<code>sync-rules.yml</code>: <code>user_profile</code> bucket uses <code>request.user_id()</code> + <code>download_profiles</code>. <code>global_bucket</code> syncs active languoids to all. Buckets are deduplicated across users.", file: "supabase/config/sync-rules.yml" } },
];

export const CONNECTIONS: SyncConnection[] = [
  { id: "publish", from: "local", fromEdge: "top", to: "synced", toEdge: "bottom", label: "publish()" },
  { id: "toQueue", from: "synced", fromEdge: "left", to: "psCrud", toEdge: "right", label: "mutation → queue" },
  { id: "toConnector", from: "psCrud", fromEdge: "top", to: "connector", toEdge: "bottom", label: "drain queue" },
  { id: "toRpc", from: "connector", fromEdge: "top", to: "rpc", toEdge: "bottom", label: "supabase.rpc()" },
  { id: "toTables", from: "rpc", fromEdge: "right", to: "tables", toEdge: "left", label: "transforms + DML" },
  { id: "toWal", from: "tables", fromEdge: "right", to: "wal", toEdge: "left", label: "commit → WAL" },
  { id: "toPowersync", from: "wal", fromEdge: "bottom", to: "powersync", toEdge: "top", label: "replicate" },
  { id: "toSyncRules", from: "powersync", fromEdge: "bottom", to: "syncRules", toEdge: "top", label: "bucket routing" },
  { id: "toSynced", from: "syncRules", fromEdge: "left", to: "synced", toEdge: "right", label: "streaming sync" },
];

export const SCENARIOS: SyncScenario[] = [
  {
    id: "publish",
    name: "Publishing Content",
    icon: "↗",
    steps: [
      { title: "Content created offline", description: "Quests, assets, and tags are written to <code>*_local</code> tables in SQLite. This data is completely on-device — PowerSync ignores it.", pulse: ["local"], paths: [], labels: [], color: null },
      { title: "publishQuest() copies to synced", description: 'A single SQLite transaction copies rows from <code>*_local</code> → <code>*_synced</code> in dependency order: project → languages → quests → assets → links → tags. Audio paths are rewritten and queued for attachment upload.', pulse: ["synced"], paths: ["publish"], labels: ["publish"], color: "#f472b6" },
      { title: "Mutations enter ps_crud queue", description: 'Each INSERT into a <code>*_synced</code> table generates a <code>PUT</code> entry in the internal <code>ps_crud</code> upload queue. Schema metadata (<code>_metadata.schema_version</code>) is stamped so the server can run version transforms.', pulse: ["psCrud"], paths: ["toQueue"], labels: ["toQueue"], color: "#22d3ee" },
      { title: "uploadData() sends batch to server", description: 'The SupabaseConnector drains the queue via <code>getNextCrudTransaction()</code>, normalizes composite keys and JSON array fields, then calls <code>apply_table_mutation_transaction</code> via Supabase RPC.', pulse: ["connector", "rpc"], paths: ["toConnector", "toRpc"], labels: ["toConnector", "toRpc"], color: "#22d3ee" },
      { title: "Server applies transforms + DML", description: 'The RPC chains schema transforms (<code>v0→v1→v2→v2.2</code>), then calls <code>_apply_single_json_dml</code> per op inside a Postgres transaction. On success, <code>transaction.complete()</code> clears the queue entry.', pulse: ["tables"], paths: ["toTables"], labels: ["toTables"], color: "#22d3ee" },
      { title: "Change echoes back via sync", description: "The committed change is captured in the WAL, replicated by the PowerSync Service into the user's bucket via sync rules, and streamed to the client over the persistent WebSocket connection.", pulse: ["wal", "powersync", "syncRules", "synced"], paths: ["toWal", "toPowersync", "toSyncRules", "toSynced"], labels: ["toWal", "toPowersync", "toSyncRules", "toSynced"], color: "#34d399" },
    ],
  },
  {
    id: "write",
    name: "Direct Client Write",
    icon: "✎",
    steps: [
      { title: "App writes to synced table", description: "For non-draft operations (voting, reporting, editing), the app writes directly to a <code>*_synced</code> table. The change is immediately visible locally in the SQLite database.", pulse: ["synced"], paths: [], labels: [], color: null },
      { title: "CRUD entry queued automatically", description: "PowerSync creates a PUT, PATCH, or DELETE entry in <code>ps_crud</code>. If the device is offline, entries accumulate safely until connectivity returns.", pulse: ["psCrud"], paths: ["toQueue"], labels: ["toQueue"], color: "#22d3ee" },
      { title: "Connector uploads via RPC", description: '<code>uploadData()</code> processes the FIFO queue — one transaction at a time. Each op gets schema metadata and composite key normalization before being batched into the RPC call.', pulse: ["connector", "rpc"], paths: ["toConnector", "toRpc"], labels: ["toConnector", "toRpc"], color: "#22d3ee" },
      { title: "Server applies + commits", description: '<code>apply_table_mutation_transaction</code> runs transforms and DML. On 2xx: queue entry cleared. On 4xx: still cleared (user alerted, data discarded). On 5xx: throws — PowerSync retries with exponential backoff.', pulse: ["tables"], paths: ["toTables"], labels: ["toTables"], color: "#22d3ee" },
      { title: "Server version echoes back", description: "The committed change flows through the WAL → PowerSync replication → bucket routing → streaming sync. The client receives the server's version of the data (which may differ after server-side transforms).", pulse: ["synced"], paths: ["toWal", "toPowersync", "toSyncRules", "toSynced"], labels: ["toWal", "toPowersync", "toSyncRules", "toSynced"], color: "#34d399" },
    ],
  },
  {
    id: "serverChange",
    name: "Server-Side Change",
    icon: "⟳",
    steps: [
      { title: "Data modified in Postgres", description: "Another user's upload, an admin action, or a database trigger modifies rows in the canonical Postgres tables.", pulse: ["tables"], paths: [], labels: [], color: null },
      { title: "WAL captures the commit", description: 'Postgres writes the change to its Write-Ahead Log. The <code>powersync</code> publication (logical replication) exposes it to the PowerSync Service with zero polling delay.', pulse: ["wal"], paths: ["toWal"], labels: ["toWal"], color: "#34d399" },
      { title: "PowerSync replicates to buckets", description: "The PowerSync Service reads from the replication slot. Each change is processed through sync rules, split into appropriate buckets, and appended to the operation history in MongoDB.", pulse: ["powersync"], paths: ["toPowersync"], labels: ["toPowersync"], color: "#a78bfa" },
      { title: "Sync rules route + stream to client", description: 'Sync rules evaluate <code>WHERE bucket.profile_id in download_profiles</code>. Data enters the user\'s bucket and streams to the connected client via the persistent WebSocket. Live queries re-render the UI automatically.', pulse: ["syncRules", "synced"], paths: ["toSyncRules", "toSynced"], labels: ["toSyncRules", "toSynced"], color: "#34d399" },
    ],
  },
  {
    id: "download",
    name: "Content Download",
    icon: "↓",
    steps: [
      { title: "User requests a download", description: 'The app calls a Supabase RPC like <code>download_quest_closure</code> or <code>download_project_closure</code>. This computes the full dependency tree of the project/quest to sync.', pulse: ["connector"], paths: [], labels: [], color: null },
      { title: "RPC adds profile to download_profiles", description: "The RPC function adds the user's <code>profile_id</code> to the <code>download_profiles</code> array on all relevant records: project, quests, assets, links, tags, languoids, and their dependencies.", pulse: ["rpc", "tables"], paths: ["toRpc", "toTables"], labels: ["toRpc", "toTables"], color: "#a78bfa" },
      { title: "Sync rules now match this user", description: 'The <code>download_profiles</code> update flows through the WAL. PowerSync re-evaluates sync rules and discovers new rows matching <code>bucket.profile_id in download_profiles</code> for this user\'s bucket.', pulse: ["wal", "powersync", "syncRules"], paths: ["toWal", "toPowersync", "toSyncRules"], labels: ["toWal", "toPowersync", "toSyncRules"], color: "#a78bfa" },
      { title: "Full project tree streams to client", description: 'Streaming sync pushes all newly matched rows to the client. The entire dependency tree — quests, assets, tags, links, languoids — arrives in <code>*_synced</code> tables. Content is now available offline.', pulse: ["synced"], paths: ["toSynced"], labels: ["toSynced"], color: "#34d399" },
    ],
  },
];

export const ALL_CONNECTION_IDS = CONNECTIONS.map((c) => c.id);
