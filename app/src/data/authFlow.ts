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

// ─── Nodes ───

export const NODES: AuthNodeDef[] = [
  // Containers (outermost → innermost, negative zIndex keeps them behind edges & nodes)
  { id: "appRoot", type: "container", label: "App · _layout.tsx", category: "client", x: 15, y: -3, w: 1081, h: 830, zIndex: -3 },
  { id: "authProviderBox", type: "container", label: "AuthProvider", category: "auth", x: 43, y: 75, w: 680, h: 350, zIndex: -2 },
  { id: "systemBox", type: "container", label: "System Singleton", category: "client", x: 41, y: 435, w: 1020, h: 380, zIndex: -2 },
  { id: "connectorBox", type: "container", label: "SupabaseConnector", category: "bridge", x: 294, y: 454, w: 759, h: 345, zIndex: -1 },

  // Auth Provider internals
  { id: "authState", type: "migration", label: "Auth State", subtitle: "session · isLoading · isSystemReady", category: "auth", x: 358, y: 338, w: 200, h: 58, zIndex: 10 },
  { id: "pathA", type: "migration", label: "Path A: Fast Offline", subtitle: "3s RPC timeout → AsyncStorage", category: "auth", x: 464, y: 98, w: 210, h: 58, zIndex: 10 },
  { id: "pathB", type: "migration", label: "Path B: onAuthStateChange", subtitle: "Supabase event listener", category: "auth", x: 457, y: 231, w: 240, h: 58, zIndex: 10 },
  { id: "initSystem", type: "migration", label: "initializeSystem()", subtitle: "system.init() → mark ready", category: "auth", x: 54, y: 236, w: 220, h: 48, zIndex: 10 },

  // System internals
  { id: "powersyncDb", type: "migration", label: "PowerSync DB", subtitle: "Local SQLite + Drizzle ORM", badge: "SQLITE", category: "client", x: 65, y: 530, w: 200, h: 58, zIndex: 10 },
  { id: "networkStore", type: "migration", label: "networkStore", subtitle: "NetInfo → online / offline", badge: "ZUSTAND", category: "client", x: 61, y: 667, w: 200, h: 58, zIndex: 10 },

  // Connector internals
  { id: "currentSession", type: "migration", label: "currentSession", subtitle: "In-memory session mirror", category: "bridge", x: 457, y: 503, w: 200, h: 58, zIndex: 10 },
  { id: "fetchCreds", type: "migration", label: "fetchCredentials()", subtitle: "→ { endpoint, token, expiresAt }", category: "bridge", x: 785, y: 592, w: 220, h: 58, zIndex: 10 },
  { id: "updateSession", type: "migration", label: "updateSession()", subtitle: "🛡 Never clears in production", category: "bridge", x: 447, y: 614, w: 220, h: 58, zIndex: 10 },
  { id: "uploadData", type: "migration", label: "uploadData()", subtitle: "Drain ps_crud → RPC transaction", category: "bridge", x: 632, y: 719, w: 220, h: 58, zIndex: 10 },

  // External services
  { id: "supabaseAuth", type: "migration", label: "Supabase Auth", subtitle: "JWT issuer + token refresh", badge: "EXTERNAL", category: "service", x: 1268, y: 231, w: 200, h: 60, zIndex: 10 },
  { id: "asyncStorage", type: "migration", label: "AsyncStorage", subtitle: "sb-*-auth-token (JSON)", badge: "PERSIST", category: "storage", x: 1268, y: 97, w: 200, h: 60, zIndex: 10 },
  { id: "psService", type: "migration", label: "PowerSync Service", subtitle: "WebSocket bidirectional sync", badge: "EXTERNAL", category: "client", x: 1151, y: 591, w: 200, h: 60, zIndex: 10 },
  { id: "deepLinks", type: "migration", label: "Deep Link Handler", subtitle: "Password reset / email confirm", category: "service", x: 809, y: 340, w: 200, h: 58, zIndex: 10 },
];

// ─── Edges ───

