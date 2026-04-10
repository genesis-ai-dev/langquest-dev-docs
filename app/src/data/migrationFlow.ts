// ── Version chain & helpers ──

export const VERSION_CHAIN = ["0", "1.0", "2.0", "2.1", "2.2", "2.3"];

export interface VersionVars {
  phone: string;
  target: string;
  minCompat: string;
}

export const DEFAULT_VERSIONS: VersionVars = {
  phone: "2.0",
  target: "2.3",
  minCompat: "2.1",
};

export function getMigrationChain(from: string, to: string): string[] {
  const s = VERSION_CHAIN.indexOf(from);
  const e = VERSION_CHAIN.indexOf(to);
  if (s < 0 || e < 0 || s >= e) return [from, to];
  return VERSION_CHAIN.slice(s, e + 1);
}

// ── Node definition (framework-agnostic) ──

export interface NodeDef {
  id: string;
  type: "migration" | "container" | "versionBox" | "label";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  subtitle?: string;
  badge?: string;
  category?: string;
  draggable?: boolean;
  zIndex?: number;
}

// ── Static nodes (positions & labels don't change with version vars) ──

const STATIC_NODES: NodeDef[] = [
  // Tier 1 — Pipeline
  { id: "gitRepo", type: "migration", x: -44, y: 0, w: 165, h: 54, label: "Git Repository", subtitle: "Migration files", badge: "SOURCE", category: "dev" },
  { id: "cicd", type: "migration", x: 208, y: 0, w: 165, h: 54, label: "CI/CD Pipeline", subtitle: "Auto-apply on merge", badge: "PIPELINE", category: "dev" },
  { id: "sqlMigration", type: "migration", x: 680, y: 0, w: 165, h: 54, label: "SQL Migration", subtitle: "Timestamped DDL files", badge: "POSTGRES", category: "server" },

  // Tier 1.5
  { id: "appStore", type: "migration", x: 208, y: 171, w: 165, h: 54, label: "App Store", subtitle: "Review + release", badge: "EXTERNAL", category: "external" },

  // Tier 2 — Server
  { id: "schemaInfo", type: "migration", x: 1255, y: 295, w: 165, h: 54, label: "get_schema_info()", subtitle: "Version + compatibility", badge: "RPC", category: "server" },
  { id: "postgres", type: "migration", x: 579, y: 293, w: 165, h: 54, label: "Postgres Tables", subtitle: "Production source of truth", badge: "DATABASE", category: "server" },
  { id: "transformRpc", type: "container", x: 800, y: 256, w: 434, h: 128, label: "Transform RPC", category: "server", zIndex: -1 },

  // Tier 2.5
  { id: "psService", type: "container", x: 538, y: 420, w: 240, h: 88, label: "PowerSync Service", category: "server", zIndex: -1 },
  { id: "syncRules", type: "migration", x: 591, y: 448, w: 150, h: 48, label: "Sync Rules", badge: "CONFIG", category: "server" },
  { id: "clientUpdate", type: "migration", x: 208, y: 430, w: 165, h: 54, label: "Client Updates App", badge: "DEVICE", category: "client" },

  // Tier 3 — App
  { id: "app", type: "container", x: 23, y: 539, w: 1418, h: 210, label: "App", category: "client", zIndex: -2 },
  { id: "checkSchema", type: "migration", x: 1258, y: 626, w: 175, h: 54, label: "Check Schema Version", badge: "CLIENT", category: "client" },
  { id: "localOnly", type: "container", x: 65, y: 600, w: 450, h: 125, label: "local-only tables", category: "client", zIndex: -1 },
  { id: "synced", type: "container", x: 579, y: 610, w: 165, h: 105, label: "synced tables", category: "client", zIndex: -1 },
  { id: "psCrud", type: "migration", x: 948, y: 620, w: 140, h: 85, label: "ps_crud", subtitle: "Upload queue", badge: "QUEUE", category: "client" },
];

// ── Dynamic nodes (labels from version variables) ──

