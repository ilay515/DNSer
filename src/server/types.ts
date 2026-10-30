export type UserRole = 'admin' | 'developer' | 'viewer';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: string;
  username: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  record_count?: number;
}

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'PTR';

export interface DnsRecord {
  id: string;
  domain_id: string;
  name: string;
  type: DnsRecordType;
  value: string;
  ttl: number;
  priority?: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  domain_name?: string;
}

export interface QueryLogEntry {
  id?: number;
  timestamp: string;
  client_ip: string;
  query_name: string;
  query_type: string;
  status: 'NOERROR' | 'NXDOMAIN' | 'REFUSED' | 'FORWARDED' | 'ERROR';
  answer?: string;
  latency_ms: number;
}

export interface ServerSettings {
  upstream_enabled: boolean;
  upstream_server: string;
  dns_port: number;
  http_port: number;
  query_log_retention: number; // Max logs stored
}
