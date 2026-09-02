import type {
  LandscapeImportData,
  ModelConnectionImport,
  ModelObjectImport
} from '@icepanel/sdk';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createClient, env, root } from './client.js';
import { conn, ids } from './ids.js';

/**
 * IcePanel's bulk /import endpoint does not reliably upsert objects that were
 * first created via MCP/UI (ALREADY_EXISTS). Prefer per-entity SDK upserts.
 * YAML still follows LandscapeImportData so it can be UI-imported on a fresh landscape.
 */

async function loadImportData(): Promise<LandscapeImportData> {
  const path = resolve(root, 'model/landscape-import.yaml');
  const raw = await readFile(path, 'utf8');
  return parseYaml(raw) as LandscapeImportData;
}

function sortObjectsForUpsert(objects: ModelObjectImport[]): ModelObjectImport[] {
  const rank = (type: string) =>
    ({ domain: 0, actor: 1, system: 1, group: 2, app: 3, store: 3, component: 4 })[type] ?? 9;
  return [...objects].sort((a, b) => rank(a.type) - rank(b.type));
}

async function upsertModel(client: ReturnType<typeof createClient>) {
  const body = await loadImportData();
  const objects = sortObjectsForUpsert(body.modelObjects ?? []);
  const connections = body.modelConnections ?? [];

  console.log(
    `Upserting model (${objects.length} objects, ${connections.length} connections)...`
  );

  for (const obj of objects) {
    if (obj.type === 'domain') {
      // Domain already exists in this landscape; skip.
      continue;
    }

    // Import YAML uses domain as parent for actors/systems.
    // REST upsert in this landscape expects the root object as parent.
    const underDomain = obj.parentId === ids.domain;
    const parentId = underDomain ? ids.root : (obj.parentId ?? ids.root);

    await client.model.objects.upsert({
      landscapeId: env.landscapeId,
      versionId: env.versionId,
      modelObjectId: obj.id,
      body: {
        name: obj.name,
        type: obj.type as Exclude<ModelObjectImport['type'], 'domain'>,
        parentId,
        domainId: ids.domain,
        caption: obj.caption,
        description: obj.description,
        external: obj.external,
        status: obj.status,
        tagIds: obj.tagIds,
        technologyIds: obj.technologyIds,
        teamIds: obj.teamIds,
        groupIds: obj.groupIds,
        labels: obj.labels
      }
    });
    console.log(`  object ${obj.type}: ${obj.name}`);
  }

  for (const c of connections as ModelConnectionImport[]) {
    await client.model.connections.upsert({
      landscapeId: env.landscapeId,
      versionId: env.versionId,
      modelConnectionId: c.id,
      body: {
        name: c.name,
        direction: c.direction,
        originId: c.originId,
        targetId: c.targetId,
        description: c.description,
        status: c.status,
        tagIds: c.tagIds,
        technologyIds: c.technologyIds,
        labels: c.labels,
        viaId: c.viaId
      }
    });
    console.log(`  connection: ${c.name}`);
  }

  await attachTechnologies(client);
  console.log('Model upsert completed');
}

async function attachTechnologies(client: ReturnType<typeof createClient>) {
  console.log('Attaching catalog technologies...');
  for (const [key, technologyIds] of Object.entries(objectTechnologies)) {
    const modelObjectId = ids[key as keyof typeof ids];
    if (!modelObjectId || !technologyIds?.length) continue;
    await client.model.objects.update({
      landscapeId: env.landscapeId,
      versionId: env.versionId,
      modelObjectId,
      body: { technologyIds }
    });
    console.log(`  tech → ${key}: ${technologyIds.join(', ')}`);
  }
}

type DiagramObject = {
  id: string;
  modelId: string;
  type: 'actor' | 'app' | 'component' | 'store' | 'system' | 'group';
  shape: 'box' | 'area';
  x: number;
  y: number;
  width: number;
  height: number;
};

type DiagramConnection = {
  id: string;
  modelId: string;
  originId: string;
  targetId: string;
  originConnector: 'right-middle' | 'left-middle' | 'bottom-center' | 'top-center';
  targetConnector: 'right-middle' | 'left-middle' | 'bottom-center' | 'top-center';
  lineShape: 'curved' | 'straight' | 'square';
  labelPosition: number;
  points: Array<{ x: number; y: number }>;
};

