import hashlib
import json
import os
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor

S = 't_p52856178_task_manager_pizzeri'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    'Content-Type': 'application/json',
}

COLORS = ['bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500']


def _conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _esc(v: str) -> str:
    return str(v).replace("'", "''")


def handler(event: dict, context) -> dict:
    """Регистрация, вход и выход пользователей таск-менеджера пиццерии."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    session_id = (event.get('headers') or {}).get('X-Session-Id', '')

    conn = _conn()
    try:
        if action == 'register' and method == 'POST':
            return _register(conn, json.loads(event.get('body') or '{}'))
        if action == 'login' and method == 'POST':
            return _login(conn, json.loads(event.get('body') or '{}'))
        if action == 'logout' and method == 'POST':
            return _logout(conn, session_id)
        if action == 'me' and method == 'GET':
            return _me(conn, session_id)
        if action == 'users' and method == 'GET':
            return _users(conn, session_id)
        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'not found'})}
    finally:
        conn.close()


BRANCHES = [
    'Москва 14-1', 'Москва 14-2', 'Москва 14-3', 'Москва 14-5',
    'Клин-1', 'Клин-2', 'Звенигород-1', 'Солнечногорск-1',
    'Рублево-1', 'Черноголовка-1', 'Дзержинский-1', 'Нерюнгри-1', 'Нарьян-Мар-1',
]


def _register(conn, data):
    name = _esc(data.get('name', '').strip())
    email = _esc(data.get('email', '').strip().lower())
    password = data.get('password', '')
    role = _esc(data.get('role', 'employee'))
    branch = _esc(data.get('branch', '').strip())

    if not name or not email or not password:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}
    if not branch:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Выберите подразделение'})}
    if len(password) < 6:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT id FROM {S}.users WHERE email = '{email}'")
        if cur.fetchone():
            return {'statusCode': 409, 'headers': CORS, 'body': json.dumps({'error': 'Email уже занят'})}

        cur.execute(f"SELECT COUNT(*) AS cnt FROM {S}.users")
        count = cur.fetchone()['cnt']
        color = COLORS[int(count) % len(COLORS)]

        pw_hash = _hash(password)
        cur.execute(f"""
            INSERT INTO {S}.users (name, email, password_hash, role, color, branch)
            VALUES ('{name}', '{email}', '{pw_hash}', '{role}', '{color}', '{branch}')
            RETURNING id, name, email, role, color, branch
        """)
        user = dict(cur.fetchone())

        session_id = secrets.token_hex(32)
        cur.execute(f"""
            INSERT INTO {S}.sessions (id, user_id)
            VALUES ('{session_id}', {user['id']})
        """)
        conn.commit()

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'session_id': session_id, 'user': user})}


def _login(conn, data):
    email = _esc(data.get('email', '').strip().lower())
    password = data.get('password', '')

    if not email or not password:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}

    pw_hash = _hash(password)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT id, name, email, role, color, branch FROM {S}.users WHERE email = '{email}' AND password_hash = '{pw_hash}'")
        user = cur.fetchone()
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный email или пароль'})}
        user = dict(user)

        session_id = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {S}.sessions (id, user_id) VALUES ('{session_id}', {user['id']})")
        conn.commit()

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'session_id': session_id, 'user': user})}


def _logout(conn, session_id):
    if not session_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'no session'})}
    with conn.cursor() as cur:
        cur.execute(f"UPDATE {S}.sessions SET expires_at = NOW() WHERE id = '{_esc(session_id)}'")
        conn.commit()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}


def _get_user_by_session(cur, session_id):
    if not session_id:
        return None
    cur.execute(f"""
        SELECT u.id, u.name, u.email, u.role, u.color, u.branch
        FROM {S}.sessions s
        JOIN {S}.users u ON u.id = s.user_id
        WHERE s.id = '{_esc(session_id)}' AND s.expires_at > NOW()
    """)
    row = cur.fetchone()
    return dict(row) if row else None


def _me(conn, session_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        user = _get_user_by_session(cur, session_id)
    if not user:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'unauthorized'})}
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(user)}


def _users(conn, session_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        user = _get_user_by_session(cur, session_id)
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'unauthorized'})}
        cur.execute(f"SELECT id, name, role, color, branch FROM {S}.users ORDER BY name")
        rows = cur.fetchall()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps([dict(r) for r in rows])}