function buildVersionNodes(v: VersionVars): NodeDef[] {
  const chain = getMigrationChain(v.phone, v.target);
  const nodes: NodeDef[] = [];

  // APP_SCHEMA_VERSION label
  nodes.push({
    id: "appSchemaVer",
    type: "label",
    x: 1067, y: 566, w: 230, h: 26,
    label: `APP_SCHEMA_VERSION = '${v.target}'`,
  });

  // Local-only version boxes (3 slots, left→right = old→new)
  const LOCAL_POS = [
    { x: 98, y: 640 },
    { x: 247, y: 640 },
    { x: 401, y: 640 },
  ];
  let localLabels: string[];
  if (chain.length <= 3) {
    localLabels = [...chain];
    while (localLabels.length < 3) localLabels.splice(1, 0, "");
  } else {
    localLabels = [chain[0], chain[Math.floor(chain.length / 2)], chain[chain.length - 1]];
  }
  for (let i = 0; i < 3; i++) {
    if (localLabels[i]) {
      nodes.push({
        id: `lv_${i}`,
        type: "versionBox",
        x: LOCAL_POS[i].x, y: LOCAL_POS[i].y, w: 80, h: 52,
        label: localLabels[i],
      });
    }
  }

  // RPC version boxes (4 slots, left→right = newest→oldest)
  const RPC_POS = [
    { x: 820, y: 298 },
    { x: 925, y: 298 },
    { x: 1032, y: 298 },
    { x: 1135, y: 298 },
  ];
  const rpcReversed = chain.slice().reverse();
  let rpcLabels: string[];
  if (rpcReversed.length <= 4) {
    rpcLabels = [...rpcReversed];
    while (rpcLabels.length < 4) rpcLabels.push("");
  } else {
    rpcLabels = [
      rpcReversed[0],
      rpcReversed[1],
      rpcReversed[rpcReversed.length - 2],
      rpcReversed[rpcReversed.length - 1],
    ];
  }
  for (let i = 0; i < 4; i++) {
    if (rpcLabels[i]) {
      nodes.push({
        id: `tv_${i}`,
        type: "versionBox",
        x: RPC_POS[i].x, y: RPC_POS[i].y, w: 78, h: 52,
        label: rpcLabels[i],
      });
    }
  }

  // Synced version box
  nodes.push({
    id: "sv_0",
    type: "versionBox",
    x: 617, y: 649, w: 90, h: 48,
    label: v.target,
  });

  return nodes;
}

export function buildAllNodes(v: VersionVars): NodeDef[] {
  return [...STATIC_NODES, ...buildVersionNodes(v)];
}

// ── Edge definitions ──

export interface EdgeDef {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  color: "default" | "cyan" | "yellow";
  label?: string;
}

const STATIC_EDGES: EdgeDef[] = [
  // Pipeline
  { id: "e-git-cicd", source: "gitRepo", sourceHandle: "right", target: "cicd", targetHandle: "left", color: "default" },
  { id: "e-cicd-sql", source: "cicd", sourceHandle: "right", target: "sqlMigration", targetHandle: "left", color: "default" },
  { id: "e-cicd-store", source: "cicd", sourceHandle: "bottom", target: "appStore", targetHandle: "top", color: "default" },
  { id: "e-sql-pg", source: "sqlMigration", sourceHandle: "bottom", target: "postgres", targetHandle: "top", color: "default" },
  { id: "e-sql-info", source: "sqlMigration", sourceHandle: "bottom", target: "schemaInfo", targetHandle: "top", color: "default" },
  { id: "e-sql-rpc", source: "sqlMigration", sourceHandle: "bottom", target: "transformRpc", targetHandle: "top", color: "default" },
  { id: "e-store-update", source: "appStore", sourceHandle: "bottom", target: "clientUpdate", targetHandle: "top", color: "default" },

  // Client update
  { id: "e-update-local", source: "clientUpdate", sourceHandle: "bottom", target: "localOnly", targetHandle: "top", color: "default" },

  // Compat check
  { id: "e-check-info", source: "checkSchema", sourceHandle: "top", target: "schemaInfo", targetHandle: "bottom", color: "default" },

  // Upload / sync (cyan)
  { id: "e-local-synced", source: "localOnly", sourceHandle: "right", target: "synced", targetHandle: "left", color: "cyan", label: "Publish" },
  { id: "e-synced-crud", source: "synced", sourceHandle: "right", target: "psCrud", targetHandle: "left", color: "cyan" },
  { id: "e-crud-rpc", source: "psCrud", sourceHandle: "top", target: "transformRpc", targetHandle: "bottom", color: "cyan" },
  { id: "e-rpc-pg", source: "transformRpc", sourceHandle: "left", target: "postgres", targetHandle: "right", color: "cyan" },
  { id: "e-pg-sync", source: "postgres", sourceHandle: "bottom", target: "syncRules", targetHandle: "top", color: "cyan" },
  { id: "e-sync-synced", source: "syncRules", sourceHandle: "bottom", target: "synced", targetHandle: "top", color: "cyan" },
];

