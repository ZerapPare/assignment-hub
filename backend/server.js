const express = require('express');
const session = require('express-session');
const { PORT, SESSION_SECRET } = require('./src/config');

const app = express();

app.use(express.json());

// Session cookie (dev: in-memory store; resets when the server restarts).
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // dev over http
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use(require('./src/routes/health'));
app.use(require('./src/routes/auth'));
app.use(require('./src/routes/me'));
app.use(require('./src/routes/assignments'));
app.use(require('./src/routes/classroom'));

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
