-- One email can describe several segments (a return booking, a connection).
-- The original unique (source_email_id, extraction_version) silently kept
-- only the first, dropping return legs — which is why trip chains failed to
-- close. Key extractions per segment instead.
alter table email_extractions add column segment_index integer not null default 0;
alter table email_extractions drop constraint email_extractions_source_email_id_extraction_version_key;
alter table email_extractions
  add constraint email_extractions_email_version_segment_key
  unique (source_email_id, extraction_version, segment_index);
