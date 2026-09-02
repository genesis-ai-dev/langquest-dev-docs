/**
 * Sync the future Process / Review template system into IcePanel.
 * Source doc: template-design-documents/review-template-system.md
 */
import type {
  LandscapeImportData,
  ModelConnectionImport,
  ModelObjectImport
} from '@icepanel/sdk';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createClient, env, root } from './client.js';
import { dconn, dobj } from './diagramUtils.js';
import { ids } from './ids.js';
import { reviewConn, reviewIds } from './reviewIds.js';

async function loadReviewImport(): Promise<LandscapeImportData> {
  const raw = await readFile(resolve(root, 'model/review-template.yaml'), 'utf8');
  return parseYaml(raw) as LandscapeImportData;
}

function sortObjects(objects: ModelObjectImport[]): ModelObjectImport[] {
  const rank = (type: string) =>
    ({ domain: 0, actor: 1, system: 1, group: 2, app: 3, store: 3, component: 4 })[type] ?? 9;
  return [...objects].sort((a, b) => rank(a.type) - rank(b.type));
}

async function upsertReviewModel(client: ReturnType<typeof createClient>) {
  const body = await loadReviewImport();
  const objects = sortObjects(body.modelObjects ?? []);
  const connections = body.modelConnections ?? [];

  console.log(
    `Upserting review model (${objects.length} objects, ${connections.length} connections)...`
  );

  for (const obj of objects) {
    if (obj.type === 'domain') continue;
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
    console.log(`  ${obj.status ?? 'live'} ${obj.type}: ${obj.name}`);
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
}

function buildReviewContextDiagram() {
  const objects = {
    dTranslator: dobj('dTranslator', ids.translator, 'actor', 40, 200, 150, 90),
    dReviewer: dobj('dReviewer', reviewIds.reviewer, 'actor', 40, 360, 150, 90),
    dEditor: dobj('dEditor', reviewIds.editor, 'actor', 40, 40, 150, 90),
    dWebsite: dobj('dWebsite', reviewIds.website, 'system', 280, 40, 200, 90),
    dMobile: dobj('dMobile', reviewIds.mobile, 'system', 280, 280, 200, 90),
    dPowerSync: dobj('dPowerSync', reviewIds.powersync, 'system', 560, 280, 180, 90),
    dSupabase: dobj('dSupabase', reviewIds.supabase, 'system', 840, 200, 200, 100)
  };

  const connections = {
    [reviewConn.editorConfiguresWebsite]: dconn(
      objects,
      reviewConn.editorConfiguresWebsite,
      'dEditor',
      'dWebsite',
      'right-middle',
      'left-middle',
      { bend: 30 }
    ),
    [reviewConn.reviewerUsesMobile]: dconn(
      objects,
      reviewConn.reviewerUsesMobile,
      'dReviewer',
      'dMobile',
      'right-middle',
      'left-middle',
      { bend: 30 }
    ),
    I4xcopOnu1Yqer3sk1nD: dconn(
      objects,
      'I4xcopOnu1Yqer3sk1nD',
      'dTranslator',
      'dMobile',
      'right-middle',
      'left-middle',
      { bend: -30 }
    ),
    [reviewConn.syncsAssignments]: dconn(
      objects,
      reviewConn.syncsAssignments,
      'dPowerSync',
      'dSupabase',
      'right-middle',
      'left-middle',
      { bend: 40 }
    ),
    SK14zqOjt7CKVHnckFmw: dconn(
      objects,
      'SK14zqOjt7CKVHnckFmw',
      'dMobile',
      'dPowerSync',
      'right-middle',
      'left-middle',
      { bend: 35 }
    ),
    '8C19e8Rf33BKSSwriKSu': dconn(
      objects,
      '8C19e8Rf33BKSSwriKSu',
      'dWebsite',
      'dSupabase',
      'right-middle',
      'top-center',
      { bend: -50 }
    )
  };

  return { objects, connections, comments: {} };
}

function buildReviewDataPlaneDiagram() {
  // L2 inside Supabase — review stores + reducer
  const objects = {
    dWf: dobj('dWf', reviewIds.workflowTemplate, 'store', 40, 40, 200, 70),
    dAssign: dobj('dAssign', reviewIds.assignment, 'store', 40, 180, 200, 70),
    dGroups: dobj('dGroups', reviewIds.projectGroup, 'store', 40, 320, 200, 70),
    dLinks: dobj('dLinks', reviewIds.assetLink, 'store', 40, 460, 200, 70),
    dDecision: dobj('dDecision', reviewIds.reviewDecision, 'store', 320, 180, 200, 70),
    dSubmission: dobj('dSubmission', reviewIds.reviewSubmission, 'store', 600, 180, 200, 70),
    dReducer: dobj('dReducer', reviewIds.reviewReducer, 'app', 320, 320, 200, 80),
    dEvent: dobj('dEvent', reviewIds.reviewEvent, 'store', 600, 320, 200, 70),
    dPostgres: dobj('dPostgres', reviewIds.postgres, 'store', 600, 460, 200, 70),
    dPs: dobj('dPs', reviewIds.powersync, 'system', 320, 40, 200, 70)
  };

  const c = reviewConn;
  const connections = {
    [c.syncsAssignments]: dconn(objects, c.syncsAssignments, 'dPs', 'dAssign', 'bottom-center', 'top-center', {
      bend: 40
    }),
    [c.syncsDecisions]: dconn(objects, c.syncsDecisions, 'dPs', 'dDecision', 'bottom-center', 'top-center', {
      bend: -40
    }),
    [c.triggersReducer]: dconn(
      objects,
      c.triggersReducer,
      'dDecision',
      'dReducer',
      'bottom-center',
      'top-center',
      { bend: 50 }
    ),
    [c.readsTemplateGuards]: dconn(
      objects,
      c.readsTemplateGuards,
      'dReducer',
      'dWf',
      'left-middle',
      'right-middle',
      { bend: 60 }
    ),
    [c.appendsEvents]: dconn(
      objects,
      c.appendsEvents,
      'dReducer',
      'dEvent',
      'right-middle',
      'left-middle',
      { bend: 40 }
    ),
    [c.projectsSubmission]: dconn(
      objects,
      c.projectsSubmission,
      'dReducer',
      'dSubmission',
      'top-center',
      'bottom-center',
      { bend: -50 }
    ),
    [c.templateInPostgres]: dconn(
      objects,
      c.templateInPostgres,
      'dWf',
      'dPostgres',
      'bottom-center',
      'left-middle',
      { bend: 70 }
    ),
    [c.eventsInPostgres]: dconn(
      objects,
      c.eventsInPostgres,
      'dEvent',
      'dPostgres',
      'bottom-center',
      'top-center',
      { bend: 40 }
    )
  };

  return { objects, connections, comments: {} };
}

function buildSubmitReviewFlowSteps() {
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

  add('r0', 0, 'Future — submit & multi-phase review (proposal)', 'introduction', null, null);
  add(
    'r1',
    1,
    'Coordinator configures workflow on Website',
    'outgoing',
    reviewIds.editor,
    reviewIds.website,
    'Publish workflow_template; map project_phase_group; create review assignments'
  );
  add(
    'r2',
    2,
    'Translator completes work / submits quest',
    'outgoing',
    ids.translator,
    reviewIds.mobile,
    'quest.submission_state → submitted; review_submission created'
  );
  add(
    'r3',
    3,
    'Client rows sync via PowerSync',
    'outgoing',
    reviewIds.mobile,
    reviewIds.powersync
  );
  add(
    'r4',
    4,
    'PowerSync → Supabase (assignments / decisions)',
    'outgoing',
    reviewIds.powersync,
    reviewIds.supabase
  );
  add(
    'r5',
    5,
    'Reviewer writes decisions in app',
    'outgoing',
    reviewIds.reviewer,
    reviewIds.mobile
  );
  add(
    'r6',
    6,
    'Review Reducer evaluates template guards',
    'outgoing',
    reviewIds.supabase,
    reviewIds.supabase,
    'DB trigger: append review_event; project phase/submission state (server-only log)'
  );
  add(
    'r7',
    7,
    'Phase advances or rework / approved_final',
    'conclusion',
    null,
    null,
    'Signoff at group_slot then phase; opt-in — projects without workflow keep votes'
  );

  return steps;
}

async function upsertReviewViews(client: ReturnType<typeof createClient>) {
  const ctx = buildReviewContextDiagram();
  console.log('Upserting context diagram: Process review (future)...');
  const ctxResult = await client.diagrams.upsert({
    landscapeId: env.landscapeId,
    versionId: env.versionId,
    diagramId: reviewIds.diagramReviewContext,
    body: {
      index: 1,
      // Context diagrams hang off the landscape root in this IcePanel org (not a system).
      modelId: ids.root,
      name: 'Process review (future)',
      type: 'context-diagram',
      description:
        'Proposed multi-phase review: Website configures workflow templates; Mobile does work/decisions; Supabase reduces review_event server-side. Status: future.',
      objects: ctx.objects,
      connections: ctx.connections,
      comments: ctx.comments
    }
  });
  const ctxId = ctxResult.diagram?.id ?? reviewIds.diagramReviewContext;
  console.log(`  context diagram: ${ctxId}`);

  const plane = buildReviewDataPlaneDiagram();
  console.log('Upserting app diagram: Review data plane (future)...');
  await client.diagrams.upsert({
    landscapeId: env.landscapeId,
    versionId: env.versionId,
    diagramId: reviewIds.diagramReviewDataPlane,
    body: {
      index: 2,
      modelId: reviewIds.supabase,
      name: 'Review data plane (future)',
      type: 'app-diagram',
      description:
        'Inside Supabase: workflow_template JSONB, synced assignment/decision rows, server-only review_event + Review Reducer trigger (C10, C14).',
      objects: plane.objects,
      connections: plane.connections,
      comments: plane.comments
    }
  });
  console.log(`  data-plane diagram: ${reviewIds.diagramReviewDataPlane}`);

  console.log('Upserting flow: Submit → review phases...');
  await client.flows.upsert({
    landscapeId: env.landscapeId,
    versionId: env.versionId,
    flowId: reviewIds.flowSubmitReview,
    body: {
      name: 'Submit → multi-phase review (future)',
      diagramId: ctxId,
      showAllSteps: true,
      showConnectionNames: true,
      steps: buildSubmitReviewFlowSteps()
    }
  });
  console.log(`  flow: ${reviewIds.flowSubmitReview}`);
}

async function upsertReviewAdr(client: ReturnType<typeof createClient>) {
  console.log('Creating ADR for process template decisions...');
  // handleId format "handle-id": alphanumeric, length 8–14 (not the 20-char object id format).
  const handleId = 'adrProcTpl01';
  try {
    await client.adrs.create({
      landscapeId: env.landscapeId,
      versionId: env.versionId,
      body: {
        name: 'Process template: fork-always + server-side review reducer',
        status: 'draft',
        handleId,
        description:
          'Future review/workflow system — JSONB workflow_template, event-sourced review_event, clients write rows only.',
        content: `# Process template: fork-always + server-side review reducer

## Status
Draft / not shipped. See \`template-design-documents/review-template-system.md\`.

## Context
LangQuest needs configurable multi-phase review (e.g. ETEN Team → Community → Blessing Board) without baking partner process into the app. Content templates ship first; process templates reference work via assignments, not direct template FKs.

## Decision
1. **workflow_template** as single JSONB row (phases + group_slots), fork-always, website-only edit (C1–C3).
2. **String refs** into JSONB for phase_id / group_slot_id with tombstones (C4).
3. **project_group** is the unit of assignment and review; \`project_phase_group\` maps slots → groups (C5).
4. **One assignment mechanism** for translation/rework/review/approve (C6–C7).
5. **review_event** is append-only, server-only, never synced; projections via DB trigger reducer (C10, C14).
6. Clients only write rows (decisions, comments, flags) synced via PowerSync — no client transition RPC.
7. Opt-in: projects without a workflow keep vote-based approval (C11).

## Consequences
- Audit trail and "which process ran?" come from the event log, not a pinned template version pointer.
- Fork adoption uses compatibility checks on referenced opaque ids.
- Template systems (content / library / process) stay separate; joined only at the assignment/work layer.
`
      }
    });
    console.log(`  ADR created (draft, handleId=${handleId})`);
  } catch (err) {
    console.warn('  ADR create skipped/failed (may already exist):', err);
  }
}

async function main() {
  const client = createClient();
  await upsertReviewModel(client);
  await upsertReviewViews(client);
  await upsertReviewAdr(client);
  console.log(`
Done. In IcePanel open:
  • Diagram "Process review (future)" + flow "Submit → multi-phase review (future)"
  • Diagram "Review data plane (future)" (under Supabase)
  • ADR: Process template: fork-always + server-side review reducer
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