export const EDGES: AuthEdgeDef[] = [
  // Supabase Auth → AuthProvider (events)
  { id: "e-auth-events", source: "supabaseAuth", sourceHandle: "left", target: "pathB", targetHandle: "right", label: "events", color: "amber" },
  // Supabase Auth ↔ AsyncStorage (auto-persist)
  { id: "e-auth-persist", source: "supabaseAuth", sourceHandle: "top", target: "asyncStorage", targetHandle: "bottom", label: "auto-persist", color: "green" },
  // AsyncStorage → Path A (offline fast path)
  { id: "e-storage-pathA", source: "asyncStorage", sourceHandle: "left", target: "pathA", targetHandle: "right", label: "read session", color: "green", dash: true },
  // Path A → initializeSystem
  { id: "e-pathA-init", source: "pathA", sourceHandle: "bottom", target: "initSystem", targetHandle: "top", color: "purple" },
  // Path B → initializeSystem
  { id: "e-pathB-init", source: "pathB", sourceHandle: "left", target: "initSystem", targetHandle: "right", color: "purple" },
  // Auth State → Path B (INITIAL_SESSION triggers listener)
  { id: "e-state-pathB", source: "authState", sourceHandle: "right", target: "pathB", targetHandle: "bottom", color: "purple", dash: true },
  // Auth State → updateSession
  { id: "e-state-update", source: "authState", sourceHandle: "left", target: "updateSession", targetHandle: "left", label: "session", color: "purple" },
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
  { id: "e-refresh", source: "supabaseAuth", sourceHandle: "bottom", target: "currentSession", targetHandle: "right", label: "TOKEN_REFRESHED", color: "amber", dash: true },
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

// ─── Steps (walkthrough text, diagram stays static) ───

export const STEPS: Step[] = [
  {
    title: "Architecture overview",
    description:
      "The auth system is a 3-layer stack: <strong>Supabase Auth</strong> handles identity and JWTs, <strong>PowerSync</strong> handles offline sync using those JWTs, and <strong>AuthProvider</strong> orchestrates the two. The <code>System</code> singleton owns both the <code>SupabaseConnector</code> and the <code>PowerSync DB</code>.",
  },
  {
    title: "Supabase client",
    description:
      "The Supabase client is created in <code>SupabaseConnector</code> with <code>auth.storage: AsyncStorage</code>. This tells Supabase to persist sessions to React Native's AsyncStorage under a key matching <code>sb-*-auth-token</code>. The anon key and URL come from env vars via <code>AppConfig</code>.",
  },
  {
    title: "Session vs token",
    description:
      "A <strong>Session</strong> is a Supabase object containing <code>access_token</code> (a short-lived JWT, ~1 hour), <code>refresh_token</code> (long-lived, used to get new JWTs), <code>expires_at</code>, and <code>user</code> info. The Supabase client auto-refreshes the JWT before expiry using the refresh token, firing <code>TOKEN_REFRESHED</code>.",
  },
  {
    title: "AuthProvider — the orchestrator",
    description:
      "Manages React state: <code>session</code>, <code>isLoading</code>, <code>isSystemReady</code>, <code>sessionType</code>. On mount, it races two initialization paths. Whichever finishes first wins via a <code>hasInitializedRef</code> guard. It also provides <code>signIn</code>, <code>signUp</code>, <code>signOut</code>, and <code>resetPassword</code> methods.",
  },
  {
    title: "Path A — fast offline boot",
    description:
      "Fires an RPC call to <code>get_schema_info</code> with a 3-second timeout. If the server is unreachable (offline), it reads the session directly from AsyncStorage, bypassing Supabase's slow token refresh retries (~25s). Sets <code>hasInitializedRef = true</code> to block Path B, then calls <code>initializeSystem()</code>. Gets the app ready in ~3s instead of ~25s when offline.",
  },
  {
    title: "Path B — normal Supabase flow",
    description:
      "Subscribes to <code>onAuthStateChange</code>. When online, Supabase loads the session from AsyncStorage, refreshes the JWT if needed, and fires <code>INITIAL_SESSION</code>. If Path A already won the race, this event is ignored entirely. Otherwise, it sets the session state and calls <code>initializeSystem()</code>.",
  },
  {
    title: "initializeSystem()",
    description:
      "Calls <code>system.init()</code> which runs pending SQLite migrations, initializes the PowerSync DB, checks schema version compatibility with the server, and marks the system as ready. Sync starts in the <strong>background</strong> via <code>connectAndInitializeInBackground()</code> so the UI renders immediately with local data.",
  },
  {
    title: "SupabaseConnector — the bridge",
    description:
      "Implements PowerSync's <code>PowerSyncBackendConnector</code> interface. It owns the Supabase client, maintains <code>currentSession</code> as an in-memory mirror, and provides <code>fetchCredentials()</code> and <code>uploadData()</code> that PowerSync calls automatically.",
  },
  {
    title: "fetchCredentials()",
    description:
      "Called by the PowerSync SDK whenever it needs a JWT — on initial connect and when the token expires. It returns <code>{ endpoint, token: access_token, expiresAt, userID }</code>. If the live session fetch times out (5s), it falls back to the cached <code>currentSession</code>.",
  },
  {
    title: "uploadData()",
    description:
      "Called by PowerSync when the <code>ps_crud</code> queue has pending writes. Drains the CRUD transaction, maps operations to <code>apply_table_mutation_transaction</code> RPC calls with schema version metadata (<code>client_meta</code>). Handles 2xx (success), 4xx (client error → discard + alert), and 5xx (server error → retry).",
  },
  {
    title: "updateSession() — production safety net",
    description:
      "When Supabase fires a spurious <code>SIGNED_OUT</code> while offline, it tries to clear the session. <code>updateSession(null)</code> is a <strong>no-op in production</strong> — it refuses to clear <code>currentSession</code>. Similarly, AuthProvider ignores <code>SIGNED_OUT</code> events in production. This ensures users never get involuntarily logged out.",
  },
  {
    title: "Token refresh cycle",
    description:
      "The Supabase client auto-refreshes the access token before it expires using the stored refresh token. On success, it fires <code>TOKEN_REFRESHED</code> → AuthProvider updates React state and calls <code>updateSession()</code> → <code>currentSession</code> gets the fresh JWT. PowerSync's next <code>fetchCredentials()</code> call picks up the new token.",
  },
  {
    title: "Network state & PowerSync sync",
    description:
      "<code>networkStore</code> wraps NetInfo. When the device goes <strong>offline</strong>, <code>system.applyPowerSyncNetworkState</code> disconnects the PowerSync WebSocket (avoids retry spam). When it comes back <strong>online</strong>, it reconnects — triggering <code>fetchCredentials()</code> to authenticate the new WebSocket connection.",
  },
  {
    title: "Deep link handler",
    description:
      "Password reset and email confirmation links arrive as deep links with <code>access_token</code> and <code>refresh_token</code> in URL params. The handler calls <code>setSession()</code> on the Supabase client, which fires <code>onAuthStateChange</code> → AuthProvider handles the <code>PASSWORD_RECOVERY</code> or <code>SIGNED_IN</code> event.",
  },
  {
    title: "AsyncStorage — session persistence",
    description:
      "The Supabase client auto-persists the full session (access token, refresh token, user, expiry) to AsyncStorage under <code>sb-&lt;project-ref&gt;-auth-token</code>. Both Path A and the <code>INITIAL_SESSION</code> fallback read this key directly when the normal Supabase session load returns null (e.g., expired token while offline).",
  },
  {
    title: "Anonymous mode",
    description:
      "When no session exists (fresh install), <code>isAuthenticated = false</code> and <code>isSystemReady = true</code> (set immediately). PowerSync is <strong>not initialized</strong>. The app uses TanStack Query (cloud-only Supabase REST) for browsing. Auth-gated features show an <code>AuthModal</code>.",
  },
];
