const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  'image/jpeg': { extension: '.jpg', signature: (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  'image/png': { extension: '.png', signature: (data) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: '.webp', signature: (data) => data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' },
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function uploadImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    const status = tooLarge ? 413 : 400;
    return res.status(status).json({
      error: tooLarge
        ? 'รูปภาพมีขนาดเกิน 5 MB'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'อัปโหลดไฟล์ในช่องรูปภาพเท่านั้น'
          : 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาตรวจสอบชนิดและขนาดไฟล์',
      request_id: req.requestId,
    });
  });
}

function validateImage(file) {
  const type = IMAGE_TYPES[file?.mimetype];
  return type && type.signature(file.buffer) ? type : null;
}

function validateTitle(value) {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  return title.length > 0 && title.length <= 160 ? title : null;
}

function validateLink(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch (_) {
    return null;
  }
}

function validateActive(value) {
  if (value === undefined) return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return null;
}

async function saveImage(file) {
  const imageType = validateImage(file);
  if (!imageType) {
    const error = new Error('รูปภาพต้องเป็นไฟล์ JPEG, PNG หรือ WebP ที่ถูกต้อง');
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${imageType.extension}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer, { flag: 'wx' });
  return filename;
}

async function removeImage(filename) {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, filename));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function publicAd(row) {
  return {
    id: row.advertisement_id,
    title: row.title,
    linkUrl: row.link_url,
    imageUrl: `/api/ads/images/${row.image_filename}`,
  };
}

router.get('/api/ads/random', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT advertisement_id, title, link_url, image_filename
     FROM Advertisement
     WHERE is_active = TRUE
     ORDER BY RAND()
     LIMIT 1`
  );
  res.set('Cache-Control', 'no-store');
  res.json(rows.length ? publicAd(rows[0]) : null);
}));

router.use('/api/admin/ads', requireAdmin);

router.get('/api/admin/ads', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT advertisement_id, title, link_url, image_filename, is_active, created_at, updated_at
     FROM Advertisement
     ORDER BY created_at DESC, advertisement_id DESC`
  );
  res.json(rows.map((row) => ({
    ...publicAd(row),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}));

router.post('/api/admin/ads', uploadImage, asyncRoute(async (req, res) => {
  const title = validateTitle(req.body.title);
  const linkUrl = validateLink(req.body.linkUrl);
  const isActive = validateActive(req.body.isActive);
  if (!title || !linkUrl || !req.file || isActive === null) {
    return res.status(400).json({
      error: 'title, a valid http(s) link, and an image are required',
      request_id: req.requestId,
    });
  }

  const filename = await saveImage(req.file);
  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO Advertisement (title, link_url, image_filename, is_active, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title, linkUrl, filename, isActive === undefined ? true : isActive, req.session.userId]
    );
  } catch (err) {
    await removeImage(filename);
    throw err;
  }
  return res.status(201).json({
    id: result.insertId,
    title,
    linkUrl,
    imageUrl: `/api/ads/images/${filename}`,
    isActive: isActive === undefined ? true : isActive,
  });
}));

router.patch('/api/admin/ads/:id', uploadImage, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'advertisement not found', request_id: req.requestId });
  }

  const [existingRows] = await pool.query(
    `SELECT advertisement_id, title, link_url, image_filename, is_active, created_at, updated_at
     FROM Advertisement WHERE advertisement_id = ?`,
    [id]
  );
  if (!existingRows.length) {
    return res.status(404).json({ error: 'advertisement not found', request_id: req.requestId });
  }

  const { title, linkUrl, isActive } = req.body;
  const nextTitle = title === undefined ? undefined : validateTitle(title);
  const nextLinkUrl = linkUrl === undefined ? undefined : validateLink(linkUrl);
  const nextIsActive = validateActive(isActive);
  if (
    (title !== undefined && !nextTitle)
    || (linkUrl !== undefined && !nextLinkUrl)
    || nextIsActive === null
    || (title === undefined && linkUrl === undefined && isActive === undefined && !req.file)
  ) {
    return res.status(400).json({ error: 'invalid advertisement update', request_id: req.requestId });
  }

  const existing = existingRows[0];
  const oldFilename = existing.image_filename;
  const newFilename = req.file ? await saveImage(req.file) : oldFilename;
  const fields = [];
  const values = [];
  if (nextTitle !== undefined) { fields.push('title = ?'); values.push(nextTitle); }
  if (nextLinkUrl !== undefined) { fields.push('link_url = ?'); values.push(nextLinkUrl); }
  if (nextIsActive !== undefined) { fields.push('is_active = ?'); values.push(nextIsActive); }
  if (req.file) { fields.push('image_filename = ?'); values.push(newFilename); }
  values.push(id);

  try {
    await pool.query(`UPDATE Advertisement SET ${fields.join(', ')} WHERE advertisement_id = ?`, values);
  } catch (err) {
    if (req.file) await removeImage(newFilename);
    throw err;
  }
  if (req.file) await removeImage(oldFilename);

  return res.json({
    id,
    title: nextTitle === undefined ? existing.title : nextTitle,
    linkUrl: nextLinkUrl === undefined ? existing.link_url : nextLinkUrl,
    imageUrl: `/api/ads/images/${newFilename}`,
    isActive: nextIsActive === undefined ? Boolean(existing.is_active) : nextIsActive,
  });
}));

router.delete('/api/admin/ads/:id', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'advertisement not found', request_id: req.requestId });
  }
  const [rows] = await pool.query(
    'SELECT image_filename FROM Advertisement WHERE advertisement_id = ?',
    [id]
  );
  if (!rows.length) {
    return res.status(404).json({ error: 'advertisement not found', request_id: req.requestId });
  }
  await pool.query('DELETE FROM Advertisement WHERE advertisement_id = ?', [id]);
  await removeImage(rows[0].image_filename);
  return res.status(204).end();
}));

module.exports = router;
