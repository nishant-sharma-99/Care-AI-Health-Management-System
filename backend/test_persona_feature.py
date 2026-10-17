import os
import sys

# Ensure backend folder is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app, init_db
from app.core.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.patient import Patient, Doctor, Appointment
from app.models.persona import PersonaAssessment
from app.models.billing import AuditLog
from app.core.security import hash_password, create_access_token
from app.routers.persona import evaluate_persona_priority
from datetime import date

def test_priority_engine():
    print("\n--- Testing Priority Engine ---")
    
    # 1. EMERGENCY test
    p, r = evaluate_persona_priority(symptoms="Chest pain and breathlessness", spo2=88.0, heart_rate=140)
    assert p == "EMERGENCY", f"Expected EMERGENCY, got {p}"
    print(f"[OK] EMERGENCY priority test passed: {r[:60]}...")

    # 2. HIGH test
    p2, r2 = evaluate_persona_priority(symptoms="High fever and severe abdominal pain", temperature=101.5, severity="severe")
    assert p2 == "HIGH", f"Expected HIGH, got {p2}"
    print(f"[OK] HIGH priority test passed: {r2[:60]}...")

    # 3. NORMAL test
    p3, r3 = evaluate_persona_priority(symptoms="Mild cold and runny nose", temperature=98.6, heart_rate=72, spo2=99.0)
    assert p3 == "NORMAL", f"Expected NORMAL, got {p3}"
    print(f"[OK] NORMAL priority test passed: {r3[:60]}...")

