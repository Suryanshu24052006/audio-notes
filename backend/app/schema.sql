CREATE TABLE IF NOT EXISTS recordings (
    id            BIGSERIAL PRIMARY KEY,
    filename      TEXT        NOT NULL,
    content_type  TEXT        NOT NULL,
    size_bytes    BIGINT      NOT NULL,
    language      TEXT        NOT NULL,
    storage_key   TEXT        NOT NULL,
    -- queued -> processing -> transcribing -> summarizing -> completed (or failed)
    status        TEXT        NOT NULL DEFAULT 'queued',
    duration_s    REAL,
    chunks_total  INT         NOT NULL DEFAULT 0,
    chunks_done   INT         NOT NULL DEFAULT 0,
    transcript    TEXT,
    summary       TEXT,
    error         TEXT,
    can_retry     BOOLEAN     NOT NULL DEFAULT TRUE,
    summary_error TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one row per <=28s piece sent to gnani
CREATE TABLE IF NOT EXISTS chunks (
    recording_id  BIGINT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    idx           INT    NOT NULL,
    start_s       REAL   NOT NULL,
    end_s         REAL   NOT NULL,
    status        TEXT   NOT NULL DEFAULT 'pending',
    text          TEXT,
    error         TEXT,
    PRIMARY KEY (recording_id, idx)
);

CREATE INDEX IF NOT EXISTS recordings_status_created_idx ON recordings (status, created_at);
