CREATE TABLE IF NOT EXISTS t_p52856178_task_manager_pizzeri.team_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(80) DEFAULT 'Сотрудник',
    color VARCHAR(40) DEFAULT 'bg-sky-500',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p52856178_task_manager_pizzeri.tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    assignee_id INTEGER,
    due_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p52856178_task_manager_pizzeri.task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    author VARCHAR(120) DEFAULT 'Сотрудник',
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON t_p52856178_task_manager_pizzeri.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON t_p52856178_task_manager_pizzeri.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON t_p52856178_task_manager_pizzeri.task_comments(task_id);

INSERT INTO t_p52856178_task_manager_pizzeri.team_members (name, role, color) VALUES
('Анна К.', 'Старший смены', 'bg-rose-500'),
('Игорь П.', 'Повар', 'bg-sky-500'),
('Марат С.', 'Кладовщик', 'bg-emerald-500'),
('Лена В.', 'Кассир', 'bg-violet-500');

INSERT INTO t_p52856178_task_manager_pizzeri.tasks (title, description, assignee_id, due_at, status) VALUES
('Принять поставку сыра и теста', 'Проверить накладные, взвесить, занести в учёт', 1, NOW() + INTERVAL '3 hour', 'open'),
('Санитарный аудит зала', 'Чек-лист чистоты по залу и кухне', 2, NOW() - INTERVAL '18 hour', 'overdue'),
('Инвентаризация холодильников', 'Сверить остатки, списать просрочку', 3, NOW() + INTERVAL '6 hour', 'open'),
('Обучение нового кассира', 'Провести вводный инструктаж по кассе', 4, NOW() + INTERVAL '1 day', 'open'),
('Закрытие смены и сверка кассы', 'Снять Z-отчёт, сверить наличные', 1, NOW() - INTERVAL '12 hour', 'done'),
('Заказ упаковки и расходников', 'Коробки, салфетки, перчатки', 2, NOW() + INTERVAL '3 day', 'open');

INSERT INTO t_p52856178_task_manager_pizzeri.task_comments (task_id, author, text) VALUES
(2, 'Игорь П.', 'Не успел из-за наплыва гостей, перенесу на утро'),
(1, 'Анна К.', 'Поставщик предупредил о задержке на час');
