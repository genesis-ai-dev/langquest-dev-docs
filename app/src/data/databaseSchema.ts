import type { FieldDef } from "../components/SchemaNode";
import type { DiagramNodeDef, DiagramEdgeDef } from "../components/DiagramShell";
import type { Step } from "../components/StepWalkthrough";

function F(name: string, o?: Partial<FieldDef>): FieldDef {
  return { name, ...o };
}

const DP =
  "UUID[] of users who flagged this record for offline sync. Stamped by closure-based download RPCs.";

// ─── Inline diagram HTML fragments ───

const DIA_QUEST_TREE = `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-cyan">Bible Project</b><br/>
&nbsp;&nbsp;└ <b class="text-accent-purple">Mark</b> <span class="text-txt-dim text-[.5rem]">book quest · parent_id = null</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;└ <b class="text-accent-green">Chapter 2</b> <span class="text-txt-dim text-[.5rem]">parent_id → Mark</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├ <span class="text-txt-muted">Verse 1</span> <span class="text-txt-dim text-[.5rem]">asset</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└ <span class="text-txt-muted">Verse 2</span> <span class="text-txt-dim text-[.5rem]">asset</span></div>`;

const DIA_ASSET_TRI = `<svg viewBox="0 0 290 72" width="290" height="72" style="margin:6px 0 2px;display:block">
<rect x="90" y="2" width="110" height="20" rx="4" fill="none" stroke="var(--color-accent-cyan)" stroke-width="1"/>
<text x="145" y="15" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="var(--color-accent-cyan)">Source Asset</text>
<line x1="115" y1="22" x2="55" y2="48" stroke="var(--color-accent-purple)" stroke-width="1" stroke-dasharray="3 2"/>
<line x1="175" y1="22" x2="235" y2="48" stroke="var(--color-accent-purple)" stroke-width="1" stroke-dasharray="3 2"/>
<text x="62" y="39" font-family="JetBrains Mono,monospace" font-size="6" fill="var(--color-txt-dim)">source_asset_id</text>
<text x="195" y="39" font-family="JetBrains Mono,monospace" font-size="6" fill="var(--color-txt-dim)">source_asset_id</text>
<rect x="2" y="48" width="106" height="20" rx="4" fill="none" stroke="var(--color-accent-purple)" stroke-width="1"/>
<text x="55" y="62" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="7" fill="var(--color-accent-purple)">Translation asset</text>
<rect x="182" y="48" width="106" height="20" rx="4" fill="none" stroke="var(--color-accent-purple)" stroke-width="1"/>
<text x="235" y="62" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="7" fill="var(--color-accent-purple)">Transcription asset</text></svg>`;

function flowPills(items: { label: string; color: string }[]): string {
  return `<div class="flex items-center gap-1 flex-wrap mt-2 mb-0.5 font-mono text-[.58rem]">${items
    .map(
      (it, i) =>
        `${i > 0 ? '<span class="text-txt-dim text-[.5rem]">→</span>' : ""}<span class="px-2 py-px rounded-[10px] border whitespace-nowrap" style="border-color:${it.color};color:${it.color}">${it.label}</span>`,
    )
    .join("")}</div>`;
}

const DIA_INVITE = flowPills([
  { label: "owner sends invite", color: "var(--color-accent-purple)" },
  { label: "pending", color: "var(--color-accent-amber)" },
  { label: "trigger finds profile", color: "var(--color-txt-muted)" },
  { label: "syncs to recipient", color: "var(--color-accent-green)" },
  { label: "accepted / declined", color: "var(--color-accent-green)" },
]);

const DIA_CLONE = flowPills([
  { label: "0 seed_project", color: "var(--color-accent-red)" },
  { label: "1 clone_quests", color: "var(--color-accent-red)" },
  { label: "2 clone_assets", color: "var(--color-accent-red)" },
  { label: "3 clone_acl", color: "var(--color-accent-red)" },
  { label: "4 recreate_links", color: "var(--color-accent-red)" },
  { label: "5 recompute_closures", color: "var(--color-accent-red)" },
]);

const DIA_DOWNLOAD = flowPills([
  { label: "user taps Download", color: "var(--color-accent-amber)" },
  { label: "read closure IDs", color: "var(--color-txt-muted)" },
  { label: "stamp download_profiles[]", color: "var(--color-accent-purple)" },
  { label: "PowerSync syncs to device", color: "var(--color-accent-green)" },
]);

const DIA_ALIAS =
  flowPills([
    { label: "Spanish", color: "var(--color-accent-cyan)" },
  ]) +
  `<div class="flex items-center gap-1 flex-wrap font-mono text-[.58rem]">
<span class="text-txt-dim text-[.5rem]">← subject ─</span>
<span class="px-2 py-px rounded-[10px] border whitespace-nowrap bg-code-bg" style="border-color:var(--color-accent-pink);color:var(--color-accent-pink)">alias: "espagnol"</span>
<span class="text-txt-dim text-[.5rem]">─ label →</span>
<span class="px-2 py-px rounded-[10px] border whitespace-nowrap" style="border-color:var(--color-accent-green);color:var(--color-accent-green)">French</span></div>
<div class="text-[.6rem] text-txt-dim mt-0.5 font-mono">If subject = label → endonym · otherwise → exonym</div>`;

// ─── Section definitions ───

