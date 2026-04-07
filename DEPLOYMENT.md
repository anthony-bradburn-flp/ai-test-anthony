# Deployment Notes

## Servers

| Environment | EC2 IP | Branch |
|-------------|--------|--------|
| Staging | 172.31.78.137 | `staging` |
| Production | 172.31.81.197 | `main` |

Both environments share the **same RDS PostgreSQL instance**:
`pm-governance-flipside.cytqaksy2awb.us-east-1.rds.amazonaws.com`

This means `db:push` only needs to run once (on staging). By the time a merge reaches production, the schema is already up to date.

---

## Production Deploy Steps

```bash
cd /home/ubuntu/ai-test-anthony
git fetch origin
git pull origin main
npm install --include=dev
npm run build
pm2 restart pm-governance --update-env
pm2 logs --nostream --lines 20
```

> **Note:** `npm run build` requires ~2GB of memory. The production instance (t3.micro, 911MB RAM) needs a swap file — see below.

---

## One-Time Production Setup (already done)

### 1. Swap file
The Vite build exceeds the t3.micro's 911MB RAM. A 2GB swap file was added:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. RDS SSL
The production EC2 connects to RDS over SSL. Two things were needed:

**`server/db.ts`** — disable certificate verification (RDS uses a self-signed chain):
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
```

**`.env`** — `NODE_TLS_REJECT_UNAUTHORIZED=0` is set because pg's connection string
parser overrides the `ssl` config object. Without this, the SSL cert error persists
even with `rejectUnauthorized: false` in code:
```
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**`DATABASE_URL`** — do not include `sslmode=` in the connection string. pg's handling
of `sslmode=require` (and `sslmode=no-verify`) conflicts with the ssl config above:
```
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### 3. RDS Security Group
The production EC2 (`172.31.81.197`) must be allowed to connect to RDS on port 5432.
This was added to the RDS instance's VPC security group inbound rules.

---

## Running DB Migrations

Since staging and production share the same RDS instance, run migrations on staging only:

```bash
# On staging server only
cd /home/ubuntu/ai-test-anthony
export $(cat .env | xargs) && npx drizzle-kit push --force
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `no pg_hba.conf entry … no encryption` | Wrong EC2 added to security group, or invalid `sslmode` | Check RDS security group inbound rules; ensure no `sslmode=` in DATABASE_URL |
| `self-signed certificate in certificate chain` | Node.js rejecting RDS cert | Ensure `NODE_TLS_REJECT_UNAUTHORIZED=0` is in `.env` and `ssl: { rejectUnauthorized: false }` is in `db.ts` |
| Build hangs / OOM | t3.micro has only 911MB RAM | Ensure swap file is active: `sudo swapon /swapfile` |
| `dotenv: not found` | dotenv CLI not installed globally | Use `export $(cat .env | xargs) &&` prefix instead |
| `drizzle-kit push` hangs | Interactive prompt or slow schema pull | Use `--force` flag; if still hanging, tables likely already exist — skip it |
