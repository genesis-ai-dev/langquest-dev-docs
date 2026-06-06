## 2. Goals & Non-Goals

**Goals:** 

- Generic multi-stage review workflow  
- Configurable groups, phases, signoff rules  
- Reusable workflow templates  
- Quest-level gating with per-asset rework flags  
- Full audit trail  
- Generic step/progress tracking  
- Contributions anchored to methodology steps  
- Assignments  
- Coordinator-mediated rework delegation

**Out of scope:** QR/WhatsApp onboarding  

- AI features  
- Publication pipeline (Versify/Transcribe/Ethne)  
- Remix UI redesign  
- Push/email/WhatsApp notifications  
- PowerSync bucket rule definitions

**Key changes to existing schema:**

- `quest` gains `submission_state` field
- `asset.content_type` gains new values for contributions
- `project_group` is new and orthogonal to `profile_project_link`
- `review_event` is append-only, server-only (not synced to devices)

> 🟧 **RAFAEL Q1:** What is the purpose?
>
> 🟩 **ANSWER:** *The review_event table is to allow users (especially coordinators/reviewers/owners) to see a full history of the entire review process. E.g., when was certain work submitted, when was it rejected, why was it rejected, when did the translator submit this recording linked to the FIA content, etc.*

- `workflow_template` uses same JSONB architecture as content templates

> 🟧 **RAFAEL Q2:** What is the idea here? Workflow template and Project Template?
>
> 🟩 **ANSWER:** *Yes, "content templates" here is referring to Project Templates, which is still an in development feature. In general, it's just a way to allow users to have any kind of structured content in a project (not just "Bible" structure) and users can share it, edit, apply to their own projects, etc. The nice thing about using a jsonb template structure in the review process before applying it to project structures is the review process will be more forgiving to any mistakes made in designing the jsonb template system since it won't affect existing projects. Git branches caleb/content-templates has all work related to developing this jsonb template system.*

## 4. ETEN Requirements → Technical Mapping

> | Assign passages to translators | `assignment` table — links profile/group to quest/asset |

> 🟧 **RAFAEL Q3:** I am not sure how a link between an asset and an assignment would work. But, I was thinking if it would be possible to have subquests in each bible chapter (or pericope) (like it is already supported in unstructured projects).
>
> 🟩 **ANSWER:** *I don't understand why we would want to have subquests in bible chapter quests, or how that's related to assignments. Is there something unclear about linking an assignment to an asset? Maybe when there are multiple assets in a single assignment?*

- > Clarification: assets don't exist at the time of initial assignment (though linking an assignment to an asset would make sense for rework). If we had project templates, then the assignment could reference an id in the jsonb template. Assignments would also have to be able to indicate ranges.

- `**project_workflow_link`** — Fields: id, project_id (unique — one workflow per project), workflow_template_id, frozen, active, created_at.

> 🟧 **RAFAEL Q4:** Why could a workflow be inactive?
>
> 🟩 **ANSWER:** *Good question. Maybe it won't be. It might be a good generic field to put in (like metadata or created_at) that may end up being useful down the road, but I don't think it's strictly needed.*

## 8. Assignments

- `**assignment`** — Fields: project ref, target_type (`quest`|`asset`), target_id, assignee_type (`profile`|`group`), assignee_id, assignment_type (`translation`|`rework`), status (`pending`|`in_progress`|`completed`|`cancelled`), assigner (profile ref), notes.

> 🟧 **RAFAEL Q5:** I am thinking if the assignments table could be something more versatile. It could be applied to every step of validation (translation, rework, review, approve, etc). Also, maybe add a "percent" field to track the progress (can also be automatic, depending on the context).
>
> 🟩 **ANSWER:** *I think it's a good idea to use assignments for every step of the validation process. This way, the same mechanism that notifies the translator that they need to translate or rework something is the same mechanism that tells a review they have something to review or stamp (approve/reject). I'm not sure we should use it for tracking progress, since I imagine users will want to know the progress of a passage, not necessarily the progress of an individual and their assignment (and there may be multiple people assigned to one particular thing). Therefore, I lean toward progress being associated with the thing that needs to be done, rather than the person doing it. I may be missing something.*
>
> - > Clarification: progress would have to be connected to individual assignments because objective measures would struggle with different versions and review stages. objective progress inferred from individual assignment progress.

## 9. Step / Progress System

Generic, template-agnostic tracking of preparation step completion.

- Steps are defined in `workflow_template.structure.steps[]` — each has a stable `id`.
- `**step_progress`** — Fields: workflow_link ref, step_id (string into JSONB), profile ref, quest ref (scope), completed (boolean), completed_at.

**Progress = completed steps / total required steps.** Contribution counts per step are displayed alongside but do NOT affect the percentage. Translators self-attest completion; coordinators can mark on behalf of translators.

