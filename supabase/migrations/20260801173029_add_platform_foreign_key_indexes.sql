create index user_roles_assigned_by_index on public.user_roles (assigned_by);
create index courses_created_by_index on public.courses (created_by);
create index courses_published_by_index on public.courses (published_by);
create index enrollments_granted_by_index on public.enrollments (granted_by);
