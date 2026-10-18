const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');

const result = buildSync({
  entryPoints: [path.join(__dirname, '../src/tasks.js')],
  bundle: true, write: false, platform: 'node', format: 'cjs',
});
const taskModule = { exports: {} };
new Function('module', result.outputFiles[0].text)(taskModule);
const { isDone, isSubmitted, isUrgent, isSubmissionManaged, STATUS_OPTIONS } = taskModule.exports;

test('finished work remains due for submission until it is handed in', () => {
  const now = new Date('2026-10-18T12:00:00+07:00');
  const task = { status: 'completed', due: new Date(+now + 3600000) };
  assert.equal(isDone(task), true);
  assert.equal(isSubmitted(task), false);
  assert.equal(isUrgent(task, now), true);
  assert.equal(isUrgent({ ...task, status: 'submitted' }, now), false);
  assert.equal(isUrgent({ ...task, due: new Date(+now - 1) }, now), false);
  assert.equal(isUrgent({ ...task, due: new Date(+now + 49 * 3600000) }, now), false);
});

test('manual work and platform submission ownership stay distinct', () => {
  assert.equal(isSubmissionManaged({ platform_source: null }), false);
  assert.equal(isSubmissionManaged({ platform_source: 'Google Classroom' }), true);
  assert.deepEqual(STATUS_OPTIONS.map(({ value }) => value), ['not_started', 'in_progress', 'completed', 'submitted']);
});

test('donut legend reads left to right from not started through submitted', () => {
  const chart = buildSync({
    entryPoints: [path.join(__dirname, '../src/components/DonutChart.jsx')],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'],
  });
  const chartModule = { exports: {} };
  new Function('module', 'require', chart.outputFiles[0].text)(chartModule, require);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(chartModule.exports.default, {
    completed: 1, submitted: 1, inProgress: 1, notStarted: 1, total: 4,
  }));
  const positions = ['ยังไม่เริ่ม', 'กำลังทำ', 'เสร็จแล้ว', 'ส่งแล้ว'].map((label) => html.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(!html.includes('เสร็จสมบูรณ์'));
});
