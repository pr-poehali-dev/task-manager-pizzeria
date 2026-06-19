import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = 't_p52856178_task_manager_pizzeri'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def _conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _esc(v):
    return str(v).replace("'", "''")


def handler(event: dict, context) -> dict:
    '''Управление задачами пиццерии: список, создание, обновление статуса/срока/исполнителя, комментарии и команда.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    resource = params.get('resource', 'tasks')

    conn = _conn()
    try:
        if resource == 'team':
            return _team(conn)
        if resource == 'comments':
            if method == 'GET':
                return _list_comments(conn, params.get('task_id'))
            if method == 'POST':
                return _add_comment(conn, json.loads(event.get('body') or '{}'))

        if method == 'GET':
            return _list_tasks(conn)
        if method == 'POST':
            return _create_task(conn, json.loads(event.get('body') or '{}'))
        if method == 'PUT':
            return _update_task(conn, json.loads(event.get('body') or '{}'))

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'method not allowed'})}
    finally:
        conn.close()


def _team(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'SELECT id, name, role, color FROM {SCHEMA}.team_members ORDER BY id')
        rows = cur.fetchall()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(rows, default=str)}


def _list_tasks(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'''
            SELECT t.id, t.title, t.description, t.assignee_id, t.due_at, t.status,
                   m.name AS assignee_name, m.color AS assignee_color,
                   (SELECT COUNT(*) FROM {SCHEMA}.task_comments c WHERE c.task_id = t.id) AS comments
            FROM {SCHEMA}.tasks t
            LEFT JOIN {SCHEMA}.team_members m ON m.id = t.assignee_id
            ORDER BY t.due_at NULLS LAST, t.id
        ''')
        rows = cur.fetchall()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(rows, default=str)}


def _create_task(conn, data):
    title = _esc(data.get('title', '').strip())
    desc = _esc(data.get('description', ''))
    assignee = data.get('assignee_id')
    due = data.get('due_at')
    status = _esc(data.get('status', 'open'))
    if not title:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'title required'})}
    a_val = str(int(assignee)) if assignee else 'NULL'
    due_val = f"'{_esc(due)}'" if due else 'NULL'
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'''
            INSERT INTO {SCHEMA}.tasks (title, description, assignee_id, due_at, status)
            VALUES ('{title}', '{desc}', {a_val}, {due_val}, '{status}')
            RETURNING id
        ''')
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
    if 'assignee_id' in data:
        a = data['assignee_id']
        sets.append(f'assignee_id = {int(a)}' if a else 'assignee_id = NULL')
    if 'title' in data:
        sets.append(f"title = '{_esc(data['title'])}'")
    if 'description' in data:
        sets.append(f"description = '{_esc(data['description'])}'")
    with conn.cursor() as cur:
        cur.execute(f"UPDATE {SCHEMA}.tasks SET {', '.join(sets)} WHERE id = {int(task_id)}")
        conn.commit()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}


def _list_comments(conn, task_id):
    if not task_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'task_id required'})}
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'''
            SELECT id, task_id, author, text, created_at
            FROM {SCHEMA}.task_comments WHERE task_id = {int(task_id)} ORDER BY id
        ''')
        rows = cur.fetchall()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(rows, default=str)}


def _add_comment(conn, data):
    task_id = data.get('task_id')
    text = _esc(data.get('text', '').strip())
    author = _esc(data.get('author', 'Сотрудник'))
    if not task_id or not text:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'task_id and text required'})}
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'''
            INSERT INTO {SCHEMA}.task_comments (task_id, author, text)
            VALUES ({int(task_id)}, '{author}', '{text}') RETURNING id
        ''')
        new_id = cur.fetchone()['id']
        conn.commit()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'id': new_id})}
