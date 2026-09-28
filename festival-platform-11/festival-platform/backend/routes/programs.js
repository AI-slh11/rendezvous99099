const express = require('express');
const router = express.Router();
const db = require('../db');

// List all programs (with assigned judges + registration counts)
router.get('/', (req, res) => {
  const programs = db.prepare('SELECT * FROM programs ORDER BY created_at DESC').all();
  const judgesStmt = db.prepare(`
    SELECT u.id, u.code, u.name FROM program_judges pj
    JOIN users u ON u.id = pj.judge_id WHERE pj.program_id = ?
  `);
  const countStmt = db.prepare('SELECT COUNT(*) c FROM registrations WHERE program_id = ?');
  const result = programs.map(p => ({
    ...p,
    judges: judgesStmt.all(p.id),
    registration_count: countStmt.get(p.id).c
  }));
  res.json(result);
});

// Programs assigned to a specific judge
router.get('/for-judge/:judgeId', (req, res) => {
  const programs = db.prepare(`
    SELECT p.* FROM programs p
    JOIN program_judges pj ON pj.program_id = p.id
    WHERE pj.judge_id = ?
    ORDER BY p.created_at DESC
  `).all(req.params.judgeId);
  res.json(programs);
});

// Create a program (organizer)
router.post('/', (req, res) => {
  const { name, code, type, language, time_slot, quota } = req.body;
  if (!name || !code || !type) return res.status(400).json({ error: 'name, code, type required' });
  if (!['writing', 'stage'].includes(type)) return res.status(400).json({ error: 'type must be writing or stage' });
  const info = db.prepare(
    'INSERT INTO programs (name, code, type, language, time_slot, quota) VALUES (?,?,?,?,?,?)'
  ).run(name, code.toUpperCase(), type, language || null, time_slot || null, quota ? Number(quota) : null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Assign a judge to a program (manual assignment by organizer)
router.post('/:id/judges', (req, res) => {
  const { judge_id } = req.body;
  try {
    db.prepare('INSERT INTO program_judges (program_id, judge_id) VALUES (?,?)').run(req.params.id, judge_id);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Judge already assigned to this program' });
  }
});

router.delete('/:id/judges/:judgeId', (req, res) => {
  db.prepare('DELETE FROM program_judges WHERE program_id = ? AND judge_id = ?').run(req.params.id, req.params.judgeId);
  res.json({ ok: true });
});

// Edit any program field (organizer)
router.patch('/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Program not found' });
  const b = req.body;
  const type = b.type ?? cur.type;
  if (!['writing', 'stage'].includes(type)) return res.status(400).json({ error: 'type must be writing or stage' });
  const quota = 'quota' in b ? (b.quota ? Number(b.quota) : null) : cur.quota;
  db.prepare('UPDATE programs SET name=?, code=?, type=?, language=?, time_slot=?, quota=? WHERE id=?').run(
    b.name ?? cur.name, (b.code ?? cur.code).toUpperCase(), type,
    'language' in b ? (b.language || null) : cur.language,
    'time_slot' in b ? (b.time_slot || null) : cur.time_slot, quota, cur.id);
  res.json({ ok: true });
});

// Delete a program (also removes its registrations, scores and judge assignments)
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin override: publish / unpublish a program's results (no completeness check)
router.patch('/:id/published', (req, res) => {
  const on = !!req.body.published;
  const prog = db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id);
  if (!prog) return res.status(404).json({ error: 'Program not found' });
  const io = req.app.get('io');
  if (on) {
    if (!prog.results_published) {
      db.prepare("UPDATE programs SET results_published = 1, published_at = datetime('now') WHERE id = ?").run(prog.id);
      db.prepare("UPDATE registrations SET status = 'results_announced' WHERE program_id = ? AND status = 'judged'").run(prog.id);
    }
    io.emit('results:published', { program_id: prog.id });
  } else {
    db.prepare('UPDATE programs SET results_published = 0, published_at = NULL WHERE id = ?').run(prog.id);
    db.prepare("UPDATE registrations SET status = 'judged' WHERE program_id = ? AND status = 'results_announced'").run(prog.id);
    io.emit('results:unpublished', { program_id: prog.id });
  }
  res.json({ ok: true });
});

// Set or clear the registration quota (empty/0 = unlimited)
router.patch('/:id/quota', (req, res) => {
  const q = req.body.quota ? Number(req.body.quota) : null;
  if (q !== null && (!Number.isInteger(q) || q < 1)) return res.status(400).json({ error: 'quota must be a positive whole number' });
  db.prepare('UPDATE programs SET quota = ? WHERE id = ?').run(q, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
