import React, { useEffect, useMemo, useState } from 'react';
import Toggle from './Toggle';
import { BellIcon, DocIcon, MegaphoneIcon } from '../icons';
import { fmtDate, fmtTime, isDone, withDerived } from '../tasks';
import { C, FONT, R, TH_MONTHS_SHORT } from '../theme';

// Minutes, as the API stores them, so nothing has to carry a unit around.
const PRESETS = [60, 180, 1440, 4320];

const UNITS = [
  { value: 1, label: 'นาที' },
  { value: 60, label: 'ชั่วโมง' },
  { value: 1440, label: 'วัน' },
];

const MAX_LEAD_MINUTES = 40320; // 28 days — same ceiling the backend enforces

function formatLeadTime(minutes) {
  if (minutes % 1440 === 0) return `${minutes / 1440} วัน`;
  if (minutes % 60 === 0) return `${minutes / 60} ชั่วโมง`;
  return `${minutes} นาที`;
}

const pad = (n) => String(n).padStart(2, '0');

// Buddhist-era date, the same convention MiniCalendar uses for its header.
function formatThaiDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// One string per state, so "has anything changed?" is a comparison, not a diff.
// lastCustom counts: it still needs saving even when nothing else moved.
const snapshot = (s) =>
  JSON.stringify([
    s.enabled,
    [...s.leadTimes].sort((a, b) => a - b),
    s.dailyRepeat,
    s.dailyRepeatTime,
    s.announcementNotify,
    s.lastCustom ?? null,
  ]);

