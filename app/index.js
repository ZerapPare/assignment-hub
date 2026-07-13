const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

app.get('/', async (req, res) => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    const [rows] = await conn.query('SELECT * FROM assignments ORDER BY deadline');
    await conn.end();

    let html = '<h1>Assignment Hub</h1><table border="1" cellpadding="8">';
    html += '<tr><th>งาน</th><th>วิชา</th><th>แพลตฟอร์ม</th><th>Deadline</th><th>สถานะ</th></tr>';
    rows.forEach(r => {
      html += `<tr><td>${r.title}</td><td>${r.subject}</td><td>${r.platform}</td><td>${r.deadline}</td><td>${r.status}</td></tr>`;
    });
    html += '</table>';
    res.send(html);
  } catch (err) {
    res.send('รอ database พร้อม... ลอง refresh อีกครั้งใน 10 วินาที<br>' + err.message);
  }
});

app.listen(3000, () => console.log('App running on http://localhost:3000'));