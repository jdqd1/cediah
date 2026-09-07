-- Cover every guided-learning foreign key on the referencing side. PostgreSQL
-- does not add these indexes automatically; they keep joins and cascading
-- parent updates/deletes bounded as attempts and progress accumulate.

create index learning_attempts_enrollment_version_fk_index
on public.learning_attempts (enrollment_id, path_version_id);

create index learning_attempts_step_version_fk_index
on public.learning_attempts (step_id, path_version_id);

create index learning_attempts_option_version_fk_index
on public.learning_attempts (step_option_id, path_version_id);

create index learning_enrollment_versions_enrollment_path_fk_index
on public.learning_enrollment_versions (enrollment_id, path_id);

create index learning_enrollment_versions_version_path_fk_index
on public.learning_enrollment_versions (path_version_id, path_id);

create index learning_enrollment_versions_previous_path_fk_index
on public.learning_enrollment_versions (previous_version_id, path_id);

create index learning_enrollments_version_path_fk_index
on public.learning_enrollments (path_version_id, path_id);

create index learning_events_attempt_fk_index
on public.learning_events (attempt_id);

create index learning_events_enrollment_fk_index
on public.learning_events (enrollment_id);

create index learning_path_steps_unit_version_fk_index
on public.learning_path_steps (unit_id, path_version_id);

create index learning_path_versions_publisher_fk_index
on public.learning_path_versions (published_by);

create index learning_paths_cover_asset_fk_index
on public.learning_paths (cover_asset_id);

create index learning_paths_creator_fk_index
on public.learning_paths (created_by);

create index learning_paths_published_version_path_fk_index
on public.learning_paths (published_version_id, id);

create index learning_preferences_pinned_enrollment_fk_index
on public.learning_preferences (pinned_enrollment_id);

create index learning_review_states_item_fk_index
on public.learning_review_states (item_id);

create index learning_step_options_source_content_fk_index
on public.learning_step_options (source_content_id);

create index learning_step_options_step_version_fk_index
on public.learning_step_options (step_id, path_version_id);

create index learning_step_progress_evidence_attempt_fk_index
on public.learning_step_progress (evidence_attempt_id);

create index learning_step_progress_step_version_fk_index
on public.learning_step_progress (step_id, path_version_id);

create index learning_task_overrides_enrollment_fk_index
on public.learning_task_overrides (enrollment_id);