function buildVersionEdges(v: VersionVars): EdgeDef[] {
  const chain = getMigrationChain(v.phone, v.target);
  const edges: EdgeDef[] = [];

  // Local migration arrows (left→right, yellow)
  const localCount = Math.min(chain.length, 3);
  for (let i = 0; i < localCount - 1; i++) {
    edges.push({
      id: `e-lv${i}-lv${i + 1}`,
      source: `lv_${i}`, sourceHandle: "right",
      target: `lv_${i + 1}`, targetHandle: "left",
      color: "yellow", label: "Migrate",
    });
  }

  // RPC transform arrows (right→left = old→new, yellow)
  const rpcCount = Math.min(chain.length, 4);
  for (let i = rpcCount - 1; i > 0; i--) {
    edges.push({
      id: `e-tv${i}-tv${i - 1}`,
      source: `tv_${i}`, sourceHandle: "left",
      target: `tv_${i - 1}`, targetHandle: "right",
      color: "yellow",
    });
  }

  return edges;
}

export function buildAllEdges(v: VersionVars): EdgeDef[] {
  return [...STATIC_EDGES, ...buildVersionEdges(v)];
}

// ── Capability node IDs (progressively revealed; everything else is infrastructure = always visible) ──

export const CAPABILITY_IDS = new Set([
  "lv_0", "lv_1", "lv_2",
  "tv_0", "tv_1", "tv_2", "tv_3",
  "sv_0",
  "appSchemaVer",
]);

// ── Edge colors ──

export const EDGE_COLORS: Record<string, string> = {
  default: "var(--color-txt-dim)",
  cyan: "var(--color-accent-cyan)",
  yellow: "var(--color-accent-amber)",
};

// ── Scenario definitions ──

export interface MigrationStep {
  title: string;
  desc: string | ((v: VersionVars) => string);
  reveal: string[];
  activeEdges?: string[];
}

export interface MigrationScenario {
  id: string;
  buttonLabel: string;
  phaseLabel: string;
  phaseColor: string;
  steps: MigrationStep[];
}

