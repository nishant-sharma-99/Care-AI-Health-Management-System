from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.pharmacy import Drug, Prescription
from app.schemas.pharmacy import DrugCreate, DrugOut, PrescriptionCreate, PrescriptionOut

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])

@router.post("/drugs", response_model=DrugOut)
def add_drug(data: DrugCreate, db: Session = Depends(get_db), _=Depends(require_role("admin", "pharmacist"))):
    d = Drug(**data.model_dump())
    db.add(d); db.commit(); db.refresh(d)
    return d

@router.get("/drugs", response_model=List[DrugOut])
def list_drugs(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Drug).all()

@router.put("/drugs/{drug_id}", response_model=DrugOut)
def update_drug(drug_id: int, data: DrugCreate, db: Session = Depends(get_db), _=Depends(require_role("admin", "pharmacist"))):
    d = db.query(Drug).filter(Drug.id == drug_id).first()
    if not d: raise HTTPException(404, "Drug not found")
    for k, v in data.model_dump().items(): setattr(d, k, v)
    db.commit(); db.refresh(d)
    return d

@router.post("/prescriptions", response_model=PrescriptionOut)
def create_prescription(data: PrescriptionCreate, db: Session = Depends(get_db), _=Depends(require_role("admin", "doctor"))):
    p = Prescription(**data.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.get("/prescriptions", response_model=List[PrescriptionOut])
def list_prescriptions(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Prescription).all()

@router.put("/prescriptions/{rx_id}/dispense")
def dispense(rx_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin", "pharmacist"))):
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx: raise HTTPException(404, "Prescription not found")
    drug = db.query(Drug).filter(Drug.id == rx.drug_id).first()
    if not drug or drug.quantity < 1:
        raise HTTPException(400, "Insufficient stock")
    drug.quantity -= 1
    rx.dispensed = 1
    db.commit()
    return {"message": "Dispensed successfully"}