function dobj(
  id: string,
  modelId: string,
  type: DiagramObject['type'],
  x: number,
  y: number,
  width = 180,
  height = 90
): DiagramObject {
  return { id, modelId, type, shape: 'box', x, y, width, height };
}

function anchor(
  obj: DiagramObject,
  connector: DiagramConnection['originConnector']
): { x: number; y: number } {
  switch (connector) {
    case 'left-middle':
      return { x: obj.x, y: obj.y + obj.height / 2 };
    case 'right-middle':
      return { x: obj.x + obj.width, y: obj.y + obj.height / 2 };
    case 'top-center':
      return { x: obj.x + obj.width / 2, y: obj.y };
    case 'bottom-center':
      return { x: obj.x + obj.width / 2, y: obj.y + obj.height };
  }
}

function dconn(
  objects: Record<string, DiagramObject>,
  modelConnectionId: string,
  originDiagramId: string,
  targetDiagramId: string,
  originConnector: DiagramConnection['originConnector'] = 'right-middle',
  targetConnector: DiagramConnection['targetConnector'] = 'left-middle',
  options: {
    /** Perpendicular offset (px) so the label sits in open space, not on a box. */
    bend?: number;
  } = {}
): DiagramConnection {
  const origin = objects[originDiagramId];
  const target = objects[targetDiagramId];
  if (!origin || !target) {
    throw new Error(`Missing diagram object for connection ${modelConnectionId}`);
  }
  const from = anchor(origin, originConnector);
  const to = anchor(target, targetConnector);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = options.bend ?? 48;
  // Push the midpoint off the straight line so IcePanel places the label in a gap.
  const mid = {
    x: (from.x + to.x) / 2 + (-dy / len) * bend,
    y: (from.y + to.y) / 2 + (dx / len) * bend
  };

  return {
    id: modelConnectionId,
    modelId: modelConnectionId,
    originId: originDiagramId,
    targetId: targetDiagramId,
    originConnector,
    targetConnector,
    lineShape: 'curved',
    labelPosition: 0.5,
    points: [from, mid, to]
  };
}

/** Catalog technology IDs from IcePanel (attach via model object technologyIds). */
const tech = {
  supabase: '1aUmrxbw4ZWRPtTxuf3u',
  sqlite: '6MZFjMqn4mLaL59WGjTW',
  postgres: 'AtAwOo48GPChCWOkPkkj',
  expo: 'lUp488ExfltXycrdXbHe',
  reactNative: '1IcouQR9nAJ15lSlAjmT'
} as const;

const objectTechnologies: Partial<Record<keyof typeof ids, string[]>> = {
  mobile: [tech.expo, tech.reactNative],
  mobileClient: [tech.expo, tech.reactNative],
  supabase: [tech.supabase],
  supabaseAuth: [tech.supabase],
  postgres: [tech.postgres],
  sqlite: [tech.sqlite]
};

