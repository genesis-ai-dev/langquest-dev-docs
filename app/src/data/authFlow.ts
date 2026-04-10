import type { Step } from "../components/StepWalkthrough";

export interface AuthNodeDef {
  id: string;
  type: "migration" | "container" | "detail";
  label: string;
  subtitle?: string;
  badge?: string;
  category: string;
  items?: Array<{ name: string; desc: string }>;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
}

export interface AuthEdgeDef {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  label?: string;
  color: string;
  dash?: boolean;
}

// Color helpers — match node category accent colors
const SB = "color:var(--color-accent-green)"; // supabase
const PS = "color:var(--color-accent-purple)"; // powersync
const AF = "color:var(--color-accent-cyan)"; // authflow
const BR = "color:var(--color-accent-blue)"; // bridge
const SV = "color:var(--color-accent-amber)"; // service
const ST = "color:var(--color-accent-pink)"; // storage
const s = (style: string, text: string) =>
  `<span style="${style}">${text}</span>`;
const sc = (style: string, text: string) =>
  `<code style="${style}">${text}</code>`;

// ─── Nodes ───

export const NODES: AuthNodeDef[] = [
  // Containers
  { id: "appRoot", type: "container", label: "App · _layout.tsx", category: "authflow", x: 15, y: -20, w: 1056, h: 862, zIndex: -3 },
  { id: "authProviderBox", type: "container", label: "AuthProvider", category: "authflow", x: 40, y: 14, w: 691, h: 377, zIndex: -2 },
  { id: "systemBox", type: "container", label: "System Singleton", category: "authflow", x: 41, y: 450, w: 1002, h: 365, zIndex: -2 },
  { id: "connectorBox", type: "container", label: "SupabaseConnector", category: "bridge", x: 284, y: 481, w: 743, h: 245, zIndex: -1 },

  // Auth Provider internals
  { id: "authMethods", type: "migration", label: "Auth Methods", subtitle: "signIn · signUp · signOut · resetPassword", category: "authflow", x: 374, y: 150, w: 300, h: 58, zIndex: 10 },
  { id: "authState", type: "migration", label: "Auth State", subtitle: "session · isLoading · isSystemReady", category: "authflow", x: 275, y: 313, w: 200, h: 58, zIndex: 10 },
  { id: "pathA", type: "migration", label: "Path A: Fast Offline", subtitle: "3s RPC timeout → AsyncStorage", category: "authflow", x: 462, y: 53, w: 210, h: 58, zIndex: 10 },
  { id: "pathB", type: "migration", label: "Path B: onAuthStateChange", subtitle: "Default init · Supabase event listener", category: "authflow", x: 432, y: 240, w: 240, h: 58, zIndex: 10 },
  { id: "initSystem", type: "migration", label: "initializeSystem()", subtitle: "system.init() → mark ready", category: "authflow", x: 50, y: 240, w: 230, h: 58, zIndex: 10 },

  // System internals
  { id: "powersyncDb", type: "migration", label: "PowerSync DB", subtitle: "Local SQLite + Drizzle ORM", badge: "SQLITE", category: "powersync", x: 65, y: 530, w: 200, h: 58, zIndex: 10 },
  { id: "networkStore", type: "migration", label: "networkStore", subtitle: "NetInfo → online / offline", badge: "ZUSTAND", category: "authflow", x: 829, y: 737, w: 200, h: 58, zIndex: 10 },

  // Connector internals
  { id: "currentSession", type: "migration", label: "currentSession", subtitle: "In-memory session mirror", category: "bridge", x: 464, y: 531, w: 200, h: 58, zIndex: 10 },
  { id: "fetchCreds", type: "migration", label: "fetchCredentials()", subtitle: "→ { endpoint, token, expiresAt }", category: "bridge", x: 743, y: 643, w: 240, h: 58, zIndex: 10 },
  { id: "updateSession", type: "migration", label: "updateSession()", subtitle: "🛡 Never clears in production", category: "bridge", x: 447, y: 645, w: 240, h: 58, zIndex: 10 },
  { id: "uploadData", type: "migration", label: "uploadData()", subtitle: "Drain ps_crud → RPC transaction", category: "bridge", x: 751, y: 531, w: 240, h: 58, zIndex: 10 },

  // External services
  { id: "supabaseAuth", type: "migration", label: "Supabase Auth", subtitle: "JWT issuer + token refresh", badge: "EXTERNAL", category: "supabase", x: 1268, y: 195, w: 200, h: 60, zIndex: 10 },
  { id: "asyncStorage", type: "migration", label: "AsyncStorage", subtitle: "sb-*-auth-token (JSON)", badge: "PERSIST", category: "storage", x: 1265, y: 52, w: 200, h: 60, zIndex: 10 },
  { id: "psService", type: "migration", label: "PowerSync Service", subtitle: "WebSocket bidirectional sync", badge: "EXTERNAL", category: "powersync", x: 1153, y: 642, w: 200, h: 60, zIndex: 10 },
  { id: "deepLinks", type: "migration", label: "Deep Link Handler", subtitle: "Password reset / email confirm", category: "service", x: 806, y: 303, w: 230, h: 58, zIndex: 10 },

  // Detail callout nodes (appear at specific steps)
  {
    id: "sessionDetail", type: "detail", label: "Session contents",
    category: "supabase", x: 1510, y: 60, w: 230, h: 145, zIndex: 15,
    items: [
      { name: "access_token", desc: "Short-lived JWT (~1 hr)" },
      { name: "refresh_token", desc: "Long-lived, renews JWTs" },
      { name: "expires_at", desc: "Token expiry (unix ts)" },
      { name: "user", desc: "{ id, email, app_metadata }" },
    ],
  },
  {
    id: "authStateDetail", type: "detail", label: "Auth State values",
    category: "authflow", x: 1510, y: 230, w: 250, h: 145, zIndex: 15,
    items: [
      { name: "session", desc: "Session | null" },
      { name: "isLoading", desc: "true during init" },
      { name: "isSystemReady", desc: "true after system.init()" },
      { name: "sessionType", desc: '"online" | "offline" | null' },
    ],
  },
];