export const SCENARIOS: MigrationScenario[] = [
  {
    id: "deploy",
    buttonLabel: "↗ Deploy",
    phaseLabel: "Deploying Schema Changes",
    phaseColor: "var(--color-accent-amber)",
    steps: [
      {
        title: "Developer writes migration files",
        desc: (v) =>
          `Three locations updated: SQL file in <code>supabase/migrations/</code>, client migration in <code>db/migrations/</code>, version bump to <code>${v.target}</code> in <code>db/constants.ts</code>.`,
        reveal: [],
        activeEdges: ["e-git-cicd"],
      },
      {
        title: "PR merged → CI/CD pipeline",
        desc: () =>
          `After code review, the PR merges into <code>main</code>. The CI/CD pipeline triggers automatically — deploying to Supabase.`,
        reveal: [],
        activeEdges: ["e-git-cicd", "e-cicd-sql"],
      },
      {
        title: "SQL migrations applied to production",
        desc: () =>
          `Supabase auto-applies all new timestamped migration files. This updates the schema DDL, <code>get_schema_info()</code>, and deploys new transform functions.`,
        reveal: [],
        activeEdges: ["e-sql-pg", "e-sql-info", "e-sql-rpc"],
      },
      {
        title: "Transform functions deployed",
        desc: (v) =>
          `The Transform RPC now has version-to-version functions for the <code>${v.phone}</code> → <code>${v.target}</code> chain. These handle uploads from older clients.`,
        reveal: ["tv_0", "tv_1", "tv_2", "tv_3"],
        activeEdges: ["e-sql-rpc"],
      },
      {
        title: "Sync layer updated",
        desc: () =>
          `PowerSync sync rules propagate any table or column changes. The replication pipeline is ready for new data shapes.`,
        reveal: [],
        activeEdges: ["e-pg-sync"],
      },
      {
        title: "App release is non-deterministic",
        desc: () =>
          `<strong class="text-accent-amber">The database is updated, but the new app hasn't shipped yet.</strong> Store review and user update timing are unpredictable — this is why backward compatibility is critical.`,
        reveal: [],
        activeEdges: ["e-cicd-store"],
      },
    ],
  },
  {
    id: "appUpdate",
    buttonLabel: "↻ App Update",
    phaseLabel: "Local Data Migration",
    phaseColor: "var(--color-accent-cyan)",
    steps: [
      {
        title: "User updates the app",
        desc: () =>
          `The user installs the new version from the app store. Old offline data persists on the device — it was written by the previous app version.`,
        reveal: [],
        activeEdges: ["e-store-update"],
      },
      {
        title: "New app carries updated version constant",
        desc: (v) =>
          `The app now carries <code>APP_SCHEMA_VERSION = '${v.target}'</code>. On startup it checks for outdated local data.`,
        reveal: ["appSchemaVer"],
        activeEdges: ["e-update-local"],
      },
      {
        title: "Old data detected in local-only tables",
        desc: (v) =>
          `<code>checkNeedsMigration()</code> finds local-only data stamped with <code>schema_version: '${v.phone}'</code>. A <code>MigrationNeededError</code> blocks the app until migration completes.`,
        reveal: ["lv_0"],
      },
      {
        title: "Client-side migration chain runs",
        desc: (v) => {
          const chain = getMigrationChain(v.phone, v.target);
          return `The new app brings migration code. <code>findMigrationPath()</code> builds: ${chain.map((ver) => `<code>${ver}</code>`).join(" → ")}. Each step transforms data at the JSON level — no temporary tables.`;
        },
        reveal: ["lv_1", "lv_2"],
        activeEdges: ["e-lv0-lv1", "e-lv1-lv2"],
      },
      {
        title: "Data migrated to latest version",
        desc: (v) =>
          `All local data is now at version <code>${v.target}</code>. The <code>MigrationScreen</code> dismisses and the app becomes interactive.`,
        reveal: [],
      },
      {
        title: "Ready to publish and sync",
        desc: (v) =>
          `Synced tables carry version <code>${v.target}</code>. Data is compatible with the latest Drizzle schema and ready for upload.`,
        reveal: ["sv_0"],
        activeEdges: ["e-local-synced"],
      },
    ],
  },
  {
    id: "upload",
    buttonLabel: "↑ Upload",
    phaseLabel: "Server-Side Upload Transform",
    phaseColor: "var(--color-accent-cyan)",
    steps: [
      {
        title: "Published data on device",
        desc: (v) =>
          `Data is in synced tables, stamped with <code>schema_version: '${v.target}'</code> via <code>getDefaultOpMetadata()</code>. <code>trackMetadata: true</code> ensures metadata persists in CRUD entries.`,
        reveal: ["lv_2", "sv_0"],
      },
      {
        title: "Data enters upload queue",
        desc: () =>
          `PowerSync creates CRUD entries in <code>ps_crud</code>. Each entry carries <code>_metadata.schema_version</code> — the version of the app that wrote the data.`,
        reveal: [],
        activeEdges: ["e-local-synced", "e-synced-crud"],
      },
      {
        title: "Upload reaches server RPC",
        desc: () =>
          `<code>uploadData()</code> reads <code>CrudEntry.metadata</code>, maps it to <code>client_meta</code>, and calls <code>apply_table_mutation_transaction</code>.`,
        reveal: ["tv_3"],
        activeEdges: ["e-crud-rpc"],
      },
      {
        title: "Transform chain runs",
        desc: (v) => {
          const chain = getMigrationChain(v.phone, v.target);
          return `Server detects the data's version and runs transforms: ${chain.map((ver) => `<code>v${ver}</code>`).join(" → ")}. Each <code>v{X}_to_v{Y}()</code> restructures the <code>mutation_op[]</code> array.`;
        },
        reveal: ["tv_2", "tv_1", "tv_0"],
        activeEdges: ["e-tv3-tv2", "e-tv2-tv1", "e-tv1-tv0"],
      },
      {
        title: "Transformed data applied to Postgres",
        desc: () =>
          `After all transforms, <code>_apply_single_json_dml()</code> executes the final ops inside a Postgres transaction.`,
        reveal: [],
        activeEdges: ["e-rpc-pg"],
      },
      {
        title: "Change syncs back to device",
        desc: () =>
          `The committed change flows through the WAL → PowerSync → sync rules → back to the client's synced tables.`,
        reveal: [],
        activeEdges: ["e-pg-sync", "e-sync-synced"],
      },
    ],
  },
  {
    id: "compat",
    buttonLabel: "⇌ Compat",
    phaseLabel: "Backward Compatibility",
    phaseColor: "var(--color-accent-purple)",
    steps: [
      {
        title: "App checks version on startup",
        desc: (v) =>
          `On init, the app reads <code>APP_SCHEMA_VERSION = '${v.target}'</code> and calls <code>checkAppUpgradeNeeded()</code>.`,
        reveal: ["appSchemaVer"],
        activeEdges: ["e-check-info"],
      },
      {
        title: "Server returns schema info",
        desc: (v) =>
          `<code>get_schema_info()</code> returns <code>{ schema_version: '${v.target}', min_required: '${v.minCompat}' }</code>. 2-second timeout prevents blocking offline users.`,
        reveal: [],
        activeEdges: ["e-check-info"],
      },
      {
        title: "Version meets minimum → proceed",
        desc: (v) =>
          `If <code>APP_SCHEMA_VERSION (${v.target}) ≥ min_required (${v.minCompat})</code>, the app starts normally. Server-side transforms bridge any remaining gap for uploaded data.`,
        reveal: [],
      },
      {
        title: "Version too old → forced upgrade",
        desc: (v) =>
          `If a client has <code>APP_SCHEMA_VERSION &lt; ${v.minCompat}</code>, an <code>AppUpgradeNeededError</code> blocks the app until the user updates from the store.`,
        reveal: [],
        activeEdges: ["e-store-update"],
      },
      {
        title: "Grace period by design",
        desc: (v) =>
          `<code>min_required (${v.minCompat})</code> is intentionally lower than <code>schema_version (${v.target})</code>. This creates a window where older apps still work. Server-side transforms handle their uploads; client-side migrations handle their local data.`,
        reveal: ["tv_0", "tv_1", "tv_2", "tv_3"],
      },
    ],
  },
  {
    id: "checklist",
    buttonLabel: "☐ Checklist",
    phaseLabel: "Developer Checklist",
    phaseColor: "var(--color-accent-pink)",
    steps: [
      {
        title: "1. Timestamped SQL migration",
        desc: () =>
          `Create <code>supabase/migrations/YYYYMMDDHHMMSS_desc.sql</code>. Contains schema DDL, transform functions, and <code>get_schema_info()</code> bump.`,
        reveal: [],
        activeEdges: ["e-git-cicd", "e-cicd-sql"],
      },
      {
        title: "2. Server transform functions",
        desc: () =>
          `Add <code>v{X}_to_v{Y}()</code> PL/pgSQL functions. Update the <code>IF/ELSIF</code> chain in <code>apply_table_mutation</code> and <code>apply_table_mutation_transaction</code>.`,
        reveal: ["tv_0", "tv_1", "tv_2", "tv_3"],
        activeEdges: ["e-tv3-tv2", "e-tv2-tv1", "e-tv1-tv0"],
      },
      {
        title: "3. Bump get_schema_info()",
        desc: (v) =>
          `<code>CREATE OR REPLACE get_schema_info()</code> → <code>schema_version: '${v.target}'</code>, <code>min_required: '${v.minCompat}'</code>.`,
        reveal: [],
        activeEdges: ["e-sql-info"],
      },
      {
        title: "4. Client migration file",
        desc: () =>
          `Create <code>db/migrations/X.X-to-Y.Y.ts</code> implementing the <code>Migration</code> interface: <code>fromVersion</code>, <code>toVersion</code>, <code>migrate(db, onProgress)</code>.`,
        reveal: ["lv_0", "lv_1", "lv_2"],
        activeEdges: ["e-lv0-lv1", "e-lv1-lv2"],
      },
      {
        title: "5. Register in migration array",
        desc: () =>
          `Import and add to <code>migrations[]</code> in <code>db/migrations/index.ts</code>. Order matters — migrations run sequentially.`,
        reveal: [],
      },
      {
        title: "6. Bump APP_SCHEMA_VERSION",
        desc: (v) =>
          `Update to <code>'${v.target}'</code> in <code>db/constants.ts</code>. Drives metadata stamping, migration detection, and server compatibility checks.`,
        reveal: ["appSchemaVer"],
      },
      {
        title: "7. Update Drizzle schema",
        desc: () =>
          `Update table/column definitions in <code>drizzleSchema*.ts</code> files (synced, local, shared columns).`,
        reveal: ["sv_0"],
      },
      {
        title: "8. Update sync rules",
        desc: () =>
          `If new tables/columns need syncing: update <code>sync-rules.yml</code> and add <code>ALTER PUBLICATION</code> in the SQL migration file.`,
        reveal: [],
        activeEdges: ["e-pg-sync"],
      },
      {
        title: "9. CI/CD + App Store",
        desc: () =>
          `Merge PR to trigger CI/CD. Submit new app build to the store. Remember: the DB updates first — backward compatibility is essential.`,
        reveal: [],
        activeEdges: ["e-git-cicd", "e-cicd-sql", "e-cicd-store", "e-store-update"],
      },
      {
        title: "10. Update the website",
        desc: () =>
          `The LangQuest website shares the same Postgres database. Update it for any new columns, changed types, or new tables introduced by the migration.`,
        reveal: [],
      },
    ],
  },
];
