-- Optional: not required if room fields live inside config jsonb (current app).
-- Safe to skip. Kept for documentation only.
select id, competition_id, config->>'roomCode' as room_code, config->>'lobbyOpen' as lobby_open
from matrix_meta
where id = 1;
