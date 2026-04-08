require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'blog.db'));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');

const BCRYPT_ROUNDS = 12;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000
};

// Bootstrap schema
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  )
`);

// Prepared statements
const stmts = {
  recentPosts:    db.prepare('SELECT id, title, excerpt, created_at FROM posts ORDER BY created_at DESC LIMIT 3'),
  allPosts:       db.prepare('SELECT id, title, excerpt, created_at FROM posts ORDER BY created_at DESC'),
  postById:       db.prepare('SELECT * FROM posts WHERE id = ?'),
  userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findUser:       db.prepare('SELECT id FROM users WHERE username = ?'),
  insertUser:     db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
};

// Dummy hash for constant-time comparison when username doesn't exist
let DUMMY_HASH;

// Seed user marco if not present, and generate dummy hash
(async () => {
  DUMMY_HASH = await bcrypt.hash('__dummy__', BCRYPT_ROUNDS);

  const existing = stmts.findUser.get('marco');
  if (!existing) {
    const seedPassword = process.env.SEED_PASSWORD;
    if (!seedPassword) {
      console.warn('SEED_PASSWORD not set — skipping user seed');
      return;
    }
    const hash = await bcrypt.hash(seedPassword, BCRYPT_ROUNDS);
    stmts.insertUser.run('marco', hash);
    console.log('Seeded user marco');
  }
})().catch(err => { console.error('Startup error:', err); process.exit(1); });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.disable('x-powered-by');

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    res.redirect('/login');
  }
}

// Login rate limiter — max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.'
});

// Home — show 3 most recent posts
app.get('/', (req, res) => {
  const posts = stmts.recentPosts.all();
  res.render('index', { title: 'Home', posts });
});

// Blog index
app.get('/blog', (req, res) => {
  const posts = stmts.allPosts.all();
  res.render('blog', { title: 'Blog', posts });
});

// Single post
app.get('/blog/:id', (req, res) => {
  const post = stmts.postById.get(req.params.id);
  if (!post) return res.status(404).render('404', { title: '404' });
  res.render('post', { title: post.title, post });
});

const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,
};

// Login form
app.get('/login', (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie('_csrf', csrfToken, CSRF_COOKIE_OPTIONS);
  res.render('login', { title: 'Login', error: null, csrfToken });
});

// Login submit
app.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password, _csrf } = req.body;
    if (!_csrf || _csrf !== req.cookies._csrf) {
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('_csrf', csrfToken, CSRF_COOKIE_OPTIONS);
      return res.status(403).render('login', { title: 'Login', error: 'Invalid request. Please try again.', csrfToken });
    }
    const user = stmts.userByUsername.get(username);
    // Always run bcrypt.compare to prevent timing attacks on username enumeration
    const hash = user ? user.password_hash : DUMMY_HASH;
    const match = await bcrypt.compare(password || '', hash);
    if (!user || !match) {
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('_csrf', csrfToken, CSRF_COOKIE_OPTIONS);
      return res.status(401).render('login', { title: 'Login', error: 'Invalid credentials.', csrfToken });
    }
    res.clearCookie('_csrf');
    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.redirect('/marco');
  } catch (err) {
    next(err);
  }
});

const fs = require('fs');
const PRIVATE_DIR = path.join(__dirname, 'private');

// Private area — re-issue token on each visit (sliding expiry)
app.get('/marco', requireAuth, (req, res) => {
  const token = jwt.sign({ sub: req.user.sub, username: req.user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, COOKIE_OPTIONS);
  const onepagers = fs.existsSync(PRIVATE_DIR)
    ? fs.readdirSync(PRIVATE_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && dirent.name.toLowerCase().endsWith('.html'))
        .map(dirent => dirent.name)
        .sort()
    : [];
  res.render('marco', { title: 'Private Area', user: req.user, onepagers });
});

// Serve one-pagers — auth required, path traversal prevented
app.get('/marco/onepager/:file', requireAuth, (req, res) => {
  const filename = path.basename(req.params.file);
  if (!filename.toLowerCase().endsWith('.html')) return res.status(400).send('Invalid file');
  const filePath = path.join(PRIVATE_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).render('404', { title: '404' });
  res.sendFile(filePath);
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render('404', { title: '404' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal server error');
});

app.listen(port, '127.0.0.1', () => {
  console.log(`App listening at http://127.0.0.1:${port}`);
});
