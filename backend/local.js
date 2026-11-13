const { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const cookieName = 'career_session';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', path: '/' });
const sessionToken = req => req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
const publicUser = user => ({ id: user.id, email: user.email, displayName: user.display_name });

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 });
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const key = await derive(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(hash, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
function validateHistory(data) {
  if (!Array.isArray(data) || data.length > 100) return false;
  const ids = new Set();
  return data.every(conv => {
    if (!conv || typeof conv.id !== 'string' || !conv.id || conv.id.length > 100 || ids.has(conv.id) ||
      typeof conv.title !== 'string' || conv.title.length > 100 || !Array.isArray(conv.messages) || conv.messages.length > 1000) return false;
    ids.add(conv.id);
    return conv.messages.every(msg => msg && ['user', 'bot'].includes(msg.sender) && typeof msg.text === 'string' && msg.text.length <= 32000 &&
      (msg.files === undefined || (Array.isArray(msg.files) && msg.files.length <= 20 && msg.files.every(f => typeof f === 'string' && f.length <= 255))));
  });
}
async function initializeDatabase(pool) {
  await pool.query(await readFile(path.join(__dirname, 'schema.sql'), 'utf8'));
}
async function findSession(req) {
  const token = sessionToken(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await req.app.locals.pool.query(`SELECT u.id, u.email, u.display_name FROM sessions s
    JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`, [digest(token)]);
  return rows[0] || null;
}
function requireDatabase(req, res, next) {
  if (!req.app.locals.pool) return res.status(503).json({ error: 'Local database is unavailable. Start PostgreSQL and restart the app.' });
  next();
}
async function requireSession(req, res, next) {
  if (!req.app.locals.pool) return res.status(503).json({ error: 'Local database is unavailable. Start PostgreSQL and restart the app.' });
  req.user = await findSession(req);
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

// ponytail: one app process only; use a shared limiter if adding app replicas.
function limitRequests(max, windowMs) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of buckets) if (entry.until <= now) buckets.delete(key);
    const key = req.user?.id || req.ip;
    const entry = buckets.get(key) || { count: 0, until: now + windowMs };
    buckets.set(key, entry);
    if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }
    next();
  };
}

function registerLocalRoutes(app) {
  app.use('/api/auth', requireDatabase);
  app.use(['/api/auth/login', '/api/auth/signup'], limitRequests(10, 15 * 60 * 1000));
  app.get('/api/auth/session', async (req, res) => {
    const user = await findSession(req);
    res.json({ user: user ? publicUser(user) : null });
  });
  app.post('/api/auth/:action', async (req, res, next) => {
    const { action } = req.params;
    if (!['login', 'signup', 'logout'].includes(action)) return next();
    const pool = app.locals.pool;
    if (action === 'logout') {
      const token = sessionToken(req);
      if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [digest(token)]);
      res.clearCookie(cookieName, cookieOptions());
      return res.sendStatus(204);
    }
    const { email, password, username } = req.body || {};
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || !password || password.length > 128 ||
      (action === 'signup' && (password.length < 12 || typeof username !== 'string' || !username.trim() || username.trim().length > 80))) {
      return res.status(400).json({ error: 'Enter a valid email, name and password (12–128 characters for signup).' });
    }
    let user;
    if (action === 'signup') {
      const passwordHash = await hashPassword(password);
      try {
        const result = await pool.query('INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
          [randomUUID(), email.trim().toLowerCase(), username.trim(), passwordHash]);
        user = result.rows[0];
      } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'An account already uses this email. Try Login instead.' });
        throw error;
      }
    } else {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      user = result.rows[0];
      // Derive a hash even for unknown accounts to avoid a fast account-existence check.
      const matches = user ? await verifyPassword(password, user.password_hash) : (await hashPassword(password), false);
      if (!matches) return res.status(401).json({ error: 'The email or password is incorrect. Please try again.' });
    }
    const token = randomBytes(32).toString('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM sessions WHERE expires_at <= now()');
      const oldToken = sessionToken(req);
      if (oldToken) await client.query('DELETE FROM sessions WHERE token_hash = $1', [digest(oldToken)]);
      await client.query("INSERT INTO sessions VALUES ($1, $2, now() + interval '7 days')", [digest(token), user.id]);
      await client.query('INSERT INTO chat_histories (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    res.cookie(cookieName, token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(action === 'signup' ? 201 : 200).json({ user: publicUser(user) });
  });
  app.use('/api/history', requireSession);
  app.get('/api/history', async (req, res) => {
    const { rows } = await app.locals.pool.query('SELECT conversations, revision FROM chat_histories WHERE user_id = $1', [req.user.id]);
    res.json(rows[0] || { conversations: [], revision: 0 });
  });
  app.put('/api/history', async (req, res) => {
    const { conversations, revision } = req.body || {};
    if (!Number.isInteger(revision) || revision < 0 || !validateHistory(conversations)) return res.status(400).json({ error: 'Invalid conversation history.' });
    const clean = conversations.map(c => ({ id: c.id, title: c.title, messages: c.messages.map(m => ({ sender: m.sender, text: m.text, ...(m.files ? { files: m.files } : {}) })) }));
    const { rows } = await app.locals.pool.query(`UPDATE chat_histories SET conversations = $1, revision = revision + 1,
      updated_at = now() WHERE user_id = $2 AND revision = $3 RETURNING revision`, [JSON.stringify(clean), req.user.id, revision]);
    if (!rows.length) return res.status(409).json({ error: 'Conversations changed in another tab. Reload before making more changes.' });
    res.json(rows[0]);
  });
}
module.exports = { hashPassword, verifyPassword, validateHistory, initializeDatabase, registerLocalRoutes, requireSession, limitRequests };
