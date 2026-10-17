from sqlalchemy.orm import Session
from app.models.billing import AuditLog
from datetime import datetime

def log_audit_event(db: Session, user_id: int, action: str, detail: str):
    """
    Logs an action to the existing AuditLog model in hms.db.
    """
    try:
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            detail=detail,
            timestamp=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Audit log error: {e}")
