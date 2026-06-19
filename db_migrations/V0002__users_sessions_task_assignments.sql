CREATE TABLE IF NOT EXISTS t_p52856178_task_manager_pizzeri.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(40) DEFAULT 'employee',
    color VARCHAR(40) DEFAULT 'bg-sky-500',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p52856178_task_manager_pizzeri.sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

ALTER TABLE t_p52856178_task_manager_pizzeri.tasks
    ADD COLUMN IF NOT EXISTS created_by INTEGER;

ALTER TABLE t_p52856178_task_manager_pizzeri.tasks
    ADD COLUMN IF NOT EXISTS assigned_to INTEGER;

ALTER TABLE t_p52856178_task_manager_pizzeri.task_comments
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_sessions_user ON t_p52856178_task_manager_pizzeri.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON t_p52856178_task_manager_pizzeri.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON t_p52856178_task_manager_pizzeri.tasks(created_by);
