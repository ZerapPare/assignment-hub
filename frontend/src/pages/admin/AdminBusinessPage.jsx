import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminStatCard from '../../components/admin/AdminStatCard';
import TrendChart from '../../components/admin/TrendChart';
import { adminRequest, formatNumber } from '../../components/admin/adminApi';
import { C, FONT, R } from '../../theme';

const RANGES = [
  { value: '7d', label: '7 วัน' },
  { value: '30d', label: '30 วัน' },
  { value: '90d', label: '90 วัน' },
];
const FEATURE_LABELS = {
  classroom_sync: 'Google Classroom Sync',
  manual_task: 'Manual Task Management',
  task_status: 'Update Task Status',
  search_filter: 'Search & Filtering',
  notification_settings: 'Notification Management',
};
const FEATURE_OPTIONS = Object.keys(FEATURE_LABELS);
const CHART_COLORS = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  green: '#0ca30c',
};
const BUSINESS_CSS = `
  .ah-business-table th { color: ${C.mutedLight}; font-size: 11px; font-weight: 600; padding: 0 10px 10px 0; white-space: nowrap; }
  .ah-business-table td { border-top: 1px solid ${C.lineSoft}; padding: 11px 10px 11px 0; vertical-align: middle; }
  .ah-business-table th:not(:first-child), .ah-business-table td:not(:first-child) { text-align: right; }
  @media (max-width: 640px) { .ah-business-integration-grid { grid-template-columns: 1fr; } }
`;

function rangeLabel(range) {
  return RANGES.find((item) => item.value === range)?.label || '30 วัน';
}

