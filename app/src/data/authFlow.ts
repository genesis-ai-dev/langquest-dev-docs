import type { Step } from "../components/StepWalkthrough";

export interface AuthNodeDef {
  id: string;
  type: "migration" | "container";
  label: string;
  subtitle?: string;
  badge?: string;
  category: string;
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

// Color helper for step descriptions — matches node category accent colors
const P = "color:var(--color-accent-purple)"; // auth
const C = "color:var(--color-accent-cyan)"; // client
const B = "color:var(--color-accent-blue)"; // bridge
const A = "color:var(--color-accent-amber)"; // service
const G = "color:var(--color-accent-green)"; // storage
const s = (style: string, text: string) =>
  `<span style="${style}">${text}</span>`;
const sc = (style: string, text: string) =>
  `<code style="${style}">${text}</code>`;

// ─── Nodes ───

export const NODES: AuthNodeDef[] = [
  // Containers (negative zIndex keeps them behind edges & nodes)
  { id: "appRoot", type: "container", label: "App · _layout.tsx", category: "client", x: 15, y: 29, w: 1056, h: 813, zIndex: -3 },
  { id: "authProviderBox", type: "container", label: "AuthProvider", category: "auth", x: 41, y: 74, w: 691, h: 347, zIndex: -2 },
  { id: "systemBox", type: "container", label: "System Singleton", category: "client", x: 41, y: 435, w: 1002, h: 380, zIndex: -2 },
  { id: "connectorBox", type: "container", label: "SupabaseConnector", category: "bridge", x: 284, y: 455, w: 743, h: 271, zIndex: -1 },

  // Auth Provider internals
  { id: "authMethods", type: "migration", label: "Auth Methods", subtitle: "signIn · signUp · signOut · resetPassword", category: "auth", x: 56, y: 100, w: 300, h: 58, zIndex: 10 },
  { id: "authState", type: "migration", label: "Auth State", subtitle: "session · isLoading · isSystemReady", category: "auth", x: 300, y: 338, w: 200, h: 58, zIndex: 10 },
  { id: "pathA", type: "migration", label: "Path A: Fast Offline", subtitle: "3s RPC timeout → AsyncStorage", category: "auth", x: 464, y: 98, w: 210, h: 58, zIndex: 10 },
  { id: "pathB", type: "migration", label: "Path B: onAuthStateChange", subtitle: "Supabase event listener", category: "auth", x: 457, y: 231, w: 240, h: 58, zIndex: 10 },
  { id: "initSystem", type: "migration", label: "initializeSystem()", subtitle: "system.init() → mark ready", category: "auth", x: 54, y: 230, w: 230, h: 58, zIndex: 10 },

  // System internals
  { id: "powersyncDb", type: "migration", label: "PowerSync DB", subtitle: "Local SQLite + Drizzle ORM", badge: "SQLITE", category: "client", x: 65, y: 530, w: 200, h: 58, zIndex: 10 },
  { id: "networkStore", type: "migration", label: "networkStore", subtitle: "NetInfo → online / offline", badge: "ZUSTAND", category: "client", x: 832, y: 738, w: 200, h: 58, zIndex: 10 },

  // Connector internals
  { id: "currentSession", type: "migration", label: "currentSession", subtitle: "In-memory session mirror", category: "bridge", x: 489, y: 522, w: 200, h: 58, zIndex: 10 },
  { id: "fetchCreds", type: "migration", label: "fetchCredentials()", subtitle: "→ { endpoint, token, expiresAt }", category: "bridge", x: 743, y: 643, w: 240, h: 58, zIndex: 10 },
  { id: "updateSession", type: "migration", label: "updateSession()", subtitle: "🛡 Never clears in production", category: "bridge", x: 479, y: 645, w: 240, h: 58, zIndex: 10 },
  { id: "uploadData", type: "migration", label: "uploadData()", subtitle: "Drain ps_crud → RPC transaction", category: "bridge", x: 751, y: 495, w: 240, h: 58, zIndex: 10 },

  // External services
  { id: "supabaseAuth", type: "migration", label: "Supabase Auth", subtitle: "JWT issuer + token refresh", badge: "EXTERNAL", category: "service", x: 1268, y: 231, w: 200, h: 60, zIndex: 10 },
  { id: "asyncStorage", type: "migration", label: "AsyncStorage", subtitle: "sb-*-auth-token (JSON)", badge: "PERSIST", category: "storage", x: 1268, y: 97, w: 200, h: 60, zIndex: 10 },
  { id: "psService", type: "migration", label: "PowerSync Service", subtitle: "WebSocket bidirectional sync", badge: "EXTERNAL", category: "client", x: 1153, y: 642, w: 200, h: 60, zIndex: 10 },
  { id: "deepLinks", type: "migration", label: "Deep Link Handler", subtitle: "Password reset / email confirm", category: "service", x: 806, y: 303, w: 230, h: 58, zIndex: 10 },
];

// ─── Edges ───

export const EDGES: AuthEdgeDef[] = [
  // Supabase Auth → Path B (onAuthStateChange events)
  { id: "e-auth-events", source: "supabaseAuth", sourceHandle: "bottom", target: "pathB", targetHandle: "bottom", label: "auth events", color: "amber" },
  // Supabase Auth ↔ AsyncStorage (auto-persist)
  { id: "e-auth-persist", source: "supabaseAuth", sourceHandle: "top", target: "asyncStorage", targetHandle: "bottom", label: "auto-persist", color: "green" },
  // AsyncStorage → Path A (offline fast path)
  { id: "e-storage-pathA", source: "asyncStorage", sourceHandle: "left", target: "pathA", targetHandle: "right", label: "read session", color: "green", dash: true },
  // Path A → initializeSystem
  { id: "e-pathA-init", source: "pathA", sourceHandle: "left", target: "initSystem", targetHandle: "top", color: "purple" },
  // Path B → initializeSystem
  { id: "e-pathB-init", source: "pathB", sourceHandle: "right", target: "initSystem", targetHandle: "right", color: "purple" },
  // Auth State → Path B (INITIAL_SESSION triggers listener)
  { id: "e-state-pathB", source: "authState", sourceHandle: "top", target: "pathB", targetHandle: "bottom", color: "purple", dash: true },
  // Auth State → updateSession
  { id: "e-state-update", source: "authState", sourceHandle: "bottom", target: "updateSession", targetHandle: "left", label: "session", color: "purple" },
  // updateSession → currentSession
  { id: "e-update-current", source: "updateSession", sourceHandle: "top", target: "currentSession", targetHandle: "bottom", label: "mirror", color: "blue" },
  // currentSession → fetchCredentials
  { id: "e-current-fetch", source: "currentSession", sourceHandle: "right", target: "fetchCreds", targetHandle: "left", label: "access_token", color: "amber" },
  // fetchCredentials → PowerSync Service
  { id: "e-fetch-ps", source: "fetchCreds", sourceHandle: "right", target: "psService", targetHandle: "left", label: "JWT", color: "cyan" },
  // uploadData → Supabase Auth (RPC)
  { id: "e-upload-rpc", source: "uploadData", sourceHandle: "right", target: "supabaseAuth", targetHandle: "bottom", label: "RPC", color: "amber" },
  // initSystem → PowerSync DB
  { id: "e-init-db", source: "initSystem", sourceHandle: "bottom", target: "powersyncDb", targetHandle: "top", label: "init()", color: "cyan" },
  // networkStore → PowerSync Service (connect/disconnect)
  { id: "e-net-ps", source: "networkStore", sourceHandle: "right", target: "psService", targetHandle: "bottom", label: "connect / disconnect", color: "cyan", dash: true },
  // Deep Links → Supabase Auth
  { id: "e-deep-auth", source: "deepLinks", sourceHandle: "right", target: "supabaseAuth", targetHandle: "bottom", label: "setSession()", color: "amber" },
  // Supabase Auth → currentSession (TOKEN_REFRESHED)
  { id: "e-refresh", source: "supabaseAuth", sourceHandle: "bottom", target: "currentSession", targetHandle: "top", label: "TOKEN_REFRESHED", color: "amber", dash: true },
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
// Phased walkthrough: Basic Auth → Offline-First → Hardening

export const STEPS: Step[] = [
  // ── Phase 1: Basic Auth ──
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: "The simplest auth model",
    description:
      `Without PowerSync, auth is straightforward. ${s(A, "Supabase Auth")} issues JWTs and manages sessions. Your React Native app uses the Supabase JS client, which auto-persists sessions to ${s(G, "AsyncStorage")}. On app restart, the client loads the saved session, refreshes the JWT if needed, and you're authenticated. That's all you'd need — no connectors, no mirrors, no race conditions.`,
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: "What's in a session?",
    description:
      `A Supabase <strong>Session</strong> contains four things: ${sc(A, "access_token")} (short-lived JWT, ~1 hr), ${sc(A, "refresh_token")} (long-lived, used to get new JWTs), ${sc(A, "expires_at")} (unix timestamp), and ${sc(A, "user")} info (id, email, metadata). The Supabase client auto-refreshes the access token before expiry using the refresh token, firing a <code>TOKEN_REFRESHED</code> event. In a future animated version, you'll see these four items traveling inside a "session" object along the diagram edges.`,
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: `${s(G, "AsyncStorage")} — persistence layer`,
    description:
      `The Supabase client is configured with <code>auth.storage: AsyncStorage</code>. This tells the JS SDK to persist the full session to ${s(G, "AsyncStorage")} under a key like <code>sb-&lt;project-ref&gt;-auth-token</code>. On app restart, the client reads this key to restore the session without re-authentication. This is the green dashed line from ${s(G, "AsyncStorage")} to ${s(P, "Path A")} — and ${s(A, "Supabase Auth")} auto-persists via the solid green line.`,
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: `${s(P, "AuthProvider")} — the orchestrator`,
    description:
      `${s(P, "AuthProvider")} wraps the entire app and manages React auth state: <code>session</code>, <code>isLoading</code>, <code>isSystemReady</code>, and <code>sessionType</code> (shown in ${s(P, "Auth State")}). It exposes ${s(P, "Auth Methods")} — <code>signIn</code>, <code>signUp</code>, <code>signOut</code>, and <code>resetPassword</code> — through React context, making them available to any child component.`,
  },
  {
    phase: "Basic Auth",
    phaseColor: "var(--color-accent-green)",
    title: "onAuthStateChange events",
    description:
      `${s(A, "Supabase Auth")} fires events through its <code>onAuthStateChange</code> listener (${s(P, "Path B")}). The key events are: <code>INITIAL_SESSION</code> (startup, after loading/refreshing), <code>SIGNED_IN</code>, <code>SIGNED_OUT</code>, <code>TOKEN_REFRESHED</code>, <code>PASSWORD_RECOVERY</code>, and <code>USER_UPDATED</code>. ${s(P, "AuthProvider")} handles each event type differently — this is the amber "auth events" line from ${s(A, "Supabase Auth")} to ${s(P, "Path B")}.`,
  },

  // ── Phase 2: Offline-First ──
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: "Why PowerSync changes everything",
    description:
      `Adding PowerSync for offline-first sync introduces real complexity. The PowerSync SDK <strong>requires</strong> you to implement a <code>PowerSyncBackendConnector</code> — a class providing ${sc(B, "fetchCredentials()")} (so PowerSync can authenticate its WebSocket to ${s(C, "PowerSync Service")}) and ${sc(B, "uploadData()")} (to push local changes). This required implementation is ${s(B, "SupabaseConnector")}.`,
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: `${s(B, "SupabaseConnector")} — the required bridge`,
    description:
      `${s(B, "SupabaseConnector")} creates the Supabase client, configured with your project URL and anon key (environment variables via <code>AppConfig</code> — not stored in ${s(G, "AsyncStorage")}, just build-time config) and <code>auth.storage: AsyncStorage</code> for session persistence. It implements the two methods PowerSync requires: ${sc(B, "fetchCredentials()")} and ${sc(B, "uploadData()")}.`,
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: `${s(B, "currentSession")} — the in-memory mirror`,
    description:
      `${s(B, "currentSession")} is a class property on ${s(B, "SupabaseConnector")} — a plain JavaScript variable in heap memory (not localStorage, not ${s(G, "AsyncStorage")}). It's a cached copy of the Supabase Session object. Why mirror? Because ${sc(B, "fetchCredentials()")} can be called at any time by the PowerSync SDK, even when offline. Calling <code>supabase.auth.getSession()</code> might attempt a network refresh and hang. The mirror provides instant, synchronous access. ${sc(B, "updateSession()")} keeps it current.`,
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: `${s(B, "fetchCredentials()")} — PowerSync's JWT needs`,
    description:
      `The PowerSync SDK calls ${sc(B, "fetchCredentials()")} on initial WebSocket connection to ${s(C, "PowerSync Service")}, on reconnect after disconnect, and when the token expires. It does <strong>not</strong> need a JWT for local SQLite reads/writes — that's fully offline, no auth required. The JWT only authenticates the sync channel (both download and upload). On timeout (5s), it falls back to cached ${s(B, "currentSession")}.`,
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: `${s(B, "uploadData()")} — draining the CRUD queue`,
    description:
      `Called by PowerSync when the <code>ps_crud</code> queue has pending local writes. ${sc(B, "uploadData()")} drains the transaction, mapping each operation to <code>apply_table_mutation_transaction</code> RPC calls with schema version metadata (<code>client_meta</code>). Handles 2xx (success), 4xx (client error → discard + alert user), 5xx (server error → retry later).`,
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: `${s(P, "initializeSystem()")}`,
    description:
      `When either auth path succeeds, ${sc(P, "initializeSystem()")} runs <code>system.init()</code>, completing four steps:<br>① Run pending SQLite migrations<br>② Initialize ${s(C, "PowerSync DB")} tables<br>③ Check schema version compatibility with the server<br>④ Start background sync via <code>connectAndInitializeInBackground()</code><br>The UI renders immediately with local data — sync happens in the background.`,
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: `${s(P, "Path A")} — the 3-second offline shortcut`,
    description:
      `Problem: when offline, Supabase's token refresh retries for ~25 seconds before giving up. ${s(P, "Path A")} fires a quick RPC probe (<code>get_schema_info</code>) with a 3-second timeout. If it fails (offline), it reads the session directly from ${s(G, "AsyncStorage")} — the green dashed line — bypassing Supabase's slow retry entirely. Gets the app ready in ~3s instead of ~25s.`,
  },
  {
    phase: "Offline-First",
    phaseColor: "var(--color-accent-cyan)",
    title: "The race guard",
    description:
      `${s(P, "Path A")} and ${s(P, "Path B")} run concurrently. A <code>hasInitializedRef</code> guard ensures only the winner calls ${sc(P, "initializeSystem()")}. When one path completes, it sets the ref to <code>true</code>. The other checks it — if already set, it no-ops entirely. <strong>Online:</strong> ${s(P, "Path B")} usually wins (Supabase responds quickly). <strong>Offline:</strong> ${s(P, "Path A")} wins (3s timeout beats ~25s). In the animated version, you'll be able to toggle online/offline and watch the race play out.`,
  },

