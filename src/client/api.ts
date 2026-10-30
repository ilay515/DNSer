import type { UserPublic, Domain, DnsRecord, QueryLogEntry, ServerSettings, ServerStats } from './types.js';

const TOKEN_KEY = 'dnser_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data.error) errorMsg = data.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (username: string, password: string): Promise<{ token: string; user: UserPublic }> => {
    const res = await request<{ token: string; user: UserPublic }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    authStorage.setToken(res.token);
    return res;
  },

  getMe: async (): Promise<UserPublic> => {
    return request<UserPublic>('/api/auth/me');
  },

  logout: async (): Promise<void> => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      authStorage.clearToken();
    }
  },

  // Stats & System
  getStats: async (): Promise<ServerStats> => {
    return request<ServerStats>('/api/stats');
  },

  getSettings: async (): Promise<ServerSettings> => {
    return request<ServerSettings>('/api/settings');
  },

  updateSettings: async (settings: Partial<ServerSettings>): Promise<ServerSettings> => {
    return request<ServerSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // Domains
  getDomains: async (): Promise<Domain[]> => {
    return request<Domain[]>('/api/domains');
  },

  createDomain: async (name: string, description?: string): Promise<Domain> => {
    return request<Domain>('/api/domains', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  updateDomain: async (id: string, name: string, description?: string): Promise<Domain> => {
    return request<Domain>(`/api/domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    });
  },

  deleteDomain: async (id: string): Promise<void> => {
    await request(`/api/domains/${id}`, { method: 'DELETE' });
  },

  // Records
  getRecords: async (domainId?: string): Promise<DnsRecord[]> => {
    const url = domainId ? `/api/records?domain_id=${encodeURIComponent(domainId)}` : '/api/records';
    return request<DnsRecord[]>(url);
  },

  createRecord: async (record: {
    domain_id: string;
    name: string;
    type: string;
    value: string;
    ttl?: number;
    priority?: number;
  }): Promise<DnsRecord> => {
    return request<DnsRecord>('/api/records', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  updateRecord: async (id: string, updates: Partial<DnsRecord>): Promise<DnsRecord> => {
    return request<DnsRecord>(`/api/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteRecord: async (id: string): Promise<void> => {
    await request(`/api/records/${id}`, { method: 'DELETE' });
  },

  // Users
  getUsers: async (): Promise<UserPublic[]> => {
    return request<UserPublic[]>('/api/users');
  },

  createUser: async (user: { username: string; password: string; role: string }): Promise<UserPublic> => {
    return request<UserPublic>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  updateUser: async (id: string, updates: { role?: string; is_active?: number; password?: string }): Promise<UserPublic> => {
    return request<UserPublic>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteUser: async (id: string): Promise<void> => {
    await request(`/api/users/${id}`, { method: 'DELETE' });
  },

  // Logs
  getLogs: async (params: { limit?: number; offset?: number; query?: string; status?: string; type?: string }): Promise<{ logs: QueryLogEntry[]; total: number }> => {
    const search = new URLSearchParams();
    if (params.limit) search.set('limit', String(params.limit));
    if (params.offset) search.set('offset', String(params.offset));
    if (params.query) search.set('query', params.query);
    if (params.status) search.set('status', params.status);
    if (params.type) search.set('type', params.type);
    return request<{ logs: QueryLogEntry[]; total: number }>(`/api/logs?${search.toString()}`);
  },

  clearLogs: async (): Promise<void> => {
    await request('/api/logs', { method: 'DELETE' });
  },
};