export interface SchemaSection {
  id: string;
  label: string;
  phaseColor: string;
  diagramTitle: string;
  nodes: DiagramNodeDef[];
  edges: DiagramEdgeDef[];
  steps: Step[];
}

export const SECTIONS: SchemaSection[] = [
  {
    id: "primary",
    label: "Primary chain",
    phaseColor: "var(--color-accent-cyan)",
    diagramTitle: "Spine — content & collaboration",
    nodes: [
      { id: "n-project", title: "project", sub: "workspace", x: 117, y: 128, w: 200, fields: [
        F("id", { pk: true }), F("name"), F("creator_id"),
        F("template", { hint: "Project type: unstructured, bible, or fia. Will evolve into linked template records." }),
        F("private", { hint: "When true, only members can contribute." }),
        F("visible", { hint: "Controls whether the project appears in public listings." }),
        F("download_profiles", { hint: DP }),
      ]},
      { id: "n-quest", title: "quest", sub: "unit of work", x: 458, y: 106, w: 200, fields: [
        F("id", { pk: true }), F("project_id", { fk: { node: "n-project", field: "id" } }),
        F("parent_id", { fk: { node: "n-quest", field: "id" }, selfRef: true, hint: "Nesting: book quests hold chapter quests. No depth limit." }),
        F("name"), F("active"),
        F("metadata", { hint: "Template-specific positioning, e.g. which book/chapter this quest maps to." }),
        F("download_profiles", { hint: DP }),
      ]},
      { id: "n-qal", title: "quest_asset_link", sub: "M:N join", x: 784, y: 106, w: 200, fields: [
        F("quest_id", { fk: { node: "n-quest", field: "id" } }), F("asset_id", { fk: { node: "n-asset", field: "id" } }),
        F("active"), F("visible"), F("download_profiles", { hint: DP }),
      ]},
      { id: "n-asset", title: "asset", sub: "translatable unit", x: 458, y: 326, w: 220, fields: [
        F("id", { pk: true }), F("project_id", { fk: { node: "n-project", field: "id" } }),
        F("parent_id", { fk: { node: "n-asset", field: "id" }, selfRef: true, hint: "Unused/forgotten. Hierarchy uses source_asset_id instead." }),
        F("content_type", { hint: "'source', 'translation', or 'transcription'. Translations link back via source_asset_id." }),
        F("source_asset_id", { fk: { node: "n-asset", field: "id" }, selfRef: true, hint: "Points to the original source asset this translation/transcription was derived from." }),
        F("order_index", { hint: "Preserves display order of assets within a quest." }),
        F("metadata", { hint: "Verse or labelling information for templated content." }),
        F("download_profiles", { hint: DP }),
      ]},
      { id: "n-acl", title: "asset_content_link", sub: "text / audio", x: 783, y: 325, w: 220, fields: [
        F("id", { pk: true }), F("asset_id", { fk: { node: "n-asset", field: "id" } }),
        F("languoid_id", { hint: "Language of this particular expression of the asset." }),
        F("text"),
        F("audio", { hint: "Filename of the audio file in Supabase Storage." }),
        F("order_index", { hint: "Ordering from the experimental asset merge feature." }),
        F("text_search_vector", { hint: "Auto-generated tsvector for full-text search." }),
        F("download_profiles", { hint: DP }),
      ]},
      { id: "n-vote", title: "vote", sub: "feedback", x: 782, y: 592, w: 200, fields: [
        F("id", { pk: true }), F("asset_id", { fk: { node: "n-asset", field: "id" } }),
        F("polarity", { hint: "Quality rating on a translation or transcription." }),
        F("comment"),
        F("translation_id", { hint: "Legacy column from before asset-based translations. No FK enforced." }),
        F("creator_id"), F("active"), F("download_profiles", { hint: DP }),
      ]},
    ],
    edges: [
      { from: "n-quest", fromField: "project_id", to: "n-project", toField: "id" },
      { from: "n-qal", fromField: "quest_id", to: "n-quest", toField: "id" },
      { from: "n-qal", fromField: "asset_id", to: "n-asset", toField: "id" },
      { from: "n-asset", fromField: "project_id", to: "n-project", toField: "id" },
      { from: "n-acl", fromField: "asset_id", to: "n-asset", toField: "id" },
      { from: "n-vote", fromField: "asset_id", to: "n-asset", toField: "id" },
    ],
    steps: [
      { title: "Overview: the spine", description: 'The <strong>project → quest → asset</strong> chain forms the spine of user-generated language data. Each level adds structure: projects scope an effort, quests organize units of work, and assets hold the actual translatable content. <strong>Drag</strong> any table to rearrange; click <strong>▶</strong> to expand fields; hover <strong>?</strong> icons for field details.', highlightNodes: ["n-project", "n-quest", "n-qal", "n-asset", "n-acl", "n-vote"] },
      { title: "project", description: 'A <strong>project</strong> represents a collaborative effort to translate content from/into a particular language. It links to members (see Membership tab), content, and languages (see Languoid tab). Settings control whether the project is <code>active</code>, <code>visible</code>, and <code>private</code>.', highlightNodes: ["n-project"] },
      { title: "quest", description: 'A <strong>quest</strong> is like a folder. In templated projects (Bible, FIA), quests are predefined — e.g. book quests at the root, chapter quests nested within. In unstructured projects, users define them freely. No nesting limit.' + DIA_QUEST_TREE, highlightNodes: ["n-quest"] },
      { title: "quest_asset_link", description: 'Originally a junction table for M:N (overlapping passages sharing verses). Now also enables <strong>quest versioning</strong> — users A and B can submit their own versions of the same templated quest, and a future "remix" feature will let users pick assets across versions without duplicating them.', highlightNodes: ["n-qal"] },
      { title: "asset", description: 'An <strong>asset</strong> is a small translatable unit — a verse, a line, a recording. All modalities (audio, image, text) represent the same piece of information. Translations and transcriptions are also assets, linking back to the source via <code>source_asset_id</code>.' + DIA_ASSET_TRI, highlightNodes: ["n-asset"] },
      { title: "asset_content_link", description: 'Stores different <strong>expressions</strong> of the same asset — e.g. the same verse in multiple Bible translations or languages. Each row has text and/or audio for one expression, keyed by <code>languoid_id</code>. The <code>audio</code> field holds a filename pointing to Supabase Storage.', highlightNodes: ["n-acl"] },
      { title: "vote", description: 'Votes rate the quality of translations and transcriptions — not the source content itself. <code>polarity</code> captures the rating. The <code>translation_id</code> column is legacy from before translations became assets; no FK is enforced.', highlightNodes: ["n-vote"] },
    ],
  },
  {
    id: "membership",
    label: "Membership",
    phaseColor: "var(--color-accent-purple)",
    diagramTitle: "Users & project access",
    nodes: [
      { id: "m-profile", title: "profile", sub: "auth.users", x: 68, y: 225, w: 210, fields: [
        F("id", { pk: true, hint: "Same UUID as auth.users(id). Created by Supabase Auth." }),
        F("username"), F("email"),
        F("ui_languoid_id", { hint: "User's preferred UI language." }),
        F("active"), F("terms_accepted"),
      ]},
      { id: "m-ppl", title: "profile_project_link", sub: "owner | member", x: 509, y: 25, w: 230, fields: [
        F("profile_id", { fk: { node: "m-profile", field: "id" } }),
        F("project_id", { fk: { node: "m-proj", field: "id" } }),
        F("membership", { hint: "'owner' or 'member'. Owners can manage settings and members." }),
        F("active"), F("download_profiles", { hint: DP }),
      ]},
      { id: "m-proj", title: "project", sub: "", x: 955, y: 231, w: 180, fields: [
        F("id", { pk: true }), F("name"),
        F("creator_id", { fk: { node: "m-profile", field: "id" } }),
        F("private"), F("visible"),
      ]},
      { id: "m-invite", title: "invite", sub: "email flow", x: 510, y: 205, w: 220, fields: [
        F("id", { pk: true }),
        F("sender_profile_id", { fk: { node: "m-profile", field: "id" } }),
        F("receiver_profile_id", { fk: { node: "m-profile", field: "id" }, hint: "Auto-populated by trigger when a matching profile is found or later created." }),
        F("project_id", { fk: { node: "m-proj", field: "id" } }),
        F("email", { hint: "Target email. A trigger uses this to find/link profile." }),
        F("status", { hint: "pending → accepted | declined | withdrawn" }),
        F("as_owner", { hint: "If true, the invitee joins as an owner." }),
        F("count", { hint: "Limits re-invites — prevents repeated declining." }),
      ]},
      { id: "m-request", title: "request", sub: "join request", x: 511, y: 459, w: 220, fields: [
        F("id", { pk: true }),
        F("sender_profile_id", { fk: { node: "m-profile", field: "id" } }),
        F("project_id", { fk: { node: "m-proj", field: "id" } }),
        F("status", { hint: "pending → accepted | declined | withdrawn. Once accepted by one owner, cannot be declined by another." }),
        F("count", { hint: "Limits repeat requests to the same project." }),
      ]},
    ],
    edges: [
      { from: "m-ppl", fromField: "profile_id", to: "m-profile", toField: "id" },
      { from: "m-ppl", fromField: "project_id", to: "m-proj", toField: "id" },
      { from: "m-invite", fromField: "sender_profile_id", to: "m-profile", toField: "id" },
      { from: "m-invite", fromField: "project_id", to: "m-proj", toField: "id" },
      { from: "m-request", fromField: "sender_profile_id", to: "m-profile", toField: "id" },
      { from: "m-request", fromField: "project_id", to: "m-proj", toField: "id" },
    ],
    steps: [
      { title: "Membership overview", description: 'Brings users together into projects. <strong>profile_project_link</strong> is the steady-state membership; <strong>invite</strong> (owner-initiated) and <strong>request</strong> (user-initiated) handle the inbound flows.', highlightNodes: ["m-profile", "m-ppl", "m-proj", "m-invite", "m-request"] },
      { title: "profile", description: 'Mirrors <code>auth.users</code> — same UUID as PK. Stores username, email, avatar, terms acceptance, and <code>ui_languoid_id</code> for the user\'s preferred interface language.', highlightNodes: ["m-profile"] },
      { title: "profile_project_link", description: 'Junction table: one user can have many projects, one project can have many users. Composite PK (<code>profile_id</code>, <code>project_id</code>) with <code>membership</code> as owner or member.', highlightNodes: ["m-ppl", "m-proj"] },
      { title: "invite", description: 'When an owner invites by email, the <code>receiver_profile_id</code> starts blank. A <strong>trigger</strong> finds or waits for a matching profile and auto-populates it. Once populated, sync rules deliver the invite to the recipient.' + DIA_INVITE, highlightNodes: ["m-invite"] },
      { title: "request", description: 'Sent by someone wanting access to a project, synced to every owner. Once an owner accepts, no other owner can decline it. The <code>count</code> field limits repeat requests.', highlightNodes: ["m-request"] },
    ],
  },
  {
    id: "languoid",
    label: "Languoid / region",
    phaseColor: "var(--color-accent-green)",
    diagramTitle: "Languages & geography",
    nodes: [
      { id: "lg-languoid", title: "languoid", sub: "tree", x: 401, y: 90, w: 180, fields: [
        F("id", { pk: true }),
        F("parent_id", { fk: { node: "lg-languoid", field: "id" }, selfRef: true, hint: "Links to parent in the family tree: family → language → dialect." }),
        F("name", { hint: "Standard English name for easy reference in the DB." }),
        F("level", { hint: "Enum: family, language, or dialect." }),
        F("ui_ready", { hint: "If true, has enough alias data to be used as a UI language." }),
        F("active"), F("creator_id"),
      ]},
      { id: "lg-alias", title: "languoid_alias", sub: "", x: 709, y: 91, w: 190, fields: [
        F("id", { pk: true }),
        F("subject_languoid_id", { fk: { node: "lg-languoid", field: "id" }, hint: "The languoid being named." }),
        F("label_languoid_id", { fk: { node: "lg-languoid", field: "id" }, hint: "The language in which this name is expressed." }),
        F("name"),
        F("alias_type", { hint: "endonym (subject = label) or exonym (different)." }),
        F("source_names", { hint: "Which databases provided this alias." }),
      ]},
      { id: "lg-src", title: "languoid_source", sub: "", x: 708, y: 285, w: 180, fields: [
        F("id", { pk: true }),
        F("languoid_id", { fk: { node: "lg-languoid", field: "id" } }),
        F("name", { hint: "Authority: Glottolog, WALS, ISO, Wikipedia, etc." }),
        F("version"),
        F("unique_identifier", { hint: "The code/ID used by this authority for this languoid." }),
        F("url"),
      ]},
      { id: "lg-prop", title: "languoid_property", sub: "", x: 708, y: 477, w: 190, fields: [
        F("id", { pk: true }),
        F("languoid_id", { fk: { node: "lg-languoid", field: "id" } }),
        F("key", { hint: "E.g. latitude, longitude, macroareas, category." }),
        F("value"),
      ]},
      { id: "lg-region", title: "region", sub: "tree", x: 399, y: 636, w: 180, fields: [
        F("id", { pk: true }),
        F("parent_id", { fk: { node: "lg-region", field: "id" }, selfRef: true, hint: "Hierarchy for sub-regions. Currently only countries." }),
        F("name"),
        F("level", { hint: "Currently only countries, but structured for sub-regions." }),
        F("geometry", { hint: "Whether geographic boundary data exists." }),
        F("active"),
      ]},
      { id: "lg-lr", title: "languoid_region", sub: "", x: 62, y: 262, w: 200, fields: [
        F("id", { pk: true }),
        F("languoid_id", { fk: { node: "lg-languoid", field: "id" } }),
        F("region_id", { fk: { node: "lg-region", field: "id" } }),
        F("majority", { hint: "Is this the majority language in the region?" }),
        F("official", { hint: "Is this an official language of the region?" }),
        F("native", { hint: "Is this language native to the region?" }),
      ]},
      { id: "lg-ralias", title: "region_alias", sub: "", x: 710, y: 637, w: 190, fields: [
        F("id", { pk: true }),
        F("subject_region_id", { fk: { node: "lg-region", field: "id" }, hint: "The region being named." }),
        F("label_languoid_id", { fk: { node: "lg-languoid", field: "id" }, hint: "Language of the name." }),
        F("name"),
      ]},
      { id: "lg-rsrc", title: "region_source", sub: "", x: 708, y: 790, w: 180, fields: [
        F("id", { pk: true }),
        F("region_id", { fk: { node: "lg-region", field: "id" } }),
        F("name", { hint: "Authority name, e.g. ISO3166-1." }), F("version"), F("url"),
      ]},
      { id: "lg-rprop", title: "region_property", sub: "", x: 706, y: 966, w: 190, fields: [
        F("id", { pk: true }),
        F("region_id", { fk: { node: "lg-region", field: "id" } }),
        F("key", { hint: "Arbitrary key-value metadata." }), F("value"),
      ]},
      { id: "lg-pll", title: "project_language_link", sub: "source | target", x: 25, y: 59, w: 240, fields: [
        F("project_id"),
        F("languoid_id", { fk: { node: "lg-languoid", field: "id" } }),
        F("language_type", { hint: "'source' or 'target' — direction of translation." }),
        F("active"), F("download_profiles", { hint: DP }),
      ]},
    ],
    edges: [
      { from: "lg-alias", fromField: "subject_languoid_id", to: "lg-languoid", toField: "id" },
      { from: "lg-src", fromField: "languoid_id", to: "lg-languoid", toField: "id" },
      { from: "lg-prop", fromField: "languoid_id", to: "lg-languoid", toField: "id" },
      { from: "lg-lr", fromField: "languoid_id", to: "lg-languoid", toField: "id" },
      { from: "lg-lr", fromField: "region_id", to: "lg-region", toField: "id" },
      { from: "lg-ralias", fromField: "subject_region_id", to: "lg-region", toField: "id" },
      { from: "lg-rsrc", fromField: "region_id", to: "lg-region", toField: "id" },
      { from: "lg-rprop", fromField: "region_id", to: "lg-region", toField: "id" },
      { from: "lg-pll", fromField: "languoid_id", to: "lg-languoid", toField: "id" },
    ],
    steps: [
      { title: "Languages & places", description: 'An adaptation of the <strong>Glottolog</strong> languoid database. "Languoid" covers families, languages, and dialects in a tree. Regions mirror the same pattern for geography. <code>project_language_link</code> binds projects to source/target languoids.', highlightNodes: ["lg-languoid", "lg-region", "lg-pll"] },
      { title: "project_language_link", description: "PK (<code>project_id</code>, <code>languoid_id</code>, <code>language_type</code>). Should technically be called project_languoid_link — name kept from an older schema version.", highlightNodes: ["lg-pll"] },
      { title: "languoid", description: 'Families, languages, and dialects. The <code>parent_id</code> captures family-tree lineage. <code>level</code> is an enum (family, language, dialect). <code>name</code> is a standard English label for quick reference.', highlightNodes: ["lg-languoid"] },
      { title: "languoid_alias", description: "All available names for a given languoid, in its language and others. Two FKs point to languoid: <strong>subject</strong> (what's being named) and <strong>label</strong> (in what language)." + DIA_ALIAS, highlightNodes: ["lg-alias"] },
      { title: "languoid_source & property", description: '<strong>Source</strong> stores links and codes from authorities (Glottolog, WALS, ISO, Wikipedia, etc.). <strong>Property</strong> is a catch-all key-value basket: latitude, longitude, macroareas, category.', highlightNodes: ["lg-src", "lg-prop"] },
      { title: "languoid_region", description: 'Which languoids exist in which regions. Flags: <code>majority</code>, <code>official</code>, <code>native</code>.', highlightNodes: ["lg-lr"] },
      { title: "region", description: 'Currently only countries, but structured with <code>parent_id</code> for sub-regions. <code>geometry</code> tracks whether boundary data exists.', highlightNodes: ["lg-region"] },
      { title: "region_alias, source, property", description: 'Same pattern as the languoid side. <strong>region_alias</strong> names regions in different languages. <strong>region_source</strong> currently holds ISO3166-1 entries. <strong>region_property</strong> is currently empty.', highlightNodes: ["lg-ralias", "lg-rsrc", "lg-rprop"] },
    ],
  },
  {
    id: "closure",
    label: "Download profiles",
    phaseColor: "var(--color-accent-amber)",
    diagramTitle: "Closure rollups",
    nodes: [
      { id: "c-pc", title: "project_closure", sub: "per project", x: 60, y: 80, w: 260, fields: [
        F("project_id", { pk: true }), F("asset_ids"), F("quest_ids"), F("vote_ids"),
        F("total_quests"), F("total_assets"),
        F("total_translations", { hint: "Count includes asset_content_link rows (legacy naming)." }),
        F("approved_translations", { hint: "Translations with enough positive votes." }),
        F("download_profiles", { hint: DP }), F("last_updated"),
      ]},
      { id: "c-qc", title: "quest_closure", sub: "per quest", x: 420, y: 80, w: 260, fields: [
        F("quest_id"), F("project_id"), F("asset_ids"), F("total_assets"),
        F("approved_translations", { hint: "Translations with enough positive votes." }),
        F("download_profiles", { hint: DP }), F("last_updated"),
      ]},
    ],
    edges: [{ from: "c-qc", fromField: "project_id", to: "c-pc", toField: "project_id", dash: true }],
    steps: [
      { title: "Why closures exist", description: 'Almost every table has a <code>download_profiles</code> column — a UUID[] of users who flagged a record for offline sync. Stamping this per-record would be expensive, so <strong>closure tables</strong> precompute all related IDs in one place, enabling bulk-stamp downloads.' + DIA_DOWNLOAD, highlightNodes: ["c-pc", "c-qc"] },
      { title: "project_closure", description: 'One row per project. JSON arrays of every related record ID (assets, quests, votes, tags, links). Also stores aggregate counts (<code>total_assets</code>, <code>total_translations</code>) for UI progress display. Rolled up across all quest closures in the project.', highlightNodes: ["c-pc"] },
      { title: "quest_closure", description: 'One row per quest. Kept up to date by <strong>Postgres triggers</strong> that fire on insert/update of quest_asset_link, translations, and votes. Full-rebuild safety-net functions also exist for bulk operations and dev seeding.', highlightNodes: ["c-qc"] },
    ],
  },
  {
    id: "cloning",
    label: "Cloning",
    phaseColor: "var(--color-accent-red)",
    diagramTitle: "Clone jobs & id maps",
    nodes: [
      { id: "cl-mp", title: "map_project", sub: "", x: 40, y: 60, w: 180, fields: [
        F("job_id", { fk: { node: "cl-job", field: "id" } }),
        F("src_id", { hint: "UUID of the original record." }),
        F("dst_id", { hint: "UUID of the cloned copy." }), F("created_at"),
      ]},
      { id: "cl-mq", title: "map_quest", sub: "", x: 40, y: 260, w: 180, fields: [
        F("job_id", { fk: { node: "cl-job", field: "id" } }),
        F("src_id", { hint: "UUID of the original record." }),
        F("dst_id", { hint: "UUID of the cloned copy." }), F("created_at"),
      ]},
      { id: "cl-job", title: "clone_job", sub: "", x: 320, y: 140, w: 220, fields: [
        F("id", { pk: true }),
        F("root_project_id", { hint: "The source project being cloned." }),
        F("status", { hint: "queued → running → done | failed" }),
        F("options", { hint: "New project name, target language, creator ID." }),
        F("progress", { hint: "Current stage (0-5) and batch cursor within that stage." }),
        F("created_at"), F("updated_at"),
      ]},
      { id: "cl-ma", title: "map_asset", sub: "", x: 640, y: 60, w: 180, fields: [
        F("job_id", { fk: { node: "cl-job", field: "id" } }),
        F("src_id", { hint: "UUID of the original record." }),
        F("dst_id", { hint: "UUID of the cloned copy." }), F("created_at"),
      ]},
      { id: "cl-mac", title: "map_acl", sub: "acl = asset_content_link", x: 640, y: 260, w: 180, fields: [
        F("job_id", { fk: { node: "cl-job", field: "id" } }),
        F("src_id", { hint: "UUID of the original record." }),
        F("dst_id", { hint: "UUID of the cloned copy." }), F("created_at"),
      ]},
    ],
    edges: [
      { from: "cl-mp", fromField: "job_id", to: "cl-job", toField: "id" },
      { from: "cl-mq", fromField: "job_id", to: "cl-job", toField: "id" },
      { from: "cl-ma", fromField: "job_id", to: "cl-job", toField: "id" },
      { from: "cl-mac", fromField: "job_id", to: "cl-job", toField: "id" },
    ],
    steps: [
      { title: "Cloning subschema", description: "Cloning duplicates a project's structure into a new project, optionally with a different target language. The process runs server-side as a batched, queue-driven state machine via a Supabase Edge Function (<code>clone-worker</code>). Each stage is idempotent — if the worker crashes, it picks up where it left off." + DIA_CLONE, highlightNodes: ["cl-job", "cl-mp", "cl-mq", "cl-ma", "cl-mac"] },
      { title: "clone_job", description: 'Tracks a single cloning operation. The edge function picks up <code>queued</code> jobs from a <strong>pgmq</strong> queue and calls <code>perform_clone_step</code> repeatedly. A session variable <code>app.clone_mode = \'on\'</code> suppresses normal triggers during cloning.', highlightNodes: ["cl-job"] },
      { title: "map_project, map_quest, map_asset", description: 'Old-to-new ID mapping tables. Each row says "for this job, source record X became destination record Y." Makes cloning <strong>idempotent</strong> (skip already-mapped records) and lets later stages look up new IDs when recreating links.', highlightNodes: ["cl-mp", "cl-mq", "cl-ma"] },
      { title: "map_acl", description: "Same pattern for <strong>asset_content_link</strong> records (acl = asset content link). Used in stage 3 when remapping content to newly created assets.", highlightNodes: ["cl-mac"] },
    ],
  },
  {
    id: "secondary",
    label: "Secondary",
    phaseColor: "var(--color-accent-blue)",
    diagramTitle: "Tags, exports, moderation",
    nodes: [
      { id: "s-tag", title: "tag", sub: "", x: 40, y: 60, w: 160, fields: [
        F("id", { pk: true }),
        F("key", { hint: "Tag category, e.g. 'book', 'chapter', 'verse'." }),
        F("value", { hint: "Tag value, e.g. 'Mark', '2', '1'." }),
        F("active"), F("download_profiles", { hint: DP }),
      ]},
      { id: "s-qtl", title: "quest_tag_link", sub: "", x: 260, y: 60, w: 200, fields: [
        F("quest_id"), F("tag_id", { fk: { node: "s-tag", field: "id" } }), F("active"), F("download_profiles", { hint: DP }),
      ]},
      { id: "s-atl", title: "asset_tag_link", sub: "", x: 520, y: 60, w: 200, fields: [
        F("asset_id"), F("tag_id", { fk: { node: "s-tag", field: "id" } }), F("active"), F("download_profiles", { hint: DP }),
      ]},
      { id: "s-sug", title: "languoid_link_suggestion", sub: "", x: 780, y: 60, w: 240, fields: [
        F("id", { pk: true }),
        F("languoid_id", { hint: "User's custom offline-created languoid." }),
        F("suggested_languoid_id", { hint: "Existing languoid that may be the same." }),
        F("profile_id"),
        F("status", { hint: "pending → accepted | dismissed" }),
        F("match_rank", { hint: "1=exact, 2=starts-with, 3=contains, 4-6=fuzzy." }),
      ]},
      { id: "s-eqa", title: "export_quest_artifact", sub: "", x: 40, y: 260, w: 240, fields: [
        F("id", { pk: true }), F("quest_id"), F("project_id"),
        F("export_type", { hint: "'feedback' (temporary share link) or 'distribution' (long-term)." }),
        F("status", { hint: "pending → processing → ready | failed | ingested" }),
        F("share_token", { hint: "Unique token for temporary sharing links." }),
        F("checksum", { hint: "Hash of sorted source asset IDs for idempotency." }),
        F("metadata", { hint: "Manifest + optional template data (e.g. Bible book/chapter)." }),
        F("created_by"),
      ]},
      { id: "s-rep", title: "reports", sub: "", x: 340, y: 260, w: 200, fields: [
        F("id", { pk: true }),
        F("record_id", { hint: "Polymorphic: UUID of the reported record." }),
        F("record_table", { hint: "Polymorphic: which table the reported record is in." }),
        F("reporter_id"), F("reason"), F("details"),
      ]},
      { id: "s-inbox", title: "upload_inbox", sub: "dead-letter", x: 600, y: 260, w: 200, fields: [
        F("id", { pk: true }),
        F("data", { hint: "The failed upload payload as JSON." }),
        F("logs", { hint: "Processing log for debugging." }),
        F("error_code", { hint: "Machine-readable error category." }),
        F("ref_code", { hint: "Reference for correlating with user reports." }),
      ]},
    ],
    edges: [
      { from: "s-qtl", fromField: "tag_id", to: "s-tag", toField: "id" },
      { from: "s-atl", fromField: "tag_id", to: "s-tag", toField: "id" },
    ],
    steps: [
      { title: "Secondary features", description: "Labeling, exports, moderation, and error recovery. These are orthogonal to the core spine but linked by foreign keys or polymorphic references.", highlightNodes: ["s-tag", "s-qtl", "s-atl", "s-sug", "s-eqa", "s-rep", "s-inbox"] },
      { title: "tag & links", description: "Tags were originally for labelling assets/quests with things like book, chapter, verse — so users could create them in their own language and filter by them. Infrequently used now, but has potential. Key/value pairs attached via junction tables.", highlightNodes: ["s-tag", "s-qtl", "s-atl"] },
      { title: "languoid_link_suggestion", description: 'When users create custom languoids offline, a <strong>trigger</strong> searches for existing matches by name, alias, or ISO code. Up to 5 ranked suggestions are created. Accepting one rewrites all references and deactivates the custom languoid.', highlightNodes: ["s-sug"] },
      { title: "export_quest_artifact", description: "Concatenates a quest's audio segments into a single MP3 for distribution or feedback. The <code>checksum</code> (hash of sorted asset IDs) prevents redundant re-exports. Server-side only — not synced to devices.", highlightNodes: ["s-eqa"] },
      { title: "reports", description: 'Allows users to report content or other users. Uses <strong>polymorphic</strong> <code>record_table</code> + <code>record_id</code> to point at any record. Required by app stores for UGC apps.', highlightNodes: ["s-rep"] },
      { title: "upload_inbox", description: "A <strong>dead-letter table</strong> for failed uploads. Payloads are dumped here with error/ref codes for dev inspection. Not referenced in app code — used for manual debugging.", highlightNodes: ["s-inbox"] },
    ],
  },
  {
    id: "potential",
    label: "Potential",
    phaseColor: "var(--color-accent-pink)",
    diagramTitle: "Unused — have potential",
    nodes: [
      { id: "p-not", title: "notification", sub: "", x: 40, y: 60, w: 220, fields: [
        F("id", { pk: true }), F("profile_id"),
        F("target_table_name", { hint: "Polymorphic: which table." }),
        F("target_record_id", { hint: "Polymorphic: which record." }),
        F("viewed", { hint: "Whether the user has seen this notification." }),
      ]},
      { id: "p-sub", title: "subscription", sub: "", x: 320, y: 60, w: 220, fields: [
        F("id", { pk: true }), F("profile_id"),
        F("target_table_name", { hint: "Polymorphic: table to watch for changes." }),
        F("target_record_id", { hint: "Polymorphic: specific record to watch." }),
        F("active"),
      ]},
      { id: "p-flag", title: "flag", sub: "dictionary", x: 600, y: 60, w: 160, fields: [
        F("id", { pk: true }), F("name", { hint: "Named flag for dev-side content tagging. Not currently referenced in app code." }),
      ]},
      { id: "p-prp", title: "project_rollup_progress", sub: "", x: 40, y: 260, w: 260, fields: [
        F("project_id"),
        F("last_seen_quest_id", { hint: "Cursor: last quest processed during incremental rollup." }),
        F("last_seen_quest_created_at", { hint: "Timestamp cursor for ordering." }),
        F("updated_at"),
      ]},
    ],
    edges: [],
    steps: [
      { title: "Potential tables", description: "These tables exist in the schema and have infrastructure wired up, but aren't actively used in the app yet. They represent future features that can be activated when needed.", highlightNodes: ["p-not", "p-sub", "p-flag", "p-prp"] },
      { title: "notification", description: 'Generic notification pointing a user to a target record via polymorphic fields. In practice, notifications are currently driven by querying invites/requests directly. The intent was to notify users of new content in quests or assets they had subscribed to.', highlightNodes: ["p-not"] },
      { title: "subscription", description: "Lets a user subscribe to changes on a specific record. Intended to power \"watch this project/quest\" style notifications. The infrastructure exists but isn't heavily used yet.", highlightNodes: ["p-sub"] },
      { title: "flag", description: "Named flags for dev-side content tagging (e.g. inappropriate content). Each row is a named flag that can be toggled active/inactive. Not currently referenced in app code.", highlightNodes: ["p-flag"] },
      { title: "project_rollup_progress", description: "Tracks incremental progress when rolling up quest closures into project_closure. Remembers the last processed quest so it can resume without re-aggregating everything. Mostly unused, but has potential when we start tracking rollup progress again.", highlightNodes: ["p-prp"] },
    ],
  },
  {
    id: "tertiary",
    label: "Tertiary",
    phaseColor: "var(--color-txt-dim)",
    diagramTitle: "Operational helpers",
    nodes: [
      { id: "t-bat", title: "bible_audio_timestamp", sub: "", x: 40, y: 60, w: 220, fields: [
        F("id", { pk: true }),
        F("audio_fileset_id", { hint: "ID from Bible Brain / Digital Bible Platform API." }),
        F("book_id"), F("chapter"),
        F("timestamps", { hint: "jsonb array mapping verse numbers to start/end times." }),
      ]},
      { id: "t-bc", title: "blocked_content", sub: "", x: 320, y: 60, w: 200, fields: [
        F("id", { pk: true }), F("profile_id"),
        F("content_id", { hint: "Polymorphic: UUID of the hidden content." }),
        F("content_table", { hint: "Polymorphic: table of the hidden content." }),
      ]},
      { id: "t-bu", title: "blocked_users", sub: "", x: 580, y: 60, w: 200, fields: [
        F("blocker_id"), F("blocked_id"), F("active"),
      ]},
      { id: "t-llm", title: "language_languoid_map", sub: "migration bridge", x: 40, y: 260, w: 240, fields: [
        F("language_id", { hint: "Old language table UUID." }),
        F("languoid_id", { hint: "New languoid table UUID." }),
        F("created_at"),
      ]},
    ],
    edges: [],
    steps: [
      { title: "Tertiary overview", description: "Operational helpers: Bible timing data, moderation pairs, and a migration bridge. Click <strong>▶</strong> to inspect columns and <strong>?</strong> for field details." },
      { title: "bible_audio_timestamp", description: 'Per-verse timing data for Bible audio files from the <strong>Bible Brain API</strong>. Supplements missing timestamps. Our own pipeline (<code>fia</code> repo) can generate them too. Used by the <code>bible-brain-content</code> edge function to split chapter audio into verse segments.', highlightNodes: ["t-bat"] },
      { title: "blocked_content", description: 'Per-user content hides using the <strong>polymorphic</strong> <code>content_id</code> + <code>content_table</code> pattern. The app filters out matching records from queries for that user.', highlightNodes: ["t-bc"] },
      { title: "blocked_users", description: 'User-level blocks. All content from the blocked user is filtered out of queries (translations, votes, etc.) for the blocker. Composite PK on (<code>blocker_id</code>, <code>blocked_id</code>).', highlightNodes: ["t-bu"] },
      { title: "language_languoid_map", description: 'Migration bridge from the old flat <code>language</code> table to the hierarchical <code>languoid</code> system. Only referenced in migration SQL, not in app code.', highlightNodes: ["t-llm"] },
    ],
  },
  {
    id: "expired",
    label: "Expired / legacy",
    phaseColor: "var(--color-txt-muted)",
    diagramTitle: "Legacy",
    nodes: [
      { id: "e-lang", title: "language", sub: "deprecated", x: 80, y: 80, w: 220, fields: [
        F("id", { pk: true }),
        F("iso639_3", { hint: "ISO 639-3 language code." }),
        F("native_name", { hint: "Name in the language's own script." }),
        F("english_name"),
        F("ui_ready", { hint: "Has enough data for UI display." }),
        F("creator_id"),
      ]},
      { id: "e-tr", title: "translation", sub: "deprecated", x: 420, y: 80, w: 220, fields: [
        F("id", { pk: true }),
        F("asset_id", { hint: "The source asset being translated." }),
        F("target_language_id", { hint: "Legacy FK to the old language table." }),
        F("text"),
        F("audio", { hint: "Audio filename in storage." }),
        F("creator_id"),
      ]},
    ],
    edges: [{ from: "e-tr", fromField: "target_language_id", to: "e-lang", toField: "id", dash: true }],
    steps: [
      { title: "Legacy tables", description: 'Both tables are <strong>superseded</strong>. <code>language</code> replaced by the hierarchical <code>languoid</code> subschema. <code>translation</code> replaced by assets with <code>content_type=\'translation\'</code> and <code>source_asset_id</code>. Still exist because some old FKs and quest_closure triggers haven\'t been fully migrated.', highlightNodes: ["e-lang", "e-tr"] },
      { title: "language", description: 'The original flat language catalog — English name, native name, ISO 639-3 code. Replaced by the <code>languoid</code> table and its subschema. The <code>language_languoid_map</code> table bridges old IDs to new ones.', highlightNodes: ["e-lang"] },
      { title: "translation", description: "Standalone translation records linking to a source asset. Replaced by the current approach where translations are assets with <code>content_type='translation'</code>. The <code>quest_closure</code> triggers still reference this table.", highlightNodes: ["e-tr"] },
    ],
  },
];
