const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { hashPassword, verifyPassword, validateHistory } = require('./local');

test('passwords use salted hashes and reject wrong passwords', async () => {
  const first = await hashPassword('a safe password');
  const second = await hashPassword('a safe password');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('a safe password', first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.doesNotMatch(first, /a safe password/);
});

test('history boundary rejects malformed, duplicated and excessive data', () => {
  const valid = [{ id: 'default', title: 'Career options', messages: [{ sender: 'user', text: 'Hello', files: ['notes.txt'] }] }];
  assert.equal(validateHistory(valid), true);
  for (const data of [null, {}, [...valid, ...valid], [{ ...valid[0], id: '' }],
    [{ ...valid[0], messages: [{ sender: 'admin', text: 'bad' }] }],
    [{ ...valid[0], messages: [{ sender: 'bot', text: 'x'.repeat(32001) }] }]]) {
    assert.equal(validateHistory(data), false);
  }
});

test('real PostgreSQL account, session and owner-isolation contract', async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Set TEST_DATABASE_URL to an isolated test PostgreSQL database.');
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const { initializeDatabase } = require('./local');
  await initializeDatabase(pool);
  const app = require('./server');
  app.locals.pool = pool;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const accounts = [];
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [accounts.map(a => a.id)]);
    await pool.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, method = 'GET', body, cookie) => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal((await request('/api/history')).status, 401);
  assert.equal((await request('/api/gemini', 'POST', { prompt: 'career' })).status, 401);
  for (const username of ['Alice', 'Bob']) {
    const email = `${username.toLowerCase()}-${Date.now()}@example.com`;
    const response = await request('/api/auth/signup', 'POST', { username, email, password: 'safe test password' });
    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(response.headers.get('set-cookie'), /SameSite=Strict/);
    const data = await response.json();
    assert.deepEqual(Object.keys(data.user).sort(), ['displayName', 'email', 'id']);
    accounts.push({ email, cookie, id: data.user.id });
  }
  const [alice, bob] = accounts;
  const history = [{ id: 'default', title: 'Private career plan', messages: [{ sender: 'user', text: 'My private plan' }] }];
  assert.equal((await request('/api/history', 'PUT', { conversations: history, revision: 0 }, alice.cookie)).status, 200);
  assert.deepEqual((await (await request('/api/history', 'GET', undefined, bob.cookie)).json()).conversations, []);
  assert.equal((await request('/api/history', 'PUT', { conversations: [], revision: 0 }, alice.cookie)).status, 409);
  const login = await request('/api/auth/login', 'POST', { email: alice.email.toUpperCase(), password: 'safe test password' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await (await request('/api/history', 'GET', undefined, cookie)).json()).conversations, history);
  assert.equal((await request('/api/auth/login', 'POST', { email: alice.email, password: 'wrong password' })).status, 401);
  assert.equal((await request('/api/auth/signup', 'POST', { email: alice.email, username: 'Alice', password: 'short' })).status, 400);
  assert.equal((await request('/api/history', 'PUT', { conversations: null, revision: 1 }, cookie)).status, 400);
  assert.equal((await request('/api/history', 'PUT', { conversations: [], revision: 1 }, cookie)).status, 200);
  assert.equal((await request('/api/auth/logout', 'POST', {}, cookie)).status, 204);
  assert.equal((await request('/api/history', 'GET', undefined, cookie)).status, 401);
  assert.deepEqual(await (await request('/api/auth/session', 'GET', undefined, cookie)).json(), { user: null });
});