> 🟧 **RAFAEL Q6:** How does this work exactly?
>
> 🟩 **ANSWER:** *In the FIA content, there are 6 steps the translator(s) can go through and check off as having completed. Within each step, sometimes there will be an instruction about having a discussion, or answering general questions, or clarifying how certain words will be translated. These kinds of questions are not programmatically identifiable (i.e., no hard callout in the FIA json content across languages), and so we have no way of knowing how many of these questions/prompts there are in each step. We can allow translators to make "contributions" to the fia step (as assets) by highlighting the question in the fia text or by pausing the fia step audio and allowing them to insert content. But we have no programmatic way of knowing how much content should be contributed. Therefore, we cannot count these contributions as any kind of step progress (but we can notify all interested parties that x pieces of content have been contributed to fia step y of pericope z).*

## 10. Contributions & Anchoring

Contributions (discussion, key terms, rationale, drawings) reuse the existing `asset` infrastructure.

**Extended `asset.content_type` values:** `discussion` | `rationale` | `key_term` | `media` (in addition to existing `source`|`translation`|`transcription`).

- `**asset_anchor`** — Links contribution asset to methodology content. Fields: asset ref, step ref, element_id (nullable — substep identifier), anchor_type (`step`|`sub_element`|`text_range`|`audio_range`), anchor_data (JSON).

> 🟧 **RAFAEL Q7:** I am not sure exactly what this is.
>
> 🟩 **ANSWER:** *An asset_anchor links content (asset) to a specific part of a fia step's content (see last answer). In the UI, the user can highlight or select a sentence in the text, or pause the audio, then contirbute some text or a recording to answer the question/direction in the fia step (since these questions/directions aren't being hard called out in the fia json content).*



- > Clarification: We need to figure out how to make these special contributions available across the right set of quest versions. For changes to special contributions. We would need a way to bind extra study content to specific quests (or assets). We may have to store fia content in the lq database. We need to be able to link to special content. We can version the content and have users update it regularly. It would have to be linked to the template as well (not a quest record). It has to be linked to the project as well because fia content and templates could be shared across projects, and these special contributions are project-specific. We should also store a copy of the fia content in case things like pericope boundaries or other fundamental structuring changes. Should special content be connected to quest versions? Maybe not since they can inform how other version are done. Each special contirbution can have its own revision thread (chain of assets). Should have active flag too.

Contributions are inherently cross-version because they anchor to template steps, not specific quest versions. Remix can pull contributions the same way it pulls recordings.

**Open questions:** Contribution scope (pericope vs team vs project) and anchor granularity (step-only vs freeform). See section 19.

## 11. Quest Versions, "Best", and Remix

Multiple quest versions per pericope already exist as separate `quest` rows.

**New field:** `quest.submission_state` — enum: `draft`|`submitted`|`in_review`|`rework`|`withdrawn`|`approved_final`. Default `draft`. Only one quest per pericope per project can be in a non-draft/non-withdrawn state at a time (partial unique constraint).

> 🟧 **RAFAEL Q8:** How would this work exactly? If someone, for instance, does a partial quest, and another person does the other part, it would be needed to merge them before submit, and, if during a review it is decided that part of that needs to be reworked, the entire quest would need to be submitted to rework, even the parts that are ok.
>
> 🟩 **ANSWER:** *This feature depends on the quest remixing feature being in place. The quest remixing feature will allow users to create a new quest version with pieces from ther quest versions. This way multiple people can combine their contributions to a e.g., pericope, then submit it for review. If the remixed quest version is rejected, the reviewer can leave comments on specific (problem) assets so the translator(s) know what needs to be fixed. The translator(s) can then make a new version with only the edits needed, then use quest remixing to combine the fixed parts with the parts that were already good from the reviewed/rejected version.*

## 12. Submission & Review Flow

Core of the system. A submitted quest version moves through the project's configured phases.

**New entities:**

- `**review_submission`** — One per quest-version review pass. Fields: quest ref, workflow_link ref, current_phase_id (string into JSONB), status (`pending`|`in_review`|`rework`|`completed`|`withdrawn`), submitted_by, submitted_at. Reused across rework cycles (audit log captures history).
- `**review_decision**` — One group's verdict at one phase. Fields: submission ref, phase_id (string into JSONB), group_slot_id (string into JSONB), group ref, decision (`approved`|`rejected`|`withdrawn`), decided_by, reason, decided_at, active flag.
- `**review_comment**` — Threaded discussion. Fields: submission ref, author, target_type (`submission`|`asset`|`comment`), target_id, body, audio ref, created_at.
- `**review_asset_flag**` — Per-asset rework marker. Fields: submission ref, asset ref, flagged_by, reason, status (`open`|`resolved`), resolved_by, resolved_at.

> 🟧 **RAFAEL Q9:** Can a review have more than one decision? Otherwise, submission and decision could be only one entity.
>
> 🟩 **ANSWER:** *If a project owner has assigned more than one person to be in a review stage, they also choose if approval/rejection is decided by one, by all, or by a quoram of a custom percentage.*

