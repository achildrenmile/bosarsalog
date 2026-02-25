export async function getOrCreateOperator(callsign: string, existing: any, extras?: { name?: string; qth?: string }): Promise<any> {
  if (existing) return existing;
  if (!callsign || callsign.length < 3) return null;
  try {
    return await apiFetch('/api/v1/operators', {
      method: 'POST',
      body: JSON.stringify({ callsign: callsign.toUpperCase(), name: extras?.name || null, qth: extras?.qth || null }),
    });
  } catch (err: any) {
    if (err.message?.includes('existiert')) {
      const results = await apiFetch(`/api/v1/operators?q=${encodeURIComponent(callsign)}`);
      return results.find((o: any) => o.callsign === callsign.toUpperCase()) || results[0] || null;
    }
    return null;
  }
}

export async function apiFetch(url: string, options?: RequestInit) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Fehler' }));
    const error: any = new Error(err.error || `HTTP ${res.status}`);
    error.data = err;
    throw error;
  }
  return res.json();
}
