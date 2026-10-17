# Hospital Management System (HMS)

A full-stack Hospital Management System with **role-based access control**, built with **FastAPI**, **SQLite/PostgreSQL**, **React**, and **Tailwind CSS**.

## Features

- ✅ Role-based authentication (admin, doctor, nurse, pharmacist, receptionist, patient)
- ✅ Patient registration & management with user account linking
- ✅ Appointment scheduling — staff book for patients, patients self-book
- ✅ Doctor management (admin/receptionist can add doctors)
- ✅ Pharmacy inventory with prescription dispensing
- ✅ Billing & invoicing with Stripe payment integration
- ✅ Reports dashboard (summary, appointments, pharmacy stock)

## Role-Based Permissions

| Feature | Patient | Doctor | Nurse | Pharmacist | Receptionist | Admin |
|---------|---------|--------|-------|------------|--------------|-------|
| View own appointments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book own appointment | ✅ | — | — | — | — | — |
| Cancel own appointment | ✅ | — | — | — | — | — |
| Book appointment for others | — | ✅ | — | — | ✅ | ✅ |
| Manage appointment status | — | ✅ | — | — | ✅ | ✅ |
| View patients | — | ✅ | ✅ | — | ✅ | ✅ |
| Add/edit patients | — | ✅ | ✅ | — | ✅ | ✅ |
| Add doctors | — | — | — | — | ✅ | ✅ |
| View pharmacy | — | ✅ | — | ✅ | — | ✅ |
| Add/edit drugs | — | — | — | ✅ | — | ✅ |
| Create prescriptions | — | ✅ | — | — | — | ✅ |
| Dispense prescriptions | — | — | — | ✅ | — | ✅ |
| View own invoices | ✅ | — | — | — | — | — |
| Pay invoices | ✅ | — | — | — | ✅ | ✅ |
| Create invoices | — | — | — | — | ✅ | ✅ |
| View reports | — | ✅ | — | ✅ | ✅ | ✅ |
| Full dashboard stats | — | — | — | — | — | ✅ |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── core/        # config, database, security
│   │   ├── models/      # SQLAlchemy models
│   │   ├── routers/     # API endpoints (auth, patients, pharmacy, billing, reports)
│   │   ├── schemas/     # Pydantic schemas
│   │   └── main.py      # FastAPI app entry point
│   ├── requirements.txt
│   └── .env
├── frontend/
│   └── src/
│       ├── pages/       # Dashboard, Patients, Appointments, Pharmacy, Billing, Reports
│       ├── components/  # Layout
│       ├── context/     # AuthContext
│       └── api/         # Axios client
└── docker-compose.yml
```

## Prerequisites

- Python 3.8+
- Node.js 16+
- npm

## Local Development Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit if needed, default uses SQLite
uvicorn app.main:app --reload
```

Backend runs on **http://localhost:8000**
- Swagger API docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 2. Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:3000**

## Environment Variables

### backend/.env
```
DATABASE_URL=sqlite:///./hms.db
SECRET_KEY=your-secret-key-here
STRIPE_SECRET_KEY=sk_test_your_stripe_key
```

### frontend/.env
```
VITE_API_URL=http://localhost:8000
```

## Docker Deployment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your Stripe key if needed
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

## Testing the System

### Step 1 — Register users via the UI or curl

```bash
# Admin
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@hospital.com","password":"admin123","role":"admin"}'

# Receptionist
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"receptionist","email":"receptionist@hospital.com","password":"recep123","role":"receptionist"}'

# Doctor
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"doctor","email":"doctor@hospital.com","password":"doc123","role":"doctor"}'

# Pharmacist
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"pharmacist","email":"pharmacist@hospital.com","password":"pharm123","role":"pharmacist"}'

# Patient
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"patient1","email":"patient1@example.com","password":"patient123","role":"patient"}'
```

### Step 2 — Workflows by role

#### Admin / Receptionist
1. Login → go to **Appointments** → add a doctor (name, specialization, contact)
2. Go to **Patients** → add a patient, enter the patient's **User ID** in "Link to User Account" to enable self-booking
3. Book an appointment for a patient
4. Go to **Pharmacy** → add drugs to inventory
5. Go to **Billing** → create an invoice for a patient
6. View **Reports** and **Dashboard**

#### Patient
1. Login → **Dashboard** shows your appointments and invoices
2. Go to **Appointments** → book your own appointment (requires account to be linked to a patient profile by a receptionist/admin)
3. Cancel a scheduled appointment
4. Go to **Billing** → view and pay your invoices

#### Doctor
1. Login → view and manage appointments
2. Add/edit patient records
3. Create prescriptions in **Pharmacy**
4. View **Reports**

#### Pharmacist
1. Login → manage drug inventory in **Pharmacy**
2. Dispense pending prescriptions
3. View pharmacy stock reports

### Step 3 — Linking a patient account for self-booking

For a patient user to self-book appointments:

1. Register a user with role `patient` (note the user ID from the response)
2. Login as admin or receptionist
3. Go to **Patients** → Add Patient
4. Fill in the patient details and enter the **User ID** in the "Link to User Account" field
5. The patient can now login and book their own appointments

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Auth | JWT (python-jose), bcrypt |
| Database | SQLite (default) / PostgreSQL |
| Frontend | React, Vite, TanStack Query |
| Forms | React Hook Form |
| Styling | Tailwind CSS |
| Payments | Stripe |

## Common Issues & Solutions

**"Address already in use" when starting backend**
```bash
pkill -f "uvicorn app.main"
uvicorn app.main:app --reload
```

**Patient can't book appointments**
The patient user must be linked to a patient profile. Login as admin/receptionist → Patients → Edit patient → enter the User ID in "Link to User Account".

**No doctors available in appointment form**
Login as admin/receptionist → Appointments → use the "Add Doctor" form at the top of the page.

**CORS errors in browser**
Ensure `frontend/.env` contains `VITE_API_URL=http://localhost:8000` and restart the frontend dev server.