/** App/container diagram for Mobile with auth internals + external systems. */
function buildAuthDiagramContent() {
  // Wider columns + more vertical gaps so connection labels have room.
  const objects: Record<string, DiagramObject> = {
    dTranslator: dobj('dTranslator', ids.translator, 'actor', 40, 280, 150, 100),
    dMobileClient: dobj('dMobileClient', ids.mobileClient, 'app', 280, 40, 220, 70),
    dSignIn: dobj('dSignIn', ids.signInView, 'component', 280, 160, 220, 70),
    dConnector: dobj('dConnector', ids.supabaseConnector, 'component', 280, 300, 220, 70),
    dAuthProvider: dobj('dAuthProvider', ids.authProvider, 'component', 280, 440, 220, 70),
    dPsSystem: dobj('dPsSystem', ids.powersyncSystem, 'component', 280, 580, 220, 70),
    dAsync: dobj('dAsync', ids.asyncStorage, 'store', 640, 160, 170, 70),
    dPsSdk: dobj('dPsSdk', ids.powersyncSdk, 'app', 640, 400, 190, 80),
    dSqlite: dobj('dSqlite', ids.sqlite, 'store', 640, 580, 170, 70),
    dPowerSync: dobj('dPowerSync', ids.powersync, 'system', 980, 400, 190, 90),
    dAuth: dobj('dAuth', ids.supabaseAuth, 'app', 1280, 120, 200, 70),
    dSupabase: dobj('dSupabase', ids.supabase, 'system', 1280, 280, 200, 80),
    dPostgres: dobj('dPostgres', ids.postgres, 'store', 1280, 460, 200, 70)
  };

  const connections: Record<string, DiagramConnection> = {
    [conn.translatorSubmitsSignIn]: dconn(
      objects,
      conn.translatorSubmitsSignIn,
      'dTranslator',
      'dSignIn',
      'right-middle',
      'left-middle',
      { bend: 36 }
    ),
    [conn.signInCallsConnector]: dconn(
      objects,
      conn.signInCallsConnector,
      'dSignIn',
      'dConnector',
      'bottom-center',
      'top-center',
      { bend: 70 }
    ),
    [conn.connectorAuthPassword]: dconn(
      objects,
      conn.connectorAuthPassword,
      'dConnector',
      'dAuth',
      'right-middle',
      'left-middle',
      { bend: -80 }
    ),
    [conn.authReturnsSession]: dconn(
      objects,
      conn.authReturnsSession,
      'dAuth',
      'dConnector',
      'left-middle',
      'right-middle',
      { bend: 90 }
    ),
    [conn.connectorPersistsSession]: dconn(
      objects,
      conn.connectorPersistsSession,
      'dConnector',
      'dAsync',
      'right-middle',
      'left-middle',
      { bend: -40 }
    ),
    [conn.authNotifiesProvider]: dconn(
      objects,
      conn.authNotifiesProvider,
      'dAuth',
      'dAuthProvider',
      'bottom-center',
      'right-middle',
      { bend: 70 }
    ),
    [conn.providerInitsSystem]: dconn(
      objects,
      conn.providerInitsSystem,
      'dAuthProvider',
      'dPsSystem',
      'bottom-center',
      'top-center',
      { bend: 70 }
    ),
    [conn.systemConnectsSdk]: dconn(
      objects,
      conn.systemConnectsSdk,
      'dPsSystem',
      'dPsSdk',
      'right-middle',
      'left-middle',
      { bend: 40 }
    ),
    [conn.sdkFetchesJwt]: dconn(
      objects,
      conn.sdkFetchesJwt,
      'dPsSdk',
      'dConnector',
      'left-middle',
      'right-middle',
      { bend: -100 }
    ),
    [conn.sdkSyncsPowersync]: dconn(
      objects,
      conn.sdkSyncsPowersync,
      'dPsSdk',
      'dPowerSync',
      'right-middle',
      'left-middle',
      { bend: 35 }
    ),
    [conn.sdkUsesSqlite]: dconn(
      objects,
      conn.sdkUsesSqlite,
      'dPsSdk',
      'dSqlite',
      'bottom-center',
      'top-center',
      { bend: 60 }
    ),
    [conn.powersyncReplicates]: dconn(
      objects,
      conn.powersyncReplicates,
      'dPowerSync',
      'dSupabase',
      'right-middle',
      'left-middle',
      { bend: -50 }
    )
  };

  return { objects, connections, comments: {} };
}