// ─── Edges ───

export const EDGES: AuthEdgeDef[] = [
  { id: "e-auth-events", source: "supabaseAuth", sourceHandle: "left", target: "pathB", targetHandle: "right", label: "auth events", color: "green" },
  { id: "e-auth-persist", source: "supabaseAuth", sourceHandle: "top", target: "asyncStorage", targetHandle: "bottom", label: "auto-persist", color: "green" },
  { id: "e-storage-pathA", source: "asyncStorage", sourceHandle: "left", target: "pathA", targetHandle: "right", label: "read session", color: "pink", dash: true },
  { id: "e-pathA-init", source: "pathA", sourceHandle: "left", target: "initSystem", targetHandle: "top", color: "cyan" },
  { id: "e-pathB-init", source: "pathB", sourceHandle: "left", target: "initSystem", targetHandle: "right", color: "cyan" },
  { id: "e-state-pathB", source: "authState", sourceHandle: "top", target: "pathB", targetHandle: "left", color: "cyan", dash: true },
  { id: "e-state-update", source: "authState", sourceHandle: "bottom", target: "updateSession", targetHandle: "left", label: "session", color: "cyan" },
  { id: "e-update-current", source: "updateSession", sourceHandle: "top", target: "currentSession", targetHandle: "bottom", label: "mirror", color: "blue" },
  { id: "e-current-fetch", source: "currentSession", sourceHandle: "right", target: "fetchCreds", targetHandle: "left", label: "access_token", color: "green" },
  { id: "e-fetch-ps", source: "fetchCreds", sourceHandle: "right", target: "psService", targetHandle: "left", label: "JWT", color: "purple" },
  { id: "e-upload-rpc", source: "uploadData", sourceHandle: "right", target: "supabaseAuth", targetHandle: "bottom", label: "RPC", color: "green" },
  { id: "e-init-db", source: "initSystem", sourceHandle: "bottom", target: "powersyncDb", targetHandle: "top", label: "init()", color: "purple" },
  { id: "e-net-ps", source: "networkStore", sourceHandle: "right", target: "psService", targetHandle: "bottom", label: "connect / disconnect", color: "purple", dash: true },
  { id: "e-deep-auth", source: "deepLinks", sourceHandle: "right", target: "supabaseAuth", targetHandle: "bottom", label: "setSession()", color: "green" },
  { id: "e-refresh", source: "supabaseAuth", sourceHandle: "bottom", target: "currentSession", targetHandle: "top", label: "TOKEN_REFRESHED", color: "green", dash: true },
  // Auth methods → Supabase Auth (API calls)
  { id: "e-methods-auth", source: "authMethods", sourceHandle: "right", target: "supabaseAuth", targetHandle: "left", label: "auth API", color: "green", dash: true },
  // Detail callout edges
  { id: "e-session-detail", source: "supabaseAuth", sourceHandle: "right", target: "sessionDetail", targetHandle: "left", color: "green", dash: true },
  { id: "e-state-detail", source: "authState", sourceHandle: "right", target: "authStateDetail", targetHandle: "left", color: "cyan", dash: true },
];