  // ── Phase 3: Hardening ──
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: `${s(B, "updateSession()")} — production safety net`,
    description:
      `${s(A, "Supabase Auth")} can fire spurious <code>SIGNED_OUT</code> events when offline (token refresh fails). If we naively cleared the session, users would be logged out involuntarily. ${sc(B, "updateSession(null)")} is a <strong>no-op in production</strong> — it refuses to clear ${s(B, "currentSession")}. ${s(P, "AuthProvider")} also ignores <code>SIGNED_OUT</code> events in production. This dual guard keeps offline users logged in.`,
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: "Token refresh cycle",
    description:
      `Auto-refresh cycle: ${s(A, "Supabase Auth")} refreshes the JWT → <code>TOKEN_REFRESHED</code> event → ${s(P, "AuthProvider")} updates state → ${sc(B, "updateSession()")} → ${s(B, "currentSession")} mirror updated → ${sc(B, "fetchCredentials()")} picks up the fresh JWT on its next call. This keeps the ${s(C, "PowerSync Service")} sync connection authenticated without any user action.`,
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: "Network state management",
    description:
      `${s(C, "networkStore")} (Zustand + NetInfo) tracks online/offline. <strong>Offline:</strong> disconnects the ${s(C, "PowerSync Service")} WebSocket to avoid retry spam. <strong>Online:</strong> reconnects → triggers ${sc(B, "fetchCredentials()")} to authenticate. Think of it as a switch that interrupts the sync channel — in the animated version, this could be visualized as an SPST switch on the line between ${sc(B, "fetchCredentials()")} and ${s(C, "PowerSync Service")}.`,
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: `${s(A, "Deep Link Handler")}`,
    description:
      `Password reset and email confirmation deep links carry tokens in URL params. ${s(A, "Deep Link Handler")} calls <code>setSession()</code> on ${s(A, "Supabase Auth")} (the amber line going right), which then fires an <code>onAuthStateChange</code> event — the same amber "auth events" line back to ${s(P, "Path B")}. ${s(P, "AuthProvider")} handles it through the normal Path B flow, processing <code>PASSWORD_RECOVERY</code> or <code>SIGNED_IN</code>.`,
  },
  {
    phase: "Hardening",
    phaseColor: "var(--color-accent-amber)",
    title: "Anonymous mode",
    description:
      `No session (fresh install or explicit sign-out): <code>isAuthenticated = false</code>, <code>isSystemReady = true</code> (set immediately). ${s(C, "PowerSync DB")} is <strong>not</strong> initialized — there's nothing to sync. The app uses TanStack Query for cloud-only Supabase REST reads. Auth-gated features (like contributing) show an <code>AuthModal</code> prompting sign-in.`,
  },
];