function buildAuthFlowSteps() {
  const steps: Record<
    string,
    {
      id: string;
      index: number;
      description: string;
      detailedDescription?: string;
      type: 'introduction' | 'outgoing' | 'self-action' | 'conclusion' | 'information';
      originId: string | null;
      targetId: string | null;
      viaId: string | null;
      parentId: string | null;
      flowId: string | null;
      paths: Record<string, never> | null;
    }
  > = {};

  const add = (
    id: string,
    index: number,
    description: string,
    type: 'introduction' | 'outgoing' | 'self-action' | 'conclusion' | 'information',
    originId: string | null,
    targetId: string | null,
    detailedDescription?: string
  ) => {
    steps[id] = {
      id,
      index,
      description,
      detailedDescription,
      type,
      originId,
      targetId,
      viaId: null,
      parentId: null,
      flowId: null,
      paths: null
    };
  };

  add('step-intro', 0, 'Auth happy path (online email/password)', 'introduction', null, null);
  add(
    'step-1',
    1,
    'Translator submits credentials',
    'outgoing',
    ids.translator,
    ids.signInView,
    'SignInView — online check, then login()'
  );
  add(
    'step-2',
    2,
    'SignInView → SupabaseConnector.login()',
    'outgoing',
    ids.signInView,
    ids.supabaseConnector
  );
  add(
    'step-3',
    3,
    'signInWithPassword → Supabase Auth',
    'outgoing',
    ids.supabaseConnector,
    ids.supabaseAuth
  );
  add(
    'step-4',
    4,
    'Session + JWT returned',
    'outgoing',
    ids.supabaseAuth,
    ids.supabaseConnector
  );
  add(
    'step-5',
    5,
    'Session persisted to AsyncStorage',
    'outgoing',
    ids.supabaseConnector,
    ids.asyncStorage
  );
  add(
    'step-6',
    6,
    'AuthProvider handles SIGNED_IN',
    'outgoing',
    ids.supabaseAuth,
    ids.authProvider
  );
  add(
    'step-7',
    7,
    'AuthProvider → system.init()',
    'outgoing',
    ids.authProvider,
    ids.powersyncSystem
  );
  add(
    'step-8',
    8,
    'System connects PowerSync SDK',
    'outgoing',
    ids.powersyncSystem,
    ids.powersyncSdk
  );
  add(
    'step-9',
    9,
    'SDK fetchCredentials() (JWT)',
    'outgoing',
    ids.powersyncSdk,
    ids.supabaseConnector
  );
  add(
    'step-10',
    10,
    'SDK connects to PowerSync service',
    'outgoing',
    ids.powersyncSdk,
    ids.powersync
  );
  add(
    'step-11',
    11,
    'PowerSync replicates with Supabase/Postgres',
    'outgoing',
    ids.powersync,
    ids.supabase
  );
  add(
    'step-done',
    12,
    'User lands on home; sync may still finish in background',
    'conclusion',
    null,
    null
  );

  return steps;
}

async function upsertAuthDiagram(client: ReturnType<typeof createClient>) {
  const content = buildAuthDiagramContent();
  console.log('Upserting Mobile auth diagram...');

  const result = await client.diagrams.upsert({
    landscapeId: env.landscapeId,
    versionId: env.versionId,
    diagramId: ids.diagramMobileAuth,
    body: {
      index: 0,
      modelId: ids.mobile,
      name: 'Mobile — Auth & Sync',
      type: 'app-diagram',
      description:
        'Zoomed view of email/password sign-in and PowerSync connect (ships today).',
      objects: content.objects,
      connections: content.connections,
      comments: content.comments
    }
  });

  console.log(`Diagram upserted: ${result.diagram?.id ?? ids.diagramMobileAuth}`);
  return result.diagram?.id ?? ids.diagramMobileAuth;
}

async function upsertAuthFlow(
  client: ReturnType<typeof createClient>,
  diagramId: string
) {
  console.log('Upserting auth happy-path flow...');
  const result = await client.flows.upsert({
    landscapeId: env.landscapeId,
    versionId: env.versionId,
    flowId: ids.flowAuthHappyPath,
    body: {
      name: 'Sign-in happy path',
      diagramId,
      showAllSteps: true,
      showConnectionNames: true,
      steps: buildAuthFlowSteps()
    }
  });
  console.log(`Flow upserted: ${result.flow?.id ?? ids.flowAuthHappyPath}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const modelOnly = args.has('--model-only');
  const viewsOnly = args.has('--views-only');
  const client = createClient();

  if (!viewsOnly) {
    await upsertModel(client);
  }
  if (!modelOnly) {
    const diagramId = await upsertAuthDiagram(client);
    await upsertAuthFlow(client, diagramId);
  }

  console.log(
    'Done. Open LangQuest → diagram "Mobile — Auth & Sync" → flow "Sign-in happy path".'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
