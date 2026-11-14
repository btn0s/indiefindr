-- Steam "Adult Only Sexual Content" (content descriptor 3), set by prepare.py. Kept off home discovery shelves.
alter table public.games add column is_adult boolean not null default false;
