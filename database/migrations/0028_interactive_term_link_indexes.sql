-- Cover reverse lookups from guides and stable sections back to interactive-term links.

create index interactive_term_links_guide_id_index
on public.interactive_term_links (guide_id);

create index interactive_term_links_section_guide_index
on public.interactive_term_links (section_id, guide_id)
where section_id is not null;
