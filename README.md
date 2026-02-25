# YAU CRM — Local Setup Guide

## Stack
| Layer       | Technology       |
|-------------|-----------------|
| Frontend    | React + TypeScript (Vite) |
| Backend     | Node.js + Express |
| Database    | SQLite (local file `yaucrm.db`) |
| Auth        | JWT (shared username/password) |

## Default Login Credentials
- **Username:** `admin`
- **Password:** `admin123`

---

## Install & Run

### 1. Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
# SQLite database is created automatically at /backend/yaucrm.db
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:8080
```

---

## Excel Import Format
Only `.xlsx` files are accepted (exported from Google Sheets).

| Column Name | Required |
|---|---|
| School Name | ✅ |
| School Type | |
| Grades | |
| Principal Name / POC Name | |
| Principal Email | |
| Telephone | |
| School Start Time | |
| School End Time | |
| Address | |
| City | |
| State | |
| Zip Code | |
| Website | |

**Matching Rules (for updates):**
1. School Name + Telephone
2. If Telephone missing → School Name + Address

> Notes and Follow-ups are **never** overwritten by imports.
