import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.core.database import Base, engine, SessionLocal
from app.routers import auth, patients, pharmacy, billing, reports, ehr, persona, lab
from app.models import user, patient, pharmacy as pharmacy_model, billing as billing_model, ehr as ehr_model, persona as persona_model, lab as lab_model  # noqa

# Safe migration check for existing databases
def init_db():
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            inspector = inspect(engine)
            if "patients" in inspector.get_table_names():
                columns = [c["name"] for c in inspector.get_columns("patients")]
                if "hospital_id" not in columns:
                    conn.execute(text("ALTER TABLE patients ADD COLUMN hospital_id VARCHAR"))
                    conn.commit()
                if "qr_code" not in columns:
                    conn.execute(text("ALTER TABLE patients ADD COLUMN qr_code TEXT"))
                    conn.commit()
                try:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_hospital_id ON patients (hospital_id)"))
                    conn.commit()
                except Exception:
                    pass
    except Exception as e:
        print(f"Migration check: {e}")

    # Backfill legacy patient records if any
    try:
        db = SessionLocal()
        from app.models.patient import Patient as PatientModel
        from app.routers.patients import ensure_patient_identity
        legacy_patients = db.query(PatientModel).filter(
            (PatientModel.hospital_id.is_(None)) | (PatientModel.qr_code.is_(None))
        ).all()
        for lp in legacy_patients:
            ensure_patient_identity(lp, db)
        db.close()
    except Exception as e:
        print(f"Backfill check: {e}")

init_db()

app = FastAPI(title="Hospital Management System", version="1.0.0")

raw = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in raw.split(",")] if raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(pharmacy.router)
app.include_router(billing.router)
app.include_router(reports.router)
app.include_router(ehr.router)
app.include_router(persona.router)
app.include_router(lab.router)

@app.get("/")
def root():
    return {"message": "HMS API is running"}
