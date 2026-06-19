import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

S = 't_p52856178_task_manager_pizzeri'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def _conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _esc(v):
    return str(v).replace("'", "''")


def _get_user(cur, session_id):
    if not session_id:
        return None
    cur.execute(f"""
        SELECT u.id, u.name, u.role, u.color
        FROM {S}.sessions s JOIN {S}.users u ON u.id = s.user_id
        WHERE s.id = '{_esc(session_id)}' AND s.expires_at > NOW()
    """)
    row = cur.fetchone()
    return dict(row) if row else None


def handler(event: dict, context) -> dict:
    """Управление задачами пиццерии с авторизацией: список, создание, обновление, комментарии."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    session_id = (event.get('headers') or {}).get('X-Session-Id', '')
    params = event.get('queryStringParameters') or {}
    resource = params.get('resource', 'tasks')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            user = _get_user(cur, session_id)

        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'unauthorized'})}

        if resource == 'users':
            return _users(conn)

        if resource == 'comments':
            if method == 'GET':
                return _list_comments(conn, params.get('task_id'))
            if method == 'POST':
                return _add_comment(conn, json.loads(event.get('body') or '{}'), user)

        if method == 'GET':
            return _list_tasks(conn)
        if method == 'POST':
            return _create_task(conn, json.loads(event.get('body') or '{}'), user)
        if method == 'PUT':
            return _update_task(conn, json.loads(event.get('body') or '{}'))

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'method not allowed'})}
    finally:
        conn.close()


def _users(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'SELECT id, name, role, color FROM {S}.users ORDER BY name')
        rows = cur.fetchall()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps([dict(r) for r in rows])}


def _list_tasks(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT t.id, t.title, t.description, t.due_at, t.status,
                   t.assigned_to, t.created_by,
                   u_a.name AS assignee_name, u_a.color AS assignee_color,
                   u_c.name AS creator_name,
                   (SELECT COUNT(*) FROM {S}.task_comments c WHERE c.task_id = t.id) AS comments
            FROM {S}.tasks t
            LEFT JOIN {S}.users u_a ON u_a.id = t.assigned_to
            LEFT JOIN {S}.users u_c ON u_c.id = t.created_by
            ORDER BY t.due_at NULLS LAST, t.id
        """)
        rows = cur.fetchall()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps([dict(r) for r in rows], default=str)}


def _create_task(conn, data, user):
    title = _esc(data.get('title', '').strip())
    desc = _esc(data.get('description', ''))
    assigned_to = data.get('assigned_to')
    due = data.get('due_at')
    status = _esc(data.get('status', 'open'))

    if not title:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'title required'})}

    a_val = str(int(assigned_to)) if assigned_to else 'NULL'
    due_val = f"'{_esc(due)}'" if due else 'NULL'

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            INSERT INTO {S}.tasks (title, description, assigned_to, created_by, due_at, status)
            VALUES ('{title}', '{desc}', {a_val}, {user['id']}, {due_val}, '{status}')
            RETURNING id
        """)
        new_id = cur.fetchone()['id']
        conn.commit()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'id': new_id})}


def _update_task(conn, data):
    task_id = data.get('id')
    if not task_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id required'})}

    sets = ['updated_at = NOW()']
    if 'status' in data:
        sets.append(f"status = '{_esc(data['status'])}'")
    if 'due_at' in data:
        due = data['due_at']
        sets.append(f"due_at = '{_esc(due)}'" if due else 'due_at = NULL')
    if 'assigned_to' in data:
        a = data['assigned_to']
        sets.append(f'assigned_to = {int(a)}' if a else 'assigned_to = NULL')
    if 'title' in data:
        sets.append(f"title = '{_esc(data['title'])}'")
    if 'description' in data:
        sets.append(f"description = '{_esc(data['description'])}'")

    with conn.cursor() as cur:
        cur.execute(f"UPDATE {S}.tasks SET {', '.join(sets)} WHERE id = {int(task_id)}")
        conn.commit()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}


def _list_comments(conn, task_id):
    if not task_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'task_id required'})}
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT id, task_id, author, text, created_at
            FROM {S}.task_comments WHERE task_id = {int(task_id)} ORDER BY id
        """)
        rows = cur.fetchall()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps([dict(r) for r in rows], default=str)}


def _add_comment(conn, data, user):
    task_id = data.get('task_id')
    text = _esc(data.get('text', '').strip())
    if not task_id or not text:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'task_id and text required'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            INSERT INTO {S}.task_comments (task_id, author, text, user_id)
            VALUES ({int(task_id)}, '{_esc(user['name'])}', '{text}', {user['id']})
            RETURNING id
        """)
        new_id = cur.fetchone()['id']
        conn.commit()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'id': new_id})}
