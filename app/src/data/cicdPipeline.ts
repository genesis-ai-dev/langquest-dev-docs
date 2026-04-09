// ── CI/CD Pipeline step & diagram data ──

export interface CicdStep {
  phase: string;
  phaseColor: string;
  title: string;
  description: string;
  hi: string[];
  vis: string[];
  dim: string[];
  conns: string[];
  particles: { seq: string[]; colorVar: string; alt?: string[] } | null;
}

export const STEPS: CicdStep[] = [
  // ── Setup 0-4 ──
  {
    phase: "Setup",
    phaseColor: "var(--color-accent-cyan)",
    title: "Create a feature branch off dev",
    description:
      'Branch off <code>dev</code> to start your feature. Dev is the integration branch — always ready to merge into main.',
    hi: ["b-feat"],
    vis: ["b-dev", "b-main"],
    dim: [],
    conns: [],
    particles: null,
  },
  {
    phase: "Setup",
    phaseColor: "var(--color-accent-cyan)",
    title: "Ensure Docker is running",
    description:
      "<strong>Docker Desktop</strong> (or OrbStack) must be running. In the local development environment, Supabase and PowerSync run as local Docker containers.",
    hi: [],
    vis: ["b-feat", "b-dev", "b-main"],
    dim: [],
    conns: [],
    particles: null,
  },
  {
    phase: "Setup",
    phaseColor: "var(--color-accent-cyan)",
    title: "Run npm run env",
    description:
      "This single command: generates <code>.env.local</code>, starts Supabase (Postgres, Auth, Storage), seeds the vault, serves edge functions, and starts PowerSync.",
    hi: ["n-sb-dev", "n-ps-dev", "n-env-dev"],
    vis: ["b-feat", "b-dev", "b-main"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["c-up-d", "c-across-d", "c-down-d"], colorVar: "--color-accent-cyan" },
  },
  {
    phase: "Setup",
    phaseColor: "var(--color-accent-cyan)",
    title: "Config files already in the repo",
    description:
      "Three files define the local environment:<br>• <code>supabase/config.toml</code> — DB, auth, API ports<br>• <code>supabase/config/powersync.yml</code> — sync, replication, JWT<br>• <code>supabase/config/sync-rules.yml</code> — per-user data routing",
    hi: ["n-sb-dev", "n-ps-dev"],
    vis: ["b-feat", "b-dev", "b-main", "n-env-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["c-up-d", "c-across-d", "c-down-d"], colorVar: "--color-accent-cyan" },
  },
  {
    phase: "Setup",
    phaseColor: "var(--color-accent-cyan)",
    title: "Run the app on a device",
    description:
      "<code>npm run android</code> or <code>npm run ios</code> (macOS only). Use emulators or physical devices. The app connects to local services via <code>.env.local</code>.",
    hi: ["n-env-dev"],
    vis: ["b-feat", "b-dev", "b-main", "n-sb-dev", "n-ps-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["c-up-d", "c-across-d", "c-down-d"], colorVar: "--color-accent-cyan" },
  },

  // ── Develop 5-7 ──
  {
    phase: "Develop",
    phaseColor: "var(--color-accent-purple)",
    title: "Build your feature",
    description:
      "Write code on your feature branch. Test against local Supabase + PowerSync. Your branch should ideally <strong>only use the local dev environment</strong>.",
    hi: ["b-feat"],
    vis: ["b-dev", "b-main", "n-sb-dev", "n-ps-dev", "n-env-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["c-up-d", "c-across-d", "c-down-d"], colorVar: "--color-accent-cyan" },
  },
  {
    phase: "Develop",
    phaseColor: "var(--color-accent-purple)",
    title: "Test offline & spotty connections",
    description:
      "<code>npm run start:offline:android</code> tests without network. PowerSync queues writes locally and syncs on reconnect.<br>Use network conditioning tools for spotty connection testing.",
    hi: ["b-feat", "n-env-dev"],
    vis: ["b-dev", "b-main", "n-sb-dev", "n-ps-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["c-up-d", "c-across-d", "c-down-d"], colorVar: "--color-accent-cyan" },
  },
  {
    phase: "Develop",
    phaseColor: "var(--color-accent-purple)",
    title: "Special case: connect to preview",
    description:
      'In rare cases, connect your branch to the <strong>preview environment</strong> with <code>EXPO_PUBLIC_APP_VARIANT=preview</code>. First, pull the correct env vars:<br><code>eas env:pull preview</code><br>This regenerates <code>.env.local</code> with the preview environment\'s values. Similarly, <code>eas env:pull production</code> targets production.<br><span style="color:var(--color-accent-red);font-weight:500">⚠ Never connect a feature branch to production.</span>',
    hi: ["n-sb-prev", "n-ps-prev", "n-env-prev"],
    vis: ["b-feat", "b-dev", "b-main", "n-sb-dev", "n-ps-dev", "n-env-dev"],
    dim: [],
    conns: ["c-up-p-feat", "c-across-p", "c-down-p-feat", "c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["c-up-p-feat", "c-across-p", "c-down-p-feat"], colorVar: "--color-accent-purple" },
  },

  // ── PR to Dev 8-13 ──
  {
    phase: "PR to Dev",
    phaseColor: "var(--color-accent-pink)",
    title: "Push and create a pull request",
    description:
      "Push your branch and create a PR targeting <code>dev</code>. This triggers automated CI checks via GitHub Actions.",
    hi: ["b-feat", "n-pr-dev"],
    vis: ["b-dev", "b-main", "n-sb-dev", "n-ps-dev", "n-env-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["r-merge-fd"], colorVar: "--color-accent-pink" },
  },
  {
    phase: "PR to Dev",
    phaseColor: "var(--color-accent-pink)",
    title: "CI checks run automatically",
    description:
      "Every PR runs: <strong>Format</strong> (Prettier), <strong>Typecheck</strong> (TSC), <strong>TruffleHog</strong> (secret scanning), <strong>Fingerprint</strong> (native build check).",
    hi: ["n-pr-dev"],
    vis: ["b-feat", "b-dev", "b-main", "n-sb-dev", "n-ps-dev", "n-env-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["r-merge-fd"], colorVar: "--color-accent-pink" },
  },
  {
    phase: "PR to Dev",
    phaseColor: "var(--color-accent-pink)",
    title: "Conditional checks",
    description:
      "Changed <code>supabase/migrations/</code>? <strong>Migration validator</strong> runs. Changed <code>sync-rules.yml</code>? <strong>Sync rules validation</strong> via PowerSync API.<br>If the <strong>Expo fingerprint changed</strong> (i.e. native dependencies were modified), a bot automatically requests review from another team member — that approval is required before the PR can merge.",
    hi: ["n-pr-dev"],
    vis: ["b-feat", "b-dev", "b-main", "n-sb-dev", "n-ps-dev", "n-env-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: { seq: ["r-merge-fd"], colorVar: "--color-accent-pink" },
  },
  {
    phase: "PR to Dev",
    phaseColor: "var(--color-accent-pink)",
    title: "Merge into dev",
    description:
      "All checks pass, PR approved — merge into dev. Your feature branch is done.",
    hi: ["b-dev", "n-merge-fd"],
    vis: ["b-main", "b-feat", "n-sb-dev", "n-ps-dev", "n-env-dev"],
    dim: [],
    conns: ["c-up-d", "c-across-d", "c-down-d"],
    particles: null,
  },
  {
    phase: "PR to Dev",
    phaseColor: "var(--color-accent-pink)",
    title: "Auto-deploy to preview",
    description:
      "On merge to dev: Supabase applies migrations to the <strong>preview branch DB</strong>. Sync rules auto-deploy to the preview PowerSync instance.",
    hi: ["n-sb-prev", "n-ps-prev", "b-dev"],
    vis: ["b-main", "n-env-prev"],
    dim: ["b-feat", "n-sb-dev", "n-ps-dev", "n-env-dev"],
    conns: ["c-up-p", "c-across-p", "c-down-p"],
    particles: { seq: ["c-up-p", "c-across-p", "c-down-p"], colorVar: "--color-accent-purple" },
  },
  {
    phase: "PR to Dev",
    phaseColor: "var(--color-accent-pink)",
    title: "Never modify remote instances directly",
    description:
      '<span style="color:var(--color-accent-red);font-weight:500">⚠ Important:</span> Never change remote Supabase or PowerSync via their dashboards. All changes flow through <strong>migration files</strong> and <strong>sync-rules.yml</strong> in git.',
    hi: ["n-sb-prev", "n-ps-prev", "n-sb-prod", "n-ps-prod", "n-noedit-sp", "n-noedit-pp", "n-noedit-sr", "n-noedit-pr"],
    vis: ["b-dev", "b-main", "n-env-prev", "n-env-prod"],
    dim: ["b-feat"],
    conns: ["c-up-p", "c-across-p", "c-down-p", "c-up-r", "c-across-r", "c-down-r"],
    particles: null,
  },

  // ── Ship 14-18 ──
  {
    phase: "Ship",
    phaseColor: "var(--color-accent-green)",
    title: "Test together in preview",
    description:
      "Dev branch connects to the preview environment — a remote Supabase DB branch and PowerSync instance with <strong>no seeded data</strong>. Test how features behave closer to production.",
    hi: ["b-dev", "n-sb-prev", "n-ps-prev"],
    vis: ["b-main", "n-env-prev"],
    dim: ["b-feat"],
    conns: ["c-up-p", "c-across-p", "c-down-p"],
    particles: { seq: ["c-up-p", "c-across-p", "c-down-p"], colorVar: "--color-accent-purple" },
  },
  {
    phase: "Ship",
    phaseColor: "var(--color-accent-green)",
    title: "Coordinate the merge to main",
    description:
      "When the team is ready, coordinate a merge from dev → main. <strong>Everyone should be aware.</strong> Version bump in <code>package.json</code> + <code>app.config.ts</code> if significant (requires native rebuild).",
    hi: ["b-dev", "b-main", "n-pr-main"],
    vis: ["n-sb-prev", "n-ps-prev", "n-env-prev"],
    dim: ["b-feat"],
    conns: ["c-up-p", "c-across-p", "c-down-p"],
    particles: { seq: ["r-merge-dm"], colorVar: "--color-accent-green" },
  },
  {
    phase: "Ship",
    phaseColor: "var(--color-accent-green)",
    title: "PR checks pass, merge to main",
    description:
      "Same CI checks run on the dev → main PR. On merge, Supabase applies migrations to <strong>production DB</strong>. Sync rules deploy to <strong>production PowerSync</strong>.",
    hi: ["b-main", "n-sb-prod", "n-ps-prod", "n-merge-dm"],
    vis: ["n-env-prod"],
    dim: ["b-feat", "b-dev", "n-sb-prev", "n-ps-prev"],
    conns: ["c-up-r", "c-across-r", "c-down-r"],
    particles: { seq: ["c-up-r", "c-across-r", "c-down-r"], colorVar: "--color-accent-green" },
  },
  {
    phase: "Ship",
    phaseColor: "var(--color-accent-green)",
    title: "Expo determines update type",
    description:
      "Expo checks the app fingerprint: <strong>OTA update</strong> (no version change, pushed directly) or <strong>native build</strong> (version bumped, new binary via EAS Build).",
    hi: ["n-expo"],
    vis: ["b-main", "n-sb-prod", "n-ps-prod", "n-env-prod"],
    dim: ["b-feat", "b-dev"],
    conns: ["c-main-expo", "c-up-r", "c-across-r", "c-down-r"],
    particles: { seq: ["c-main-expo"], colorVar: "--color-accent-green" },
  },
  {
    phase: "Ship",
    phaseColor: "var(--color-accent-green)",
    title: "Submit to app stores",
    description:
      "EAS Submit sends builds to <strong>Google Play Store</strong> and <strong>Apple App Store</strong>. Submit for review in each store's dashboard. Review takes hours to days.",
    hi: ["n-play", "n-app"],
    vis: ["b-main", "n-expo", "n-sb-prod", "n-ps-prod", "n-env-prod"],
    dim: ["b-feat", "b-dev"],
    conns: ["c-expo-play", "c-expo-app", "c-main-expo", "c-up-r", "c-across-r", "c-down-r"],
    particles: { seq: ["c-main-expo", "c-expo-play"], colorVar: "--color-accent-green", alt: ["c-main-expo", "c-expo-app"] },
  },
  {
    phase: "Ship",
    phaseColor: "var(--color-accent-green)",
    title: "Release and announce",
    description:
      "Once both stores approve, <strong>release simultaneously</strong>. Post an announcement on <strong>Discord</strong> — notify users of the new version and what's included. The cycle is complete.",
    hi: ["n-play", "n-app"],
    vis: ["b-main", "n-expo", "n-sb-prod", "n-ps-prod", "n-env-prod"],
    dim: ["b-feat", "b-dev"],
    conns: ["c-expo-play", "c-expo-app", "c-main-expo", "c-up-r", "c-across-r", "c-down-r"],
    particles: { seq: ["c-main-expo", "c-expo-play"], colorVar: "--color-accent-green", alt: ["c-main-expo", "c-expo-app"] },
  },
];

export const ALL_PATH_IDS = [
  "c-up-d", "c-across-d", "c-down-d",
  "c-up-p-feat", "c-up-p", "c-across-p", "c-down-p-feat", "c-down-p",
  "c-up-r", "c-across-r", "c-down-r",
  "r-merge-fd", "r-merge-dm",
  "c-main-expo", "c-expo-play", "c-expo-app",
] as const;