export const EDGE_COLORS: Record<string, string> = {
  purple: "var(--color-accent-purple)",
  cyan: "var(--color-accent-cyan)",
  amber: "var(--color-accent-amber)",
  green: "var(--color-accent-green)",
  blue: "var(--color-accent-blue)",
  pink: "var(--color-accent-pink)",
  default: "var(--color-border)",
};

// ─── Steps ───
// Progressive reveal: Basic Auth → Offline-First → Hardening

export const STEPS: Step[] = [
  // ── Phase 1: Basic Auth ──
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: "The simplest auth model",
    description:
      `Without PowerSync, auth is straightforward. ${s(SB, "Supabase Auth")} issues JWTs and manages sessions. Your React Native app uses the Supabase JS client, which auto-persists sessions to ${s(ST, "AsyncStorage")}. On app restart, the client loads the saved session, refreshes the JWT if needed, and you're in. No connectors, no mirrors, no race conditions.`,
    revealNodes: ["appRoot", "supabaseAuth", "asyncStorage"],
    highlightNodes: ["supabaseAuth", "asyncStorage"],
    activeEdges: ["e-auth-persist"],
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: "What's in a session?",
    description:
      `A Supabase <strong>Session</strong> contains four things — shown in the ${s(SB, "Session contents")} callout. ${sc(SB, "access_token")} is the short-lived JWT (~1 hr) used for API auth. ${sc(SB, "refresh_token")} is long-lived and used to obtain new access tokens. ${sc(SB, "expires_at")} is the unix timestamp of when the access token expires. ${sc(SB, "user")} contains identity metadata. The Supabase client auto-refreshes the access token before expiry using the refresh token.`,
    highlightNodes: ["supabaseAuth", "sessionDetail"],
    activeEdges: ["e-auth-persist", "e-session-detail"],
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: `${s(ST, "AsyncStorage")} — persistence layer`,
    description:
      `The Supabase client is configured with <code>auth.storage: AsyncStorage</code>. This tells the JS SDK to persist the full session under <code>sb-&lt;project-ref&gt;-auth-token</code>. On app restart, the client reads this key to restore the session without re-authentication. The green line between ${s(SB, "Supabase Auth")} and ${s(ST, "AsyncStorage")} represents this auto-persistence.`,
    highlightNodes: ["asyncStorage"],
    activeEdges: ["e-auth-persist"],
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: `${s(AF, "AuthProvider")} — the orchestrator`,
    description:
      `${s(AF, "AuthProvider")} wraps the entire app and manages React auth state — see the ${s(AF, "Auth State values")} callout for the full list. It exposes ${s(AF, "Auth Methods")} — <code>signIn</code>, <code>signUp</code>, <code>signOut</code>, and <code>resetPassword</code> — through React context. These methods call the ${s(SB, "Supabase Auth")} API via the Supabase JS client (the dashed green "auth API" line).`,
    revealNodes: ["authProviderBox", "authState", "authMethods"],
    highlightNodes: ["authProviderBox", "authState", "authMethods", "authStateDetail"],
    activeEdges: ["e-methods-auth", "e-state-detail"],
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: "onAuthStateChange events",
    description:
      `${s(SB, "Supabase Auth")} fires events through <code>onAuthStateChange</code> — that's ${s(AF, "Path B")}, the default initialization path. It's called Path B because it's the normal Supabase flow: the Supabase client loads the session from ${s(ST, "AsyncStorage")}, refreshes the JWT if needed, then fires <code>INITIAL_SESSION</code>. Other events: <code>SIGNED_IN</code>, <code>SIGNED_OUT</code>, <code>TOKEN_REFRESHED</code>, <code>PASSWORD_RECOVERY</code>, <code>USER_UPDATED</code>.`,
    revealNodes: ["pathB"],
    highlightNodes: ["supabaseAuth", "pathB"],
    activeEdges: ["e-auth-events", "e-state-pathB"],
  },

  // ── Phase 2: Offline-First ──
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: "Why PowerSync changes everything",
    description:
      `Adding PowerSync for offline-first sync requires a <code>PowerSyncBackendConnector</code> — a class you implement providing ${sc(BR, "fetchCredentials()")} (to authenticate the WebSocket to ${s(PS, "PowerSync Service")}) and ${sc(BR, "uploadData()")} (to push local changes). This required implementation is ${s(BR, "SupabaseConnector")}. The entire bottom half of the diagram exists because of this requirement.`,
    revealNodes: ["systemBox", "connectorBox", "psService", "powersyncDb"],
    highlightNodes: ["connectorBox", "psService"],
    activeEdges: [],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: `${s(BR, "SupabaseConnector")} — the required bridge`,
    description:
      `${s(BR, "SupabaseConnector")} creates the Supabase client, configured with your project URL and anon key (environment variables via <code>AppConfig</code> — just build-time config, not stored anywhere) and <code>auth.storage: AsyncStorage</code> for session persistence. It implements the two methods PowerSync requires: ${sc(BR, "fetchCredentials()")} and ${sc(BR, "uploadData()")}.`,
    revealNodes: ["currentSession", "fetchCreds", "updateSession", "uploadData"],
    highlightNodes: ["connectorBox"],
    activeEdges: [],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: `${s(BR, "currentSession")} — the in-memory mirror`,
    description:
      `${s(BR, "currentSession")} is a class property on ${s(BR, "SupabaseConnector")} — a plain JavaScript variable in heap memory (not localStorage, not ${s(ST, "AsyncStorage")}). It's a cached copy of the Supabase Session. Why? Because ${sc(BR, "fetchCredentials()")} can be called at any time by the PowerSync SDK, even offline. Calling <code>supabase.auth.getSession()</code> might attempt a network refresh and hang. The mirror provides instant, synchronous access.`,
    highlightNodes: ["currentSession", "updateSession"],
    activeEdges: ["e-update-current"],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: `${s(BR, "fetchCredentials()")} — PowerSync's JWT needs`,
    description:
      `The PowerSync SDK calls ${sc(BR, "fetchCredentials()")} on initial WebSocket connection to ${s(PS, "PowerSync Service")}, on reconnect, and on token expiry. It does <strong>not</strong> need a JWT for local SQLite reads/writes — that's fully offline, no auth required. The JWT only authenticates the sync channel. On timeout (5s), it falls back to cached ${s(BR, "currentSession")}.`,
    highlightNodes: ["fetchCreds", "psService"],
    activeEdges: ["e-current-fetch", "e-fetch-ps"],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: "JWT vs JWKS",
    description:
      `A <strong>JWT</strong> (JSON Web Token) is the <code>access_token</code> itself — a base64-encoded, digitally signed token containing claims (user ID, email, expiry, role). ${s(SB, "Supabase Auth")} issues these. A <strong>JWKS</strong> (JSON Web Key Set) is a set of public keys at <code>https://&lt;project&gt;.supabase.co/.well-known/jwks.json</code>. ${s(PS, "PowerSync Service")} fetches JWKS once during setup to verify JWT signatures <em>without</em> contacting ${s(SB, "Supabase Auth")} at request time — standard asymmetric crypto.`,
    highlightNodes: ["supabaseAuth", "psService", "fetchCreds"],
    activeEdges: ["e-fetch-ps"],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: `${s(BR, "uploadData()")} — draining the CRUD queue`,
    description:
      `Called by PowerSync when the <code>ps_crud</code> queue has pending local writes. ${sc(BR, "uploadData()")} drains the transaction, mapping each operation to <code>apply_table_mutation_transaction</code> RPC calls with schema version metadata (<code>client_meta</code>). Handles 2xx (success), 4xx (client error → discard + alert), 5xx (server error → retry).`,
    highlightNodes: ["uploadData", "supabaseAuth"],
    activeEdges: ["e-upload-rpc"],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: `${s(AF, "Path A")} — the 3-second offline shortcut`,
    description:
      `Problem: when offline, Supabase's token refresh retries for ~25 seconds before giving up. ${s(AF, "Path A")} fires a quick RPC probe (<code>get_schema_info</code>) with a 3-second timeout. If it fails (offline), it reads the session directly from ${s(ST, "AsyncStorage")} — the pink dashed line — bypassing Supabase's slow retry entirely. Gets the app ready in ~3s instead of ~25s.`,
    revealNodes: ["pathA"],
    highlightNodes: ["pathA", "asyncStorage"],
    activeEdges: ["e-storage-pathA", "e-pathA-init"],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: `${s(AF, "initializeSystem()")}`,
    description:
      `When ${s(AF, "Path A")} or ${s(AF, "Path B")} succeeds, ${sc(AF, "initializeSystem()")} runs <code>system.init()</code>:<br>① Run pending SQLite migrations<br>② Initialize ${s(PS, "PowerSync DB")} tables<br>③ Check schema version compatibility with the server<br>④ Start background sync via <code>connectAndInitializeInBackground()</code><br>The UI renders immediately with local data — sync happens in the background.`,
    revealNodes: ["initSystem"],
    highlightNodes: ["initSystem", "powersyncDb"],
    activeEdges: ["e-init-db", "e-pathA-init", "e-pathB-init"],
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-purple)",
    title: "The race guard",
    description:
      `${s(AF, "Path A")} and ${s(AF, "Path B")} run concurrently. A <code>hasInitializedRef</code> guard ensures only the winner calls ${sc(AF, "initializeSystem()")}. When one path completes, it sets the ref to <code>true</code>. The other checks it — if already set, it no-ops. <strong>Online:</strong> ${s(AF, "Path B")} usually wins. <strong>Offline:</strong> ${s(AF, "Path A")} wins (3s timeout beats ~25s).`,
    highlightNodes: ["pathA", "pathB", "initSystem"],
    activeEdges: ["e-pathA-init", "e-pathB-init"],
  },

  // ── Phase 3: Hardening ──
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: `${s(BR, "updateSession()")} — production safety net`,
    description:
      `${s(SB, "Supabase Auth")} can fire spurious <code>SIGNED_OUT</code> events when offline (token refresh fails). If we naively cleared the session, users would be logged out. ${sc(BR, "updateSession(null)")} is a <strong>no-op in production</strong> — it refuses to clear ${s(BR, "currentSession")}. ${s(AF, "AuthProvider")} also ignores <code>SIGNED_OUT</code> in production. This dual guard keeps offline users logged in.`,
    highlightNodes: ["updateSession", "currentSession", "authState"],
    activeEdges: ["e-state-update", "e-update-current"],
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: "Token refresh cycle",
    description:
      `Auto-refresh: ${s(SB, "Supabase Auth")} refreshes the JWT → <code>TOKEN_REFRESHED</code> event → ${s(AF, "AuthProvider")} updates state → ${sc(BR, "updateSession()")} → ${s(BR, "currentSession")} mirror updated → ${sc(BR, "fetchCredentials()")} picks up the fresh JWT. Keeps the ${s(PS, "PowerSync Service")} sync connection authenticated automatically.`,
    highlightNodes: ["supabaseAuth", "currentSession"],
    activeEdges: ["e-refresh", "e-auth-events", "e-state-update", "e-update-current", "e-current-fetch"],
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: "Network state management",
    description:
      `${s(AF, "networkStore")} (Zustand + NetInfo) tracks online/offline. <strong>Offline:</strong> disconnects the ${s(PS, "PowerSync Service")} WebSocket to avoid retry spam. <strong>Online:</strong> reconnects → triggers ${sc(BR, "fetchCredentials()")} to authenticate. Think of it as a switch interrupting the sync channel.`,
    revealNodes: ["networkStore"],
    highlightNodes: ["networkStore", "psService"],
    activeEdges: ["e-net-ps"],
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: `${s(SV, "Deep Link Handler")}`,
    description:
      `Password reset and email confirmation deep links carry tokens in URL params. ${s(SV, "Deep Link Handler")} calls <code>setSession()</code> on ${s(SB, "Supabase Auth")} (the green line going right), which fires an <code>onAuthStateChange</code> event — the same "auth events" line back to ${s(AF, "Path B")}. ${s(AF, "AuthProvider")} handles it through the normal Path B flow, processing <code>PASSWORD_RECOVERY</code> or <code>SIGNED_IN</code>.`,
    revealNodes: ["deepLinks"],
    highlightNodes: ["deepLinks", "supabaseAuth", "pathB"],
    activeEdges: ["e-deep-auth", "e-auth-events"],
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: "Anonymous mode",
    description:
      `No session (fresh install or explicit sign-out): <code>isAuthenticated = false</code>, <code>isSystemReady = true</code> (set immediately). ${s(PS, "PowerSync DB")} is <strong>not</strong> initialized — nothing to sync. The app uses TanStack Query for cloud-only Supabase REST reads. Auth-gated features show an <code>AuthModal</code> prompting sign-in.`,
    highlightNodes: ["appRoot"],
    activeEdges: [],
  },
];
