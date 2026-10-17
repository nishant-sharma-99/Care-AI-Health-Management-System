from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import stripe
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.config import STRIPE_SECRET_KEY
from app.models.billing import Invoice
from app.models.patient import Patient
from app.schemas.pharmacy import InvoiceCreate, InvoiceOut

stripe.api_key = STRIPE_SECRET_KEY
router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/invoices", response_model=InvoiceOut)
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db), _=Depends(require_role("admin", "receptionist"))):
    inv = Invoice(**data.model_dump())
    db.add(inv); db.commit(); db.refresh(inv)
    return inv

@router.get("/invoices", response_model=List[InvoiceOut])
def list_invoices(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        return db.query(Invoice).filter(Invoice.patient_id == patient.id).all()
    return db.query(Invoice).all()

@router.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(404, "Invoice not found")
    if inv.status == "paid": raise HTTPException(400, "Already paid")
    # patients can only pay their own invoices
    if current_user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or inv.patient_id != patient.id:
            raise HTTPException(403, "Not allowed")
    if STRIPE_SECRET_KEY and not STRIPE_SECRET_KEY.startswith("sk_test_your"):
        intent = stripe.PaymentIntent.create(
            amount=int(inv.amount * 100), currency="usd",
            metadata={"invoice_id": invoice_id}
        )
        inv.stripe_payment_intent = intent.id
    inv.status = "paid"
    db.commit()
    return {"message": "Payment processed", "invoice_id": invoice_id}
