<img src="assets/icon.svg" width="64" height="64" alt="DevDNS">

# DevDNS — Developer DNS Server

A minimal, offline-first DNS server designed specifically for local web development, microservices, container routing, and internal staging environments. It includes an embedded UDP DNS daemon, SQLite persistence, user authentication, role-based user management, domain & record controls, and real-time query logging.

---

## ⚡ Features

- **Embedded DNS Daemon**: RFC 1035 compliant UDP DNS engine running natively in Node.js (`dgram` + `dns-packet`).
- **Offline First**: Instant sub-millisecond local record resolution without an external connection.
- **Wildcard Subdomains**: Supports `*.local.dev`, `*.test`, or custom patterns pointing to `127.0.0.1` or LAN IPs.
- **Optional Upstream Relay**: Forward unknown domain lookups to upstream DNS (e.g. `1.1.1.1` or `8.8.8.8`) with a single toggle in settings.
- **Modern Web Dashboard**: Fast React + Vite + Tailwind CSS dashboard with dark mode developer aesthetics.
- **Authentication & RBAC**:
  - `Admin`: Full permissions (user management, domain & record editing, server settings).
  - `Developer`: Zone and record management, live logs.
  - `Viewer`: Read-only access to records and query metrics.
- **Live Query Streaming**: Server-Sent Events (SSE) streaming incoming DNS queries live to the browser with latency and status breakdown (`NOERROR`, `NXDOMAIN`, `FORWARDED`).
- **Single Process Execution**: Packages the HTTP server, SQLite database, static frontend assets, and UDP DNS daemon into a single `npm start` command.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Tests
```bash
pnpm test
```

### 3. Development Mode
Run both backend and Vite dev server concurrently with hot reload:
```bash
pnpm dev
```
- Dashboard: http://localhost:5173
- DNS Daemon: `udp://0.0.0.0:5353`

### 4. Production Build & Run
Build both frontend client and TypeScript backend:
```bash
pnpm build
pnpm start
```
- Dashboard & API: http://localhost:3000
- DNS Daemon: `udp://0.0.0.0:5353`

---

## 🔑 Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

*(You can create additional developer accounts or change the admin password in the **User Control** panel).*

---

## 🧪 Testing DNS Queries

To verify resolution using standard DNS tools:

```bash
# Query default domain
dig @127.0.0.1 -p 5353 local.dev

# Query wildcard subdomain
dig @127.0.0.1 -p 5353 test-api.local.dev

# Cross-platform with nslookup
nslookup -port=5353 local.dev 127.0.0.1
```

---

## ⚙️ Command Line Options

You can customize the ports via CLI flags or environment variables:

```bash
# Custom HTTP and DNS ports
pnpm start -- --port 8080 --dns-port 5353

# Or via environment variables
PORT=8080 DNS_PORT=5353 pnpm start
```

### Binding to Standard Port 53 (Rootless on Linux)
```bash
sudo setcap 'cap_net_bind_service=+ep' $(which node)
pnpm start -- --dns-port 53
```