function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${Number(value || 0).toFixed(1)}%`;
}

function shortDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(date);
}

function featureLabel(feature) {
  return FEATURE_LABELS[feature] || feature || 'Unknown feature';
}

function AdminBusinessPage() {
  const [params, setParams] = useSearchParams();
  const requestedRange = params.get('range');
  const range = RANGES.some((item) => item.value === requestedRange) ? requestedRange : '30d';
  const [selectedFeature, setSelectedFeature] = useState('classroom_sync');
  const [data, setData] = useState({ overview: null, features: [], trend: null, integrations: null, sources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, features, trend, integrations, sourcePayload] = await Promise.all([
        adminRequest(`/api/admin/business/overview?range=${range}`),
        adminRequest(`/api/admin/business/features?range=${range}`),
        adminRequest(`/api/admin/business/features/${selectedFeature}/trend?range=${range}`),
        adminRequest(`/api/admin/business/integrations?range=${range}`),
        adminRequest(`/api/admin/business/assignment-sources?range=${range}`),
      ]);
      const nextFeatures = Array.isArray(features) ? features : (features?.features || []);
      setData({
        overview: overview || {},
        features: nextFeatures,
        trend: trend || {},
        integrations: integrations || {},
        sources: Array.isArray(sourcePayload) ? sourcePayload : (sourcePayload?.sources || []),
      });
      if (nextFeatures.length && !nextFeatures.some((item) => item.feature === selectedFeature)) {
        setSelectedFeature(nextFeatures[0].feature);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range, selectedFeature]);

  useEffect(() => { load(); }, [load]);

  const overview = data.overview || {};
  const integrations = data.integrations || {};
  const points = data.trend?.points || data.trend?.trend || [];
  const trendLabels = points.map((point) => shortDate(point.bucket_start || point.period));
  const trendValues = points.map((point) => Number(point.actions || 0));
  const sourceMax = Math.max(...data.sources.map((source) => Number(source.assignments || 0)), 1);
  const selectedRangeText = rangeLabel(range);

  const featureOptions = useMemo(() => {
    const seen = new Set(data.features.map((item) => item.feature));
    return FEATURE_OPTIONS.filter((feature) => seen.has(feature) || feature === selectedFeature);
  }, [data.features, selectedFeature]);

  return (
    <div>
      <style>{BUSINESS_CSS}</style>
      <header className="ah-admin-page-header" style={styles.header}>
        <div>
          <div style={styles.kicker}>PRODUCT SIGNALS</div>
          <h1 style={styles.title}>Business Analytics</h1>
          <p style={styles.subtitle}>พฤติกรรมการใช้งานจริงของนักเรียน</p>
        </div>
        <div style={styles.actions}>
          <label style={styles.rangeLabel}>
            ช่วงข้อมูล
            <select
              value={range}
              onChange={(event) => setParams({ range: event.target.value })}
              style={styles.select}
              aria-label="เลือกช่วงข้อมูล analytics"
            >
              {RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={load} style={styles.ghostButton} disabled={loading}>
            {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </button>
        </div>
      </header>

      {error && <div role="alert" style={styles.alert}>โหลด analytics ไม่สำเร็จ: {error} <button type="button" onClick={load} style={styles.linkButton}>ลองอีกครั้ง</button></div>}

      <div className="ah-admin-grid-6" style={styles.statGrid}>
        <AdminStatCard label="Total Users" value={formatNumber(overview.total_users)} detail={`ผู้ใช้ใหม่ใน ${selectedRangeText}: ${formatNumber(overview.new_users)}`} tone="navy" />
        <AdminStatCard label="DAU" value={formatNumber(overview.dau)} detail="active users วันนี้" tone="blue" />
        <AdminStatCard label="WAU" value={formatNumber(overview.wau)} detail="active users ใน 7 วัน" tone="green" />
        <AdminStatCard label="MAU" value={formatNumber(overview.mau)} detail="active users ใน 30 วัน" tone="amber" />
        <AdminStatCard label="Active in range" value={formatNumber(overview.active_users)} detail={`อย่างน้อยหนึ่ง meaningful action / ${selectedRangeText}`} tone="pink" />
      </div>

      <section style={{ ...styles.card, marginTop: 16 }}>
        <div style={styles.cardHead}>
          <div>
            <h2 style={styles.cardTitle}>Feature Adoption</h2>
            <p style={styles.cardSub}>เรียงตามผู้ใช้ที่ลงมือทำจริง · ไม่รวม dashboard view และ login</p>
          </div>
        </div>
        <div className="ah-admin-table-wrap">
          <table className="ah-business-table" style={styles.table}>
            <thead><tr><th>Feature</th><th>Unique users</th><th>Total actions</th><th>Adoption</th><th>Actions / user</th></tr></thead>
            <tbody>
              {data.features.length ? data.features.map((item) => (
                <tr key={item.feature}>
                  <td><strong style={styles.featureName}>{featureLabel(item.feature)}</strong><small style={styles.machineName}>{item.feature}</small></td>
                  <td>{formatNumber(item.unique_users)}</td>
                  <td>{formatNumber(item.actions)}</td>
                  <td><span style={styles.adoption}>{formatPercent(item.adoption_rate)}</span></td>
                  <td>{Number(item.actions_per_user || 0).toFixed(1)}</td>
                </tr>
              )) : <tr><td colSpan="5" style={styles.emptyCell}>ยังไม่มี meaningful feature events ในช่วงนี้</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ah-admin-two-col" style={styles.contentGrid}>
        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Feature Usage Trend</h2>
              <p style={styles.cardSub}>จำนวน action ต่อช่วงเวลา · {data.trend?.granularity === 'week' ? 'รายสัปดาห์' : 'รายวัน'}</p>
            </div>
            <select value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)} style={styles.featureSelect} aria-label="เลือก feature สำหรับแนวโน้ม">
              {(featureOptions.length ? featureOptions : FEATURE_OPTIONS).map((feature) => <option key={feature} value={feature}>{featureLabel(feature)}</option>)}
            </select>
          </div>
          <TrendChart
            title={`${featureLabel(selectedFeature)} usage trend`}
            labels={trendLabels}
            valueLabel="actions"
            series={[{ key: 'actions', label: 'Total actions', color: CHART_COLORS.blue, values: trendValues }]}
          />
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Integration Adoption</h2>
              <p style={styles.cardSub}>บัญชีเชื่อมต่อเป็น snapshot ปัจจุบัน · sync ใช้ช่วง {selectedRangeText}</p>
            </div>
          </div>
          <div className="ah-business-integration-grid" style={styles.integrationGrid}>
            <IntegrationMetric label="Google connected" value={integrations.google_connected_users} tone="blue" />
            <IntegrationMetric label="Microsoft connected" value={integrations.microsoft_connected_users} tone="orange" />
            <IntegrationMetric label="Classroom active sync users" value={integrations.google_classroom_sync_users} tone="aqua" />
            <IntegrationMetric label="Sync success rate" value={formatPercent(integrations.sync_success_rate)} tone="green" />
          </div>
          <div style={styles.syncMeta}>
            <span>Attempts <strong>{formatNumber(integrations.classroom_sync_attempts)}</strong></span>
            <span>Success <strong>{formatNumber(integrations.classroom_sync_successes)}</strong></span>
            <span>Failed <strong>{formatNumber(integrations.classroom_sync_failures)}</strong></span>
          </div>
        </section>
      </div>

      <section style={{ ...styles.card, marginTop: 16 }}>
        <div style={styles.cardHead}>
          <div>
            <h2 style={styles.cardTitle}>Assignment Source Mix</h2>
            <p style={styles.cardSub}>inventory ปัจจุบันจาก assignment records · ไม่มี timestamp จึงไม่แกล้งทำเป็น trend</p>
          </div>
        </div>
        {data.sources.length ? <div style={styles.sourceList}>{data.sources.map((source, index) => {
          const count = Number(source.assignments || 0);
          return <div key={source.source || index} style={styles.sourceRow}><div style={styles.sourceTop}><span>{source.source}</span><strong>{formatNumber(count)} งาน · {formatNumber(source.unique_users)} users</strong></div><div style={styles.track}><div style={{ ...styles.fill, width: `${Math.max(3, (count / sourceMax) * 100)}%`, background: [CHART_COLORS.blue, CHART_COLORS.orange, CHART_COLORS.aqua][index % 3] }} /></div></div>;
        })}</div> : <div style={styles.empty}>ยังไม่มี assignment source data</div>}
      </section>
    </div>
  );
}

function IntegrationMetric({ label, value, tone }) {
  return <div style={styles.integrationMetric}><span style={{ ...styles.integrationDot, background: CHART_COLORS[tone] || CHART_COLORS.blue }} /><span style={styles.integrationLabel}>{label}</span><strong style={styles.integrationValue}>{typeof value === 'string' ? value : formatNumber(value)}</strong></div>;
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  kicker: { color: C.pinkDark, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' },
  title: { color: C.ink, fontFamily: FONT, fontSize: 25, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: '3px 0 0' },
  subtitle: { color: C.muted, fontFamily: FONT, fontSize: 13, margin: '4px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  rangeLabel: { display: 'flex', alignItems: 'center', gap: 7, color: C.muted, fontFamily: FONT, fontSize: 12 },
  select: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 12.5, padding: '8px 10px' },
  ghostButton: { border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 13px' },
  alert: { background: C.pinkBg, border: `1px solid ${C.pinkSoft}`, borderRadius: R.card, color: C.pinkDark, fontFamily: FONT, fontSize: 13, lineHeight: 1.5, marginBottom: 14, padding: '10px 13px' },
  linkButton: { border: 0, background: 'transparent', color: C.navy, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, padding: 0 },
  statGrid: { marginBottom: 16 },
  card: { minWidth: 0, borderRadius: R.card, background: C.card, padding: 20 },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 15 },
  cardTitle: { color: C.ink, fontFamily: FONT, fontSize: 14.5, fontWeight: 700, margin: 0 },
  cardSub: { color: C.muted, fontFamily: FONT, fontSize: 11.5, margin: '3px 0 0' },
  contentGrid: { marginTop: 16 },
  table: { width: '100%', borderCollapse: 'collapse', color: C.body, fontFamily: FONT, fontSize: 12.5, textAlign: 'left' },
  featureName: { color: C.ink, display: 'block', fontWeight: 700 },
  machineName: { color: C.mutedSoft, display: 'block', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5, marginTop: 2 },
  adoption: { background: C.blueBg, borderRadius: R.pill, color: C.navy, display: 'inline-block', fontWeight: 700, padding: '4px 8px' },
  emptyCell: { color: C.muted, padding: '28px 8px', textAlign: 'center' },
  featureSelect: { maxWidth: 210, border: `1px solid ${C.lineInput}`, borderRadius: R.pill, background: C.card, color: C.ink, fontFamily: FONT, fontSize: 12, padding: '7px 9px' },
  integrationGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 },
  integrationMetric: { display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 8, border: `1px solid ${C.line}`, borderRadius: 7, padding: '10px 11px' },
  integrationDot: { width: 8, height: 8, borderRadius: '50%', gridRow: 'span 2' },
  integrationLabel: { color: C.muted, fontFamily: FONT, fontSize: 10.5, lineHeight: 1.25 },
  integrationValue: { color: C.ink, fontFamily: FONT, fontSize: 18, lineHeight: 1.2, marginTop: 3 },
  syncMeta: { display: 'flex', flexWrap: 'wrap', gap: 14, color: C.muted, fontFamily: FONT, fontSize: 11.5, marginTop: 15 },
  sourceList: { display: 'flex', flexDirection: 'column', gap: 14 },
  sourceRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  sourceTop: { display: 'flex', justifyContent: 'space-between', gap: 12, color: C.body, fontFamily: FONT, fontSize: 12.5 },
  track: { height: 7, overflow: 'hidden', borderRadius: 99, background: C.lineSoft },
  fill: { height: '100%', borderRadius: 99 },
  empty: { display: 'grid', minHeight: 96, placeItems: 'center', color: C.muted, fontFamily: FONT, fontSize: 12.5 },
};

export default AdminBusinessPage;
