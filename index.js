const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const port = 3000;
const db = new Database(path.join(__dirname, 'blog.db'));

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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.disable('x-powered-by');

// Home — show 3 most recent posts
app.get('/', (req, res) => {
  const posts = db.prepare('SELECT id, title, excerpt, created_at FROM posts ORDER BY created_at DESC LIMIT 3').all();
  res.render('index', { title: 'Home', posts });
});

// Blog index
app.get('/blog', (req, res) => {
  const posts = db.prepare('SELECT id, title, excerpt, created_at FROM posts ORDER BY created_at DESC').all();
  res.render('blog', { title: 'Blog', posts });
});

// Single post
app.get('/blog/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).render('404', { title: '404' });
  res.render('post', { title: post.title, post });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render('404', { title: '404' });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`App listening at http://127.0.0.1:${port}`);
});