def test_persona_api():
    print("\n--- Testing Persona APIs & RBAC ---")
    init_db()
    db = SessionLocal()
    client = TestClient(app)

    # 1. Setup seed users & patient
    # Admin
    admin_user = db.query(User).filter(User.username == "test_admin").first()
    if not admin_user:
        admin_user = User(username="test_admin", email="admin@test.com", hashed_password=hash_password("admin123"), role="admin")
        db.add(admin_user)

    # Persona / Junior Doctor
    persona_user = db.query(User).filter(User.username == "test_persona").first()
    if not persona_user:
        persona_user = User(username="test_persona", email="persona@test.com", hashed_password=hash_password("persona123"), role="persona")
        db.add(persona_user)

    # Attending Doctor
    doctor_user = db.query(User).filter(User.username == "test_doctor").first()
    if not doctor_user:
        doctor_user = User(username="test_doctor", email="doctor@test.com", hashed_password=hash_password("doc123"), role="doctor")
        db.add(doctor_user)

    # Pharmacist
    pharm_user = db.query(User).filter(User.username == "test_pharm").first()
    if not pharm_user:
        pharm_user = User(username="test_pharm", email="pharm@test.com", hashed_password=hash_password("pharm123"), role="pharmacist")
        db.add(pharm_user)

    # Receptionist
    rec_user = db.query(User).filter(User.username == "test_rec").first()
    if not rec_user:
        rec_user = User(username="test_rec", email="rec@test.com", hashed_password=hash_password("rec123"), role="receptionist")
        db.add(rec_user)

    # Patient user & profile
    patient_user = db.query(User).filter(User.username == "test_patient_user").first()
    if not patient_user:
        patient_user = User(username="test_patient_user", email="patient@test.com", hashed_password=hash_password("patient123"), role="patient")
        db.add(patient_user)
    
    db.commit()

    # Patient profiles
    p1 = db.query(Patient).filter(Patient.name == "Normal Patient").first()
    if not p1:
        p1 = Patient(name="Normal Patient", age=30, gender="Male", contact="11111", hospital_id="MED900001", user_id=patient_user.id)
        db.add(p1)

    p2 = db.query(Patient).filter(Patient.name == "High Priority Patient").first()
    if not p2:
        p2 = Patient(name="High Priority Patient", age=45, gender="Female", contact="22222", hospital_id="MED900002")
        db.add(p2)

    p3 = db.query(Patient).filter(Patient.name == "Emergency Patient").first()
    if not p3:
        p3 = Patient(name="Emergency Patient", age=60, gender="Male", contact="33333", hospital_id="MED900003")
        db.add(p3)

    db.commit()
    db.refresh(p1); db.refresh(p2); db.refresh(p3)

    # Doctor profile
    doc_prof = db.query(Doctor).filter(Doctor.user_id == doctor_user.id).first()
    if not doc_prof:
        doc_prof = Doctor(user_id=doctor_user.id, name="Dr. Smith", specialization="General Medicine", contact="99999")
        db.add(doc_prof)
        db.commit()

    # Tokens
    persona_token = create_access_token({"sub": str(persona_user.id), "role": persona_user.role})
    doctor_token = create_access_token({"sub": str(doctor_user.id), "role": doctor_user.role})
    patient_token = create_access_token({"sub": str(patient_user.id), "role": patient_user.role})
    pharm_token = create_access_token({"sub": str(pharm_user.id), "role": pharm_user.role})
    rec_token = create_access_token({"sub": str(rec_user.id), "role": rec_user.role})

    # --- 2. Create Persona Assessments ---
    print("\n--- Testing Assessment Creation ---")
    headers_persona = {"Authorization": f"Bearer {persona_token}"}

    # Normal assessment
    resp1 = client.post("/persona/assessments", json={
        "patient_id": p1.id,
        "symptoms": "Mild runny nose and routine health checkup",
        "temperature": 98.6,
        "blood_pressure": "120/80",
        "heart_rate": 70,
        "spo2": 99.0
    }, headers=headers_persona)
    assert resp1.status_code == 200, f"Error: {resp1.json()}"
    ass1 = resp1.json()
    assert ass1["priority"] == "NORMAL"
    print(f"[OK] Normal assessment created (Priority: {ass1['priority']})")

    # High assessment
    resp2 = client.post("/persona/assessments", json={
        "patient_id": p2.id,
        "symptoms": "High fever, persistent vomiting, severe headache",
        "temperature": 101.8,
        "blood_pressure": "145/92",
        "heart_rate": 110,
        "spo2": 93.0,
        "severity": "severe"
    }, headers=headers_persona)
    assert resp2.status_code == 200, f"Error: {resp2.json()}"
    ass2 = resp2.json()
    assert ass2["priority"] == "HIGH"
    print(f"[OK] High assessment created (Priority: {ass2['priority']})")

    # Emergency assessment
    resp3 = client.post("/persona/assessments", json={
        "patient_id": p3.id,
        "symptoms": "Chest pain, acute breathlessness, sweating",
        "temperature": 99.0,
        "blood_pressure": "185/110",
        "heart_rate": 135,
        "spo2": 87.0
    }, headers=headers_persona)
    assert resp3.status_code == 200, f"Error: {resp3.json()}"
    ass3 = resp3.json()
    assert ass3["priority"] == "EMERGENCY"
    print(f"[OK] Emergency assessment created (Priority: {ass3['priority']})")

    # --- 3. Verify Smart Priority Queue ---
    print("\n--- Testing Smart Priority Queue ---")
    headers_doctor = {"Authorization": f"Bearer {doctor_token}"}
    q_resp = client.get("/persona/queue", headers=headers_doctor)
    assert q_resp.status_code == 200
    queue = q_resp.json()

    # Find position of our 3 test patients
    p3_item = next(i for i in queue if i["patient_id"] == p3.id)
    p2_item = next(i for i in queue if i["patient_id"] == p2.id)
    p1_item = next(i for i in queue if i["patient_id"] == p1.id)

    assert p3_item["position"] < p2_item["position"], "Emergency patient must be prioritized ahead of High patient"
    assert p2_item["position"] < p1_item["position"], "High priority patient must be prioritized ahead of Normal patient"
    print(f"[OK] Queue ordering verified: #{p3_item['position']} Emergency ({p3_item['patient_name']}) -> #{p2_item['position']} High ({p2_item['patient_name']}) -> #{p1_item['position']} Normal ({p1_item['patient_name']})")

    # --- 4. Testing Doctor Review & EHR Append ---
    print("\n--- Testing Doctor Review & EHR Integration ---")
    rev_resp = client.post(f"/persona/assessments/{ass3['id']}/doctor-review", json={
        "doctor_review_status": "APPROVED",
        "doctor_notes": "Immediate ECG performed. Patient transferred to CCU.",
        "append_to_ehr": True
    }, headers=headers_doctor)
    assert rev_resp.status_code == 200, f"Error: {rev_resp.json()}"
    rev_data = rev_resp.json()
    assert rev_data["doctor_review_status"] == "APPROVED"
    print("[OK] Doctor review recorded successfully")

    # Verify EHR record appended
    ehr_resp = client.get(f"/patients/{p3.id}/ehr", headers=headers_doctor)
    assert ehr_resp.status_code == 200
    ehr_records = ehr_resp.json()["records"]
    assert len(ehr_records) > 0
    assert "Persona Initial Assessment Review" in ehr_records[0]["title"]
    print("[OK] Triage assessment automatically appended to central EHR clinical record")

    # --- 5. Testing RBAC Restrictions ---
    print("\n--- Testing RBAC Restrictions ---")
    headers_pharm = {"Authorization": f"Bearer {pharm_token}"}
    pharm_resp = client.get(f"/persona/patient/{p3.id}", headers=headers_pharm)
    assert pharm_resp.status_code == 403, f"Pharmacist should get 403, got {pharm_resp.status_code}"
    print("[OK] Pharmacist RBAC check passed (403 Forbidden for clinical initial assessment)")

    headers_patient = {"Authorization": f"Bearer {patient_token}"}
    pat_self_resp = client.get(f"/persona/patient/{p1.id}", headers=headers_patient)
    assert pat_self_resp.status_code == 200
    print("[OK] Patient self-view check passed")

    pat_other_resp = client.get(f"/persona/patient/{p3.id}", headers=headers_patient)
    assert pat_other_resp.status_code == 403
    print("[OK] Patient restricted from viewing other patients' assessments (403 Forbidden)")

    # --- 6. Audit Log Verification ---
    print("\n--- Testing Audit Logs ---")
    logs = db.query(AuditLog).filter(AuditLog.action.like("PERSONA_%")).all()
    assert len(logs) >= 3, "Expected audit logs for PERSONA actions"
    print(f"[OK] Verified {len(logs)} audit log entries for Persona actions:")
    for l in logs[-3:]:
        print(f"  - [{l.action}] {l.detail}")

    db.close()
    print("\nPASSED ALL PERSONA TESTS SUCCESSFULLY!")

if __name__ == "__main__":
    test_priority_engine()
    test_persona_api()
