from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_role
from app.models.patient import Patient, Appointment
from app.models.pharmacy import Drug
from app.models.billing import Invoice

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    return {
        "total_patients": db.query(Patient).count(),
        "total_appointments": db.query(Appointment).count(),
        "total_drugs": db.query(Drug).count(),
        "total_revenue": db.query(Invoice).filter(Invoice.status == "paid").with_entities(
            __import__("sqlalchemy").func.sum(Invoice.amount)
        ).scalar() or 0,
        "pending_invoices": db.query(Invoice).filter(Invoice.status == "unpaid").count(),
    }

@router.get("/appointments")
def appointment_report(db: Session = Depends(get_db), _=Depends(require_role("admin", "doctor", "receptionist"))):
    return db.query(Appointment).all()

@router.get("/pharmacy-stock")
def pharmacy_stock(db: Session = Depends(get_db), _=Depends(require_role("admin", "pharmacist"))):
    return db.query(Drug).all()
