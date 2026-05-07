# YAU CRM — Local Setup Guide

## Stack
| Layer       | Technology       |
|-------------|-----------------|
| Frontend    | React + TypeScript (Vite) |
| Backend     | Node.js + Express |
| Database    | MongoDB |
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

| Column Name | Required | Description |
|---|---|---|
| **Name/Organization** | ✅ | Main name of the school or organization |
| Type | | e.g. Public, Private, Parent |
| Category/Group | | e.g. PK-5, Middle School, Partner |
| **Primary Contact Name** | | Full name of the primary POC |
| Primary Contact Title | | Role (e.g. Principal, Athletic Director) |
| Primary Contact Email | | Direct email address |
| Primary Contact Phone | | Direct phone number |
| Primary Best Time | | Best time to call (e.g. Morning, 11am-1pm) |
| Primary Preferred Method| | Call, Email, or Text |
| **Secondary Contact Name**| | Full name of the secondary POC |
| Secondary Contact Title | | Role |
| Secondary Contact Email | | Direct email address |
| Secondary Contact Phone | | Direct phone number |
| Secondary Best Time | | Best time to call |
| Secondary Preferred Method| | Call, Email, or Text |
| Telephone | | Main organization phone number |
| Start Time | | Opening time (e.g. 7:30 AM) |
| End Time | | Closing time (e.g. 3:30 PM) |
| Address | | Street address |
| City | | |
| State | | |
| Zip Code | | |
| Website | | Organization website URL |
| Notes | | Initial notes to add to the lead |

> **Note:** The system uses an "Upsert" logic. If a lead with the same name already exists in the campaign, it will be **updated** with the new information instead of being skipped.

**Matching Rules (for updates):**
1. School Name + Telephone
2. If Telephone missing → School Name + Address

> Notes and Follow-ups are **never** overwritten by imports.
