export async function adminRequest(path, options) {
  const response = await fetch(path, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    // Some proxy and server failures do not return JSON.
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function listFrom(payload, keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return Array.isArray(payload) ? payload : [];
}

export function paginationFrom(payload, fallbackPage = 1, fallbackPageSize = 25) {
  const page = payload?.pagination || payload?.meta || {};
  const total = Number(page.total ?? payload?.total ?? 0);
  const pageSize = Number(page.pageSize ?? page.page_size ?? payload?.pageSize ?? fallbackPageSize);
  const currentPage = Number(page.page ?? page.currentPage ?? payload?.page ?? fallbackPage);

  return {
    page: currentPage,
    pageSize,
    total,
    totalPages: Math.max(1, Number(page.totalPages ?? page.total_pages ?? Math.ceil(total / pageSize) ?? 1)),
  };
}

export function formatDate(value, withTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function providerLabel(user) {
  const providers = [];
  if (user?.google_connected) providers.push('Google');
  if (user?.microsoft_connected) providers.push('Microsoft');
  return providers.length ? providers.join(' · ') : 'ยังไม่เชื่อมต่อ';
}
