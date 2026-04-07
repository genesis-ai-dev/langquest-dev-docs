-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.asset (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  name text,
  source_language_id uuid,
  images ARRAY,
  active boolean NOT NULL DEFAULT true,
  creator_id uuid,
  visible boolean DEFAULT true,
  download_profiles ARRAY,
  ingest_batch_id uuid,
  project_id uuid,
  parent_id uuid,
  source_asset_id uuid,
  order_index integer DEFAULT 0,
  content_type text DEFAULT 'source'::text CHECK (content_type = ANY (ARRAY['source'::text, 'translation'::text, 'transcription'::text])),
  metadata text,
  CONSTRAINT asset_pkey PRIMARY KEY (id),
  CONSTRAINT asset_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT asset_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.asset(id),
  CONSTRAINT asset_source_asset_id_fkey FOREIGN KEY (source_asset_id) REFERENCES public.asset(id),
  CONSTRAINT asset_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id)
);
CREATE TABLE public.asset_content_link (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  asset_id uuid NOT NULL,
  text text,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  source_language_id uuid,
  ingest_batch_id uuid,
  audio jsonb,
  text_search_vector tsvector,
  languoid_id uuid,
  order_index integer NOT NULL DEFAULT 0,
  CONSTRAINT asset_content_link_pkey PRIMARY KEY (id),
  CONSTRAINT asset_content_link_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id),
  CONSTRAINT asset_content_link_languoid_id_fkey FOREIGN KEY (languoid_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.asset_tag_link (
  asset_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_modified timestamp with time zone NOT NULL DEFAULT now(),
  download_profiles ARRAY,
  ingest_batch_id uuid,
  CONSTRAINT asset_tag_link_pkey PRIMARY KEY (asset_id, tag_id),
  CONSTRAINT asset_tags_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id),
  CONSTRAINT asset_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id)
);
CREATE TABLE public.bible_audio_timestamp (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  audio_fileset_id text NOT NULL,
  bible_id text,
  book_id text NOT NULL,
  chapter integer NOT NULL,
  timestamps jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bible_audio_timestamp_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blocked_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL,
  content_id uuid NOT NULL,
  content_table text NOT NULL,
  CONSTRAINT blocked_content_pkey PRIMARY KEY (id),
  CONSTRAINT blocked_content_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id)
);
CREATE TABLE public.blocked_users (
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  CONSTRAINT blocked_users_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profile(id),
  CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profile(id)
);
CREATE TABLE public.clone_job (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  root_project_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued'::text CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])),
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clone_job_pkey PRIMARY KEY (id),
  CONSTRAINT clone_job_root_project_id_fkey FOREIGN KEY (root_project_id) REFERENCES public.project(id)
);
CREATE TABLE public.export_quest_artifact (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL,
  project_id uuid NOT NULL,
  audio_url text,
  metadata jsonb NOT NULL,
  export_type text NOT NULL CHECK (export_type = ANY (ARRAY['feedback'::text, 'distribution'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text, 'ingested'::text])),
  error_message text,
  share_token text UNIQUE,
  share_expires_at timestamp with time zone,
  checksum text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT export_quest_artifact_pkey PRIMARY KEY (id),
  CONSTRAINT export_quest_artifact_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quest(id),
  CONSTRAINT export_quest_artifact_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id),
  CONSTRAINT export_quest_artifact_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profile(id)
);
CREATE TABLE public.flag (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone,
  name text NOT NULL UNIQUE,
  CONSTRAINT flag_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invite (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_profile_id uuid NOT NULL,
  receiver_profile_id uuid,
  project_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  as_owner boolean NOT NULL DEFAULT false,
  email text NOT NULL,
  count integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT invite_pkey PRIMARY KEY (id),
  CONSTRAINT invite_request_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id),
  CONSTRAINT invite_request_receiver_profile_id_fkey FOREIGN KEY (receiver_profile_id) REFERENCES public.profile(id),
  CONSTRAINT invite_request_sender_profile_id_fkey FOREIGN KEY (sender_profile_id) REFERENCES public.profile(id)
);
CREATE TABLE public.language (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  native_name text NOT NULL,
  english_name text NOT NULL,
  iso639_3 text NOT NULL,
  ui_ready boolean NOT NULL DEFAULT true,
  creator_id uuid,
  active boolean NOT NULL DEFAULT true,
  locale text,
  download_profiles ARRAY,
  ingest_batch_id uuid,
  CONSTRAINT language_pkey PRIMARY KEY (id),
  CONSTRAINT languages_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id)
);
CREATE TABLE public.language_languoid_map (
  language_id uuid NOT NULL,
  languoid_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT language_languoid_map_pkey PRIMARY KEY (language_id)
);
CREATE TABLE public.languoid (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid,
  name text,
  level USER-DEFINED NOT NULL,
  ui_ready boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT languoid_pkey PRIMARY KEY (id),
  CONSTRAINT languoid_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT languoid_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.languoid_alias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_languoid_id uuid NOT NULL,
  label_languoid_id uuid NOT NULL,
  name text NOT NULL,
  alias_type USER-DEFINED NOT NULL,
  source_names ARRAY NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT languoid_alias_pkey PRIMARY KEY (id),
  CONSTRAINT languoid_alias_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT languoid_alias_subject_languoid_id_fkey FOREIGN KEY (subject_languoid_id) REFERENCES public.languoid(id),
  CONSTRAINT languoid_alias_label_languoid_id_fkey FOREIGN KEY (label_languoid_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.languoid_link_suggestion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  languoid_id uuid NOT NULL,
  suggested_languoid_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  match_rank integer NOT NULL DEFAULT 3,
  matched_on text,
  matched_value text,
  status text NOT NULL DEFAULT 'pending'::text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT languoid_link_suggestion_pkey PRIMARY KEY (id),
  CONSTRAINT languoid_link_suggestion_languoid_id_fkey FOREIGN KEY (languoid_id) REFERENCES public.languoid(id),
  CONSTRAINT languoid_link_suggestion_suggested_languoid_id_fkey FOREIGN KEY (suggested_languoid_id) REFERENCES public.languoid(id),
  CONSTRAINT languoid_link_suggestion_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id)
);
CREATE TABLE public.languoid_property (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  languoid_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT languoid_property_pkey PRIMARY KEY (id),
  CONSTRAINT languoid_property_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT languoid_property_languoid_id_fkey FOREIGN KEY (languoid_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.languoid_region (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  languoid_id uuid NOT NULL,
  region_id uuid NOT NULL,
  majority boolean,
  official boolean,
  native boolean,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT languoid_region_pkey PRIMARY KEY (id),
  CONSTRAINT languoid_region_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT languoid_region_languoid_id_fkey FOREIGN KEY (languoid_id) REFERENCES public.languoid(id),
  CONSTRAINT languoid_region_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id)
);
CREATE TABLE public.languoid_source (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text,
  languoid_id uuid NOT NULL,
  unique_identifier text,
  url text,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT languoid_source_pkey PRIMARY KEY (id),
  CONSTRAINT languoid_source_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT languoid_source_languoid_id_fkey FOREIGN KEY (languoid_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.map_acl (
  job_id uuid NOT NULL,
  src_id uuid NOT NULL,
  dst_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_acl_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.clone_job(id)
);
CREATE TABLE public.map_asset (
  job_id uuid NOT NULL,
  src_id uuid NOT NULL,
  dst_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_asset_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.clone_job(id)
);
CREATE TABLE public.map_project (
  job_id uuid NOT NULL,
  src_id uuid NOT NULL,
  dst_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_project_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.clone_job(id)
);
CREATE TABLE public.map_quest (
  job_id uuid NOT NULL,
  src_id uuid NOT NULL,
  dst_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_quest_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.clone_job(id)
);
CREATE TABLE public.notification (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  viewed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  target_table_name text NOT NULL,
  target_record_id uuid NOT NULL,
  CONSTRAINT notification_pkey PRIMARY KEY (id),
  CONSTRAINT notification_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id)
);
CREATE TABLE public.profile (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  username text,
  password text,
  ui_language_id uuid,
  active boolean NOT NULL DEFAULT true,
  terms_accepted boolean NOT NULL DEFAULT false,
  avatar text,
  terms_accepted_at timestamp with time zone,
  email text UNIQUE,
  ui_languoid_id uuid,
  CONSTRAINT profile_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profile_ui_languoid_id_fkey FOREIGN KEY (ui_languoid_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.profile_project_link (
  profile_id uuid NOT NULL,
  project_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  membership text NOT NULL DEFAULT 'member'::text CHECK (membership = ANY (ARRAY['owner'::text, 'member'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  download_profiles ARRAY,
  CONSTRAINT profile_project_link_pkey PRIMARY KEY (profile_id, project_id),
  CONSTRAINT profile_project_link_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id),
  CONSTRAINT profile_project_link_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id)
);
CREATE TABLE public.project (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text,
  target_language_id uuid,
  active boolean DEFAULT true,
  creator_id uuid,
  private boolean DEFAULT false,
  visible boolean DEFAULT true,
  download_profiles ARRAY,
  ingest_batch_id uuid,
  priority smallint DEFAULT '0'::smallint,
  template text DEFAULT 'unstructured'::text CHECK ((template = ANY (ARRAY['unstructured'::text, 'bible'::text, 'fia'::text])) OR template IS NULL),
  versification_template text,
  CONSTRAINT project_pkey PRIMARY KEY (id),
  CONSTRAINT project_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id)
);
CREATE TABLE public.project_closure (
  project_id uuid NOT NULL,
  asset_ids jsonb DEFAULT '[]'::jsonb,
  translation_ids jsonb DEFAULT '[]'::jsonb,
  vote_ids jsonb DEFAULT '[]'::jsonb,
  tag_ids jsonb DEFAULT '[]'::jsonb,
  language_ids jsonb DEFAULT '[]'::jsonb,
  quest_ids jsonb DEFAULT '[]'::jsonb,
  quest_asset_link_ids jsonb DEFAULT '[]'::jsonb,
  asset_content_link_ids jsonb DEFAULT '[]'::jsonb,
  quest_tag_link_ids jsonb DEFAULT '[]'::jsonb,
  asset_tag_link_ids jsonb DEFAULT '[]'::jsonb,
  total_quests integer NOT NULL DEFAULT 0,
  total_assets integer NOT NULL DEFAULT 0,
  total_translations integer NOT NULL DEFAULT 0,
  approved_translations integer NOT NULL DEFAULT 0,
  download_profiles ARRAY DEFAULT '{}'::uuid[],
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  source_language_ids jsonb DEFAULT '[]'::jsonb,
  target_language_ids jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT project_closure_pkey PRIMARY KEY (project_id),
  CONSTRAINT project_closure_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id)
);
CREATE TABLE public.project_language_link (
  project_id uuid NOT NULL,
  language_id uuid,
  language_type text NOT NULL CHECK (language_type = ANY (ARRAY['source'::text, 'target'::text])),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  download_profiles ARRAY DEFAULT '{}'::uuid[],
  ingest_batch_id uuid,
  languoid_id uuid NOT NULL,
  CONSTRAINT project_language_link_pkey PRIMARY KEY (project_id, languoid_id, language_type),
  CONSTRAINT project_language_link_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id),
  CONSTRAINT project_language_link_languoid_id_fkey FOREIGN KEY (languoid_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.project_rollup_progress (
  project_id uuid NOT NULL,
  last_seen_quest_created_at timestamp with time zone,
  last_seen_quest_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_rollup_progress_pkey PRIMARY KEY (project_id),
  CONSTRAINT project_rollup_progress_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id)
);
CREATE TABLE public.quest (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  name text,
  description text,
  project_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  creator_id uuid,
  visible boolean DEFAULT true,
  download_profiles ARRAY,
  ingest_batch_id uuid,
  parent_id uuid,
  metadata text,
  CONSTRAINT quest_pkey PRIMARY KEY (id),
  CONSTRAINT quests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id),
  CONSTRAINT quest_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT quest_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.quest(id)
);
CREATE TABLE public.quest_asset_link (
  quest_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  download_profiles ARRAY,
  visible boolean NOT NULL DEFAULT true,
  ingest_batch_id uuid,
  CONSTRAINT quest_asset_link_pkey PRIMARY KEY (quest_id, asset_id),
  CONSTRAINT quest_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id),
  CONSTRAINT quest_assets_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quest(id)
);
CREATE TABLE public.quest_closure (
  quest_id uuid NOT NULL,
  project_id uuid NOT NULL,
  asset_ids jsonb DEFAULT '[]'::jsonb,
  translation_ids jsonb DEFAULT '[]'::jsonb,
  vote_ids jsonb DEFAULT '[]'::jsonb,
  tag_ids jsonb DEFAULT '[]'::jsonb,
  language_ids jsonb DEFAULT '[]'::jsonb,
  quest_asset_link_ids jsonb DEFAULT '[]'::jsonb,
  asset_content_link_ids jsonb DEFAULT '[]'::jsonb,
  quest_tag_link_ids jsonb DEFAULT '[]'::jsonb,
  asset_tag_link_ids jsonb DEFAULT '[]'::jsonb,
  total_assets integer NOT NULL DEFAULT 0,
  total_translations integer NOT NULL DEFAULT 0,
  approved_translations integer NOT NULL DEFAULT 0,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  download_profiles ARRAY DEFAULT '{}'::uuid[],
  source_language_ids jsonb DEFAULT '[]'::jsonb,
  target_language_ids jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT quest_closure_pkey PRIMARY KEY (quest_id),
  CONSTRAINT quest_closure_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quest(id),
  CONSTRAINT quest_closure_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id)
);
CREATE TABLE public.quest_tag_link (
  quest_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  download_profiles ARRAY,
  ingest_batch_id uuid,
  CONSTRAINT quest_tag_link_pkey PRIMARY KEY (quest_id, tag_id),
  CONSTRAINT quest_tags_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quest(id),
  CONSTRAINT quest_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id)
);
CREATE TABLE public.region (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid,
  name text,
  level USER-DEFINED NOT NULL,
  geometry boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT region_pkey PRIMARY KEY (id),
  CONSTRAINT region_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT region_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.region(id)
);
CREATE TABLE public.region_alias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_region_id uuid NOT NULL,
  label_languoid_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  name text,
  CONSTRAINT region_alias_pkey PRIMARY KEY (id),
  CONSTRAINT region_alias_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT region_alias_subject_region_id_fkey FOREIGN KEY (subject_region_id) REFERENCES public.region(id),
  CONSTRAINT region_alias_label_languoid_id_fkey FOREIGN KEY (label_languoid_id) REFERENCES public.languoid(id)
);
CREATE TABLE public.region_property (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT region_property_pkey PRIMARY KEY (id),
  CONSTRAINT region_property_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT region_property_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id)
);
CREATE TABLE public.region_source (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text,
  region_id uuid NOT NULL,
  unique_identifier text,
  url text,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  creator_id uuid,
  CONSTRAINT region_source_pkey PRIMARY KEY (id),
  CONSTRAINT region_source_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT region_source_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id)
);
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  record_id uuid NOT NULL,
  record_table text NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profile(id)
);
CREATE TABLE public.request (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_profile_id uuid NOT NULL,
  project_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  count integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT request_pkey PRIMARY KEY (id),
  CONSTRAINT request_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id),
  CONSTRAINT request_sender_profile_id_fkey FOREIGN KEY (sender_profile_id) REFERENCES public.profile(id)
);
CREATE TABLE public.subscription (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  target_record_id uuid NOT NULL,
  target_table_name text NOT NULL,
  CONSTRAINT subscription_pkey PRIMARY KEY (id),
  CONSTRAINT project_subscription_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id)
);
CREATE TABLE public.tag (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  ingest_batch_id uuid,
  key text NOT NULL DEFAULT ''::text,
  value text NOT NULL DEFAULT ''::text,
  CONSTRAINT tag_pkey PRIMARY KEY (id)
);
CREATE TABLE public.translation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  asset_id uuid NOT NULL,
  target_language_id uuid,
  text text,
  audio text,
  creator_id uuid,
  active boolean NOT NULL DEFAULT true,
  visible boolean DEFAULT true,
  download_profiles ARRAY,
  ingest_batch_id uuid,
  CONSTRAINT translation_pkey PRIMARY KEY (id),
  CONSTRAINT translations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id),
  CONSTRAINT translations_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id)
);
CREATE TABLE public.upload_inbox (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL,
  logs text NOT NULL,
  error_code text NOT NULL,
  ref_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT upload_inbox_pkey PRIMARY KEY (id)
);
CREATE TABLE public.vote (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  asset_id uuid NOT NULL,
  polarity text NOT NULL,
  comment text,
  creator_id uuid,
  active boolean NOT NULL DEFAULT true,
  download_profiles ARRAY,
  ingest_batch_id uuid,
  translation_id uuid,
  CONSTRAINT vote_pkey PRIMARY KEY (id),
  CONSTRAINT votes_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profile(id),
  CONSTRAINT vote_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id)
);