function NotificationSettings({ email }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [enabled, setEnabled] = useState(true);
  const [leadTimes, setLeadTimes] = useState([]);
  const [dailyRepeat, setDailyRepeat] = useState(false);
  const [dailyRepeatTime, setDailyRepeatTime] = useState('08:00');
  const [announcementNotify, setAnnouncementNotify] = useState(true);
  const [lastCustom, setLastCustom] = useState(null);
  const [failures, setFailures] = useState({ failed_count: 0, last_failed_at: null });

  const [saved, setSaved] = useState(null); // snapshot string of the stored state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState(60);
  const [customError, setCustomError] = useState(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }

  // UC-8 step 2: which tasks these settings apply to. Read-only.
  const [tasks, setTasks] = useState([]);

  const apply = (data) => {
    setEnabled(data.enabled);
    setLeadTimes(data.lead_times);
    setDailyRepeat(data.daily_repeat);
    setDailyRepeatTime(data.daily_repeat_time);
    setAnnouncementNotify(data.announcement_notify);
    setLastCustom(data.last_custom_minutes);
    setFailures({
      failed_count: data.failed_count ?? 0,
      last_failed_at: data.last_failed_at ?? null,
    });
    setSaved(
      snapshot({
        enabled: data.enabled,
        leadTimes: data.lead_times,
        dailyRepeat: data.daily_repeat,
        dailyRepeatTime: data.daily_repeat_time,
        announcementNotify: data.announcement_notify,
        lastCustom: data.last_custom_minutes,
      })
    );
  };

  useEffect(() => {
    fetch('/api/notification-settings')
      .then((r) => {
        if (!r.ok) throw new Error('โหลดการตั้งค่าการแจ้งเตือนไม่สำเร็จ');
        return r.json();
      })
      .then(apply)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Reuses the list endpoint. A failure is silent: the panel's job is settings.
  useEffect(() => {
    fetch('/api/assignments')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setTasks(Array.isArray(rows) ? rows : []))
      .catch(() => setTasks([]));
  }, []);

  // The same shape the sender picks from, so this previews what gets mailed.
  const upcoming = useMemo(
    () => withDerived(tasks)
      .filter((t) => t.due && !isDone(t))
      .sort((a, b) => a.due - b.due),
    [tasks]
  );

  const current = snapshot({
    enabled, leadTimes, dailyRepeat, dailyRepeatTime, announcementNotify, lastCustom,
  });
  const dirty = saved !== null && current !== saved;

  // Any edit clears the "saved" note, as the student-id form does.
  const edit = (fn) => (...args) => {
    setJustSaved(false);
    setSaveError(null);
    fn(...args);
  };

  const toggleLead = edit((minutes) => {
    setLeadTimes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    );
  });

  // Presets plus selected custom values, so a custom choice is a chip too.
  const chips = useMemo(() => {
    const extra = leadTimes.filter((m) => !PRESETS.includes(m));
    return [...PRESETS, ...extra.sort((a, b) => a - b)];
  }, [leadTimes]);

  const addCustom = () => {
    const minutes = Number(customValue) * customUnit;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_LEAD_MINUTES) {
      setCustomError('ใส่ได้ตั้งแต่ 1 นาที ถึง 28 วัน');
      return;
    }
    setCustomError(null);
    setJustSaved(false);
    setSaveError(null);
    setLeadTimes((prev) => (prev.includes(minutes) ? prev : [...prev, minutes]));
    setLastCustom(minutes);
    setCustomValue('');
    setCustomOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setJustSaved(false);
    try {
      const r = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          lead_times: leadTimes,
          daily_repeat: dailyRepeat,
          daily_repeat_time: dailyRepeatTime,
          announcement_notify: announcementNotify,
          last_custom_minutes: lastCustom,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      apply(data);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Goes to the logged-in account; the reply only confirms where it went.
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/notification-settings/test', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'ส่งอีเมลทดสอบไม่สำเร็จ');
      setTestResult(
        data.delivered
          ? { ok: true, message: `ส่งอีเมลทดสอบไปที่ ${data.to} แล้ว` }
          : {
              ok: false,
              message: 'ยังไม่ได้ตั้งค่า SMTP — อีเมลถูกเขียนลง log ของ backend แทนการส่งจริง '
                + '(ตั้งค่า SMTP_HOST / SMTP_USER / SMTP_PASS ใน .env.local)',
            }
      );
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  // Switched off, the sub-switches read off too; their saved values are kept.
  // Applied per part, not to the block: a child cannot be more opaque than its
  // parent, and a disabled Toggle already fades itself to 0.5 (Toggle.jsx), so
  // the two multiplied out to 0.22. The heading and footer never fade.
  const dimmed = enabled ? null : { opacity: 0.45 };

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.headIcon}>
          <BellIcon size={17} color={C.pink} />
        </span>
        <div style={styles.headText}>
          <div style={styles.cardTitle}>การแจ้งเตือนทั้งหมด</div>
          <div style={styles.subtitle}>
            แจ้งเตือนก่อนถึงกำหนดส่งงาน ผ่านอีเมล{email ? ` ${email}` : 'ของบัญชีที่เข้าสู่ระบบ'}
          </div>
        </div>
        <Toggle
          checked={enabled}
          onChange={edit(setEnabled)}
          disabled={loading || !!loadError}
          label="เปิดการแจ้งเตือน"
        />
      </div>

      {loading && <p style={styles.muted}>กำลังโหลด…</p>}
      {loadError && <p style={styles.error}>⚠️ {loadError}</p>}

      {!loading && !loadError && (
        <div style={styles.body}>
          {/* Two groups: two unrelated questions sharing only the master switch.
              One switch here, so it sits in the heading rather than its own box. */}
          <section style={styles.group}>
            <div style={styles.groupHead}>
              <span style={{ ...styles.groupIcon, color: C.navy, ...dimmed }}>
                <MegaphoneIcon size={15} />
              </span>
              <div style={{ ...styles.groupTitle, ...dimmed }}>แจ้งเตือนประกาศ</div>
              <Toggle
                checked={enabled && announcementNotify}
                onChange={edit(setAnnouncementNotify)}
                disabled={!enabled}
                label="แจ้งเตือนประกาศใหม่"
              />
            </div>
            <div style={{ ...styles.subtitle, ...dimmed }}>
              ส่งอีเมลเมื่อมีประกาศใหม่ในวิชาที่ซิงก์มาจาก Google Classroom
            </div>
          </section>

          <section style={{ ...styles.group, ...styles.groupDivided }}>
            <div style={styles.groupHead}>
              <span style={{ ...styles.groupIcon, ...dimmed }}><DocIcon size={15} color={C.navy} /></span>
              <div style={{ ...styles.groupTitle, ...dimmed }}>แจ้งเตือนงาน</div>
            </div>

            <div style={{ ...styles.section, ...dimmed }}>
              <div style={styles.sectionTitle}>แจ้งเตือนล่วงหน้าก่อนกำหนดส่ง</div>

              <div style={styles.chipRow}>
                {chips.map((minutes) => {
                  const on = leadTimes.includes(minutes);
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => toggleLead(minutes)}
                      aria-pressed={on}
                      style={{
                        ...styles.chip,
                        ...(on ? styles.chipOn : null),
                      }}
                    >
                      {formatLeadTime(minutes)}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setCustomOpen((v) => !v);
                    setCustomError(null);
                  }}
                  style={{ ...styles.chip, ...styles.chipCustom }}
                >
                  + กำหนดเอง
                </button>
              </div>

              {customOpen && (
                <div style={styles.customRow}>
                  <input
                    type="number"
                    min="1"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    placeholder="เช่น 12"
                    style={{ ...styles.input, width: 96 }}
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(Number(e.target.value))}
                    style={{ ...styles.input, width: 104 }}
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={addCustom} style={styles.ghostBtn}>
                    เพิ่ม
                  </button>
                </div>
              )}
              {customError && <p style={styles.error}>⚠️ {customError}</p>}

              <div style={styles.hint}>
                <span>เลือกได้มากกว่า 1 ช่วงเวลา</span>
                {lastCustom !== null && !leadTimes.includes(lastCustom) && (
                  <>
                    <span>·</span>
                    <span>ล่าสุดที่กำหนดเอง</span>
                    <button
                      type="button"
                      onClick={() => toggleLead(lastCustom)}
                      style={{ ...styles.hintPill, cursor: 'pointer' }}
                    >
                      {formatLeadTime(lastCustom)}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={styles.repeatBox}>
              <div style={{ ...styles.repeatText, ...dimmed }}>
                <div style={styles.repeatTitle}>แจ้งเตือนซ้ำรายวัน</div>
                <div style={styles.subtitle}>ส่งซ้ำทุกวันสำหรับงานที่ยังไม่เสร็จ จนกว่าจะส่งงาน</div>
              </div>
              <input
                type="time"
                value={dailyRepeatTime}
                onChange={edit((e) => setDailyRepeatTime(e.target.value))}
                style={{ ...styles.input, width: 96, ...dimmed }}
              />
              <Toggle
                checked={enabled && dailyRepeat}
                onChange={edit(setDailyRepeat)}
                disabled={!enabled}
                label="แจ้งเตือนซ้ำรายวัน"
              />
            </div>

            <div style={{ ...styles.taskBlock, ...dimmed }}>
              <div style={styles.taskHead}>
                งานที่จะได้รับการแจ้งเตือน
                {upcoming.length > 0 && <span style={styles.taskCount}>{upcoming.length}</span>}
              </div>

              {upcoming.length === 0 ? (
                <p style={styles.taskEmpty}>
                  ยังไม่มีงานค้างที่มีกำหนดส่ง — ซิงก์จาก Google Classroom หรือเพิ่มงานเองที่หน้างานทั้งหมด
                </p>
              ) : (
                <ul style={styles.taskList}>
                  {upcoming.slice(0, 5).map((t) => (
                    <li key={t.assignment_id} style={styles.taskItem}>
                      <span style={styles.taskTitle}>{t.title}</span>
                      <span style={styles.taskMeta}>
                        {t.course_name} · {fmtDate(t.due)} {fmtTime(t.due)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {upcoming.length > 5 && (
                <p style={styles.taskMore}>และอีก {upcoming.length - 5} งาน</p>
              )}
            </div>
          </section>

          {failures.failed_count > 0 && (
            <div style={styles.failBox}>
              <div style={styles.failTitle}>⚠️ ส่งอีเมลไม่สำเร็จ {failures.failed_count} รายการ</div>
              <div style={styles.failMeta}>
                ระบบบันทึกข้อผิดพลาดไว้แล้ว
                {failures.last_failed_at && ` · ครั้งล่าสุด ${formatThaiDateTime(failures.last_failed_at)}`}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Outside the body: these act on the card, not on any one setting. */}
      {!loading && !loadError && (
        <div style={styles.footer}>
          <div style={styles.actions}>
            {/* Always pressable: dimming it read as broken, and re-saving is
                an idempotent upsert. The state is said in words below. */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ ...styles.primaryBtn, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              style={{ ...styles.ghostBtn, opacity: testing ? 0.6 : 1 }}
            >
              {testing ? 'กำลังส่ง…' : 'ส่งอีเมลทดสอบ'}
            </button>
          </div>

          {/* Stated rather than implied by a dimmed button. */}
          {dirty && !saving && (
            <p style={styles.subtitle}>ยังไม่ได้บันทึกการเปลี่ยนแปลง</p>
          )}
          {saveError && <p style={styles.error}>⚠️ {saveError}</p>}
          {justSaved && <p style={styles.success}>บันทึกการตั้งค่าแล้ว</p>}
          {testResult && (
            <p style={testResult.ok ? styles.success : styles.error}>
              {testResult.ok ? testResult.message : `⚠️ ${testResult.message}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { background: C.card, borderRadius: R.card, padding: 22, minWidth: 0 },

  head: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  headIcon: { display: 'flex', paddingTop: 2, flexShrink: 0 },
  headText: { flex: '1 1 auto', minWidth: 0 },
  cardTitle: { fontWeight: 700, fontSize: 15, color: C.ink },
  subtitle: { fontSize: 12.5, color: C.muted, marginTop: 4, overflowWrap: 'anywhere' },

  body: {
    marginTop: 18,
    paddingTop: 18,
    borderTop: `1px solid ${C.lineSoft}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },

  group: { display: 'flex', flexDirection: 'column', gap: 14 },
  // A rule above the second group, not a border around each: the card already
  // has several boxes.
  groupDivided: { paddingTop: 18, borderTop: `1px solid ${C.lineSoft}` },
  groupHead: { display: 'flex', alignItems: 'center', gap: 8 },
  groupIcon: { display: 'flex', flexShrink: 0 },
  // Bigger than sectionTitle, which now sits one level under it.
  groupTitle: { flex: '1 1 auto', fontSize: 14.5, fontWeight: 700, color: C.navy },

  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 13.5, fontWeight: 700, color: C.ink },

  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '8px 16px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  chipOn: { background: C.navy, borderColor: C.navy, color: 'white' },
  chipCustom: { color: C.muted, fontWeight: 400 },

  customRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },

  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    fontSize: 12.5,
    color: C.mutedLight,
  },
  hintPill: {
    padding: '3px 10px',
    borderRadius: R.pill,
    border: 'none',
    background: C.pinkBg,
    color: C.pinkDark,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
  },

  repeatBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: R.card,
    border: `1px solid ${C.line}`,
    flexWrap: 'wrap',
  },
  repeatText: { flex: '1 1 220px', minWidth: 0 },
  repeatTitle: { fontSize: 13.5, fontWeight: 700, color: C.ink },

  taskBlock: { padding: 14, borderRadius: R.card, background: C.indigoBg },
  taskHead: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, fontWeight: 700, color: C.navy,
  },
  taskCount: {
    fontSize: 11.5, fontWeight: 700, color: C.card, background: C.navy,
    borderRadius: 999, padding: '1px 8px',
  },
  taskList: { listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 },
  taskItem: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  taskTitle: {
    fontSize: 13, color: C.navy, fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  taskMeta: { fontSize: 12, color: C.muted },
  taskEmpty: { fontSize: 12.5, color: C.muted, margin: '8px 0 0', lineHeight: 1.6 },
  taskMore: { fontSize: 12, color: C.muted, margin: '10px 0 0' },

  failBox: { padding: 14, borderRadius: R.card, background: C.pinkBg },
  failTitle: { fontSize: 13, fontWeight: 700, color: C.pinkDark },
  failMeta: { fontSize: 12.5, color: C.pinkDark, marginTop: 4, opacity: 0.85 },

  footer: { marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 },

  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },

  input: {
    padding: '9px 12px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontSize: 13.5,
    boxSizing: 'border-box',
  },
  ghostBtn: {
    padding: '9px 16px',
    borderRadius: R.pill,
    border: `1px solid ${C.lineInput}`,
    background: C.card,
    color: C.ink,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  primaryBtn: {
    padding: '9px 18px',
    borderRadius: R.pill,
    border: 'none',
    background: C.navy,
    color: 'white',
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  muted: { color: C.mutedLight, fontSize: 13, margin: '12px 0 0' },
  error: { color: C.pinkDark, fontSize: 13, margin: '8px 0 0' },
  success: { color: C.green, fontSize: 13, margin: '8px 0 0' },
};

export default NotificationSettings;
