-- Face Recognition Smart Door Lock - database bootstrap
-- Executed automatically by the postgres container on first start.

CREATE EXTENSION IF NOT EXISTS vector;

-- Registered users and their 128-dimensional dlib face embedding.
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    face_embedding  vector(128)  NOT NULL
);

-- Every recognition attempt. user_id is NULL for unknown faces and is
-- set to NULL when the matched user is later deleted.
CREATE TABLE IF NOT EXISTS access_logs (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status            VARCHAR(16) NOT NULL,
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confidence_score  DOUBLE PRECISION,
    CONSTRAINT access_logs_status_check CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS ix_access_logs_timestamp ON access_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_access_logs_user_id   ON access_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_access_logs_status    ON access_logs (status);

-- For a door lock the user table is small, so an exact sequential scan with
-- the L2 operator (<->) is fast and guarantees the true nearest neighbour.
-- If the table grows to many thousands of rows, enable an approximate index:
-- CREATE INDEX ix_users_face_embedding_hnsw ON users USING hnsw (face_embedding vector_l2_ops);
