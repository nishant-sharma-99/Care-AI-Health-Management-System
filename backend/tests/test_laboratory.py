import os
import sys

# Ensure backend folder is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app, init_db
from app.core.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.patient import Patient, Doctor
from app.models.lab import LabTestOrder, LabReport, LabResultParameter
from app.models.ehr import EHR, ClinicalRecord
from app.models.billing import AuditLog
from app.core.security import hash_password, create_access_token

def run_laboratory_tests():
    print("\n==================================================")
    print("RUNNING LABORATORY MANAGEMENT & LAB REPORTS TEST SUITE")
    print("==================================================")

    init_db()
    db = SessionLocal()
    client = TestClient(app)

    # 1. Setup seed users
    print("\n[STEP 1] Setting up seed users & patients...")

    def get_or_create_user(username, email, role, password="password123"):
        u = db.query(User).filter(User.username == username).first()
        if not u:
            u = User(username=username, email=email, hashed_password=hash_password(password), role=role)
            db.add(u)
            db.commit()
            db.refresh(u)
        return u

    admin_user = get_or_create_user("lab_test_admin", "admin_lab@test.com", "admin")
    doctor_user = get_or_create_user("lab_test_doctor", "doctor_lab@test.com", "doctor")
    tech_user = get_or_create_user("lab_test_tech", "tech_lab@test.com", "lab_technician")
    nurse_user = get_or_create_user("lab_test_nurse", "nurse_lab@test.com", "nurse")
    pharm_user = get_or_create_user("lab_test_pharm", "pharm_lab@test.com", "pharmacist")
    rec_user = get_or_create_user("lab_test_rec", "rec_lab@test.com", "receptionist")
    patient_user1 = get_or_create_user("lab_test_pat1", "pat1_lab@test.com", "patient")
    patient_user2 = get_or_create_user("lab_test_pat2", "pat2_lab@test.com", "patient")

    # Patients profiles
    p1 = db.query(Patient).filter(Patient.name == "Rahul Sharma").first()
    if not p1:
        p1 = Patient(name="Rahul Sharma", age=35, gender="Male", contact="9876543210", hospital_id="MED800001", user_id=patient_user1.id)
        db.add(p1)

    p2 = db.query(Patient).filter(Patient.name == "Priya Patel").first()
    if not p2:
        p2 = Patient(name="Priya Patel", age=28, gender="Female", contact="9876543211", hospital_id="MED800002", user_id=patient_user2.id)
        db.add(p2)

    db.commit()
    db.refresh(p1)
    db.refresh(p2)

    # Doctor profile
    doc_prof = db.query(Doctor).filter(Doctor.user_id == doctor_user.id).first()
    if not doc_prof:
        doc_prof = Doctor(user_id=doctor_user.id, name="Dr. Ankit Mehta", specialization="Pathology", contact="9998887776")
        db.add(doc_prof)
        db.commit()

    # JWT Tokens
    doctor_token = create_access_token({"sub": str(doctor_user.id), "role": doctor_user.role})
    tech_token = create_access_token({"sub": str(tech_user.id), "role": tech_user.role})
    pat1_token = create_access_token({"sub": str(patient_user1.id), "role": patient_user1.role})
    pat2_token = create_access_token({"sub": str(patient_user2.id), "role": patient_user2.role})
    pharm_token = create_access_token({"sub": str(pharm_user.id), "role": pharm_user.role})
    rec_token = create_access_token({"sub": str(rec_user.id), "role": rec_user.role})

    headers_doc = {"Authorization": f"Bearer {doctor_token}"}
    headers_tech = {"Authorization": f"Bearer {tech_token}"}
    headers_pat1 = {"Authorization": f"Bearer {pat1_token}"}
    headers_pat2 = {"Authorization": f"Bearer {pat2_token}"}
    headers_pharm = {"Authorization": f"Bearer {pharm_token}"}
    headers_rec = {"Authorization": f"Bearer {rec_token}"}

    print("  [OK] Seed users & tokens created successfully.")

    # 2. Doctor creates lab test orders (NORMAL and URGENT)
    print("\n[STEP 2] Doctor creating NORMAL and URGENT lab orders...")

    # Order 1: Normal priority CBC order for Rahul Sharma
    resp_order1 = client.post("/lab/orders", json={
        "patient_id": p1.id,
        "test_name": "Complete Blood Count (CBC)",
        "test_category": "Hematology",
        "clinical_notes": "Fever checkup",
        "priority": "NORMAL"
    }, headers=headers_doc)
    assert resp_order1.status_code == 200, f"Order creation failed: {resp_order1.json()}"
    order1_data = resp_order1.json()
    assert order1_data["sample_id"].startswith("LAB-SMP-")
    assert order1_data["status"] == "ORDERED"
    print(f"  [OK] Created Normal CBC Order #{order1_data['id']} (Sample ID: {order1_data['sample_id']}) for Rahul Sharma.")

    # Order 2: Urgent priority Dengue order for Priya Patel
    resp_order2 = client.post("/lab/orders", json={
        "patient_id": p2.id,
        "test_name": "Dengue Test",
        "test_category": "Serology",
        "clinical_notes": "Suspected acute Dengue fever with low platelets",
        "priority": "URGENT"
    }, headers=headers_doc)
    assert resp_order2.status_code == 200, f"Urgent order creation failed: {resp_order2.json()}"
    order2_data = resp_order2.json()
    assert order2_data["priority"] == "URGENT"
    print(f"  [OK] Created Urgent Dengue Order #{order2_data['id']} (Sample ID: {order2_data['sample_id']}) for Priya Patel.")

    # 3. Test Lab Queue Priority Sorting (URGENT first)
    print("\n[STEP 3] Testing Lab Queue priority ordering (URGENT top priority)...")
    q_resp = client.get("/lab/queue", headers=headers_tech)
    assert q_resp.status_code == 200
    queue = q_resp.json()
    assert len(queue) >= 2

    # Find items in queue
    q_item_urgent = next(i for i in queue if i["order_id"] == order2_data["id"])
    q_item_normal = next(i for i in queue if i["order_id"] == order1_data["id"])

    assert q_item_urgent["position"] < q_item_normal["position"], "URGENT order must rank ahead of NORMAL order in lab queue"
    print(f"  [OK] Queue verified: #{q_item_urgent['position']} URGENT ({q_item_urgent['test_name']}) ahead of #{q_item_normal['position']} NORMAL ({q_item_normal['test_name']}).")

    # 4. Lab Technician processing status updates
    print("\n[STEP 4] Lab Technician updating sample collection & processing status...")

    # Update Order 1: Sample Collected
    st_resp1 = client.put(f"/lab/orders/{order1_data['id']}/status", json={"status": "SAMPLE_COLLECTED"}, headers=headers_tech)
    assert st_resp1.status_code == 200
    assert st_resp1.json()["status"] == "SAMPLE_COLLECTED"
    print(f"  [OK] Order #{order1_data['id']} status updated to SAMPLE_COLLECTED.")

    # Update Order 1: Processing
    st_resp2 = client.put(f"/lab/orders/{order1_data['id']}/status", json={"status": "PROCESSING"}, headers=headers_tech)
    assert st_resp2.status_code == 200
    assert st_resp2.json()["status"] == "PROCESSING"
    print(f"  [OK] Order #{order1_data['id']} status updated to PROCESSING.")

    # 5. Technician enters structured parameters and submits for Doctor Verification
    print("\n[STEP 5] Technician entering CBC results and submitting for Doctor Verification...")
    cbc_params = [
        {"parameter_name": "Hemoglobin", "result_value": "13.5", "unit": "g/dL", "reference_range": "13.0-17.0", "flag": "NORMAL"},
        {"parameter_name": "WBC Count", "result_value": "12500", "unit": "cells/µL", "reference_range": "4000-11000", "flag": "HIGH"},
        {"parameter_name": "Platelet Count", "result_value": "250000", "unit": "cells/µL", "reference_range": "150000-450000", "flag": "NORMAL"}
    ]

    report_resp = client.post(f"/lab/orders/{order1_data['id']}/report", json={
        "result_summary": "Mild leucocytosis observed. Platelets normal.",
        "parameters": cbc_params,
        "report_status": "AWAITING_VERIFICATION"
    }, headers=headers_tech)

    assert report_resp.status_code == 200, f"Report submission failed: {report_resp.json()}"
    report_data = report_resp.json()
    assert report_data["report_status"] == "AWAITING_VERIFICATION"
    assert report_data["verification_status"] == "PENDING"
    print(f"  [OK] Lab Report #{report_data['id']} submitted with status AWAITING_VERIFICATION.")

    # 6. Verify report is NOT in patient EHR before doctor approval
    print("\n[STEP 6] Verifying report is NOT appended to EHR prior to Doctor Approval...")
    ehr_check_before = client.get(f"/patients/{p1.id}/ehr", headers=headers_doc)
    records_before = ehr_check_before.json().get("records", [])
    has_unapproved_lab = any(r["record_type"] == "lab_report" and order1_data["sample_id"] in r["title"] for r in records_before)
    assert not has_unapproved_lab, "Unapproved lab report must NOT exist in Central EHR yet"
    print("  [OK] Unverified lab report is absent from Central EHR.")

    # 7. Doctor Reviews and Approves/Verifies Report
    print("\n[STEP 7] Doctor reviewing, approving, and verifying lab report...")
    verify_resp = client.post(f"/lab/reports/{report_data['id']}/verify", json={
        "approved": True,
        "verification_notes": "Results reviewed. CBC indicates mild inflammatory response. Approved."
    }, headers=headers_doc)

    assert verify_resp.status_code == 200, f"Verification failed: {verify_resp.json()}"
    verified_data = verify_resp.json()
    assert verified_data["report_status"] == "VERIFIED"
    assert verified_data["verification_status"] == "VERIFIED"
    assert verified_data["verified_by_doctor_name"] is not None
    print(f"  [OK] Doctor approved report. Report Status: VERIFIED (FINAL).")

    # Verify order is auto-completed
    order_after = client.get(f"/lab/orders/{order1_data['id']}", headers=headers_doc).json()
    assert order_after["status"] == "COMPLETED"
    print(f"  [OK] Lab Order #{order1_data['id']} status auto-updated to COMPLETED.")

    # 8. Check Automatic EHR Append after Verification
    print("\n[STEP 8] Verifying automatic EHR record linkage post-verification...")
    ehr_check_after = client.get(f"/patients/{p1.id}/ehr", headers=headers_doc)
    records_after = ehr_check_after.json().get("records", [])
    lab_ehr_rec = next((r for r in records_after if r["record_type"] == "lab_report" and report_data["sample_id"] in r["details"]), None)
    assert lab_ehr_rec is not None, "Verified lab report must be linked as append-only ClinicalRecord in EHR"
    print(f"  [OK] Clinical Record linked to Central EHR: '{lab_ehr_rec['title']}'.")

    # 9. Test Critical Result Handling
    print("\n[STEP 9] Testing Critical Result Flagging...")
    critical_params = [
        {"parameter_name": "Platelet Count", "result_value": "18000", "unit": "cells/µL", "reference_range": "150000-450000", "flag": "CRITICAL"}
    ]
    report_crit_resp = client.post(f"/lab/orders/{order2_data['id']}/report", json={
        "result_summary": "Severe thrombocytopenia. Critical value!",
        "parameters": critical_params,
        "report_status": "AWAITING_VERIFICATION"
    }, headers=headers_tech)
    assert report_crit_resp.status_code == 200
    crit_data = report_crit_resp.json()
    assert crit_data["has_critical_result"] is True
    print(f"  [OK] Critical Result flag correctly set: has_critical_result = True.")

    # 10. Patient RBAC self-view vs other-view
    print("\n[STEP 10] Testing Patient RBAC authorization...")

    # Patient 1 views own verified report
    pat1_view = client.get(f"/lab/reports/{report_data['id']}", headers=headers_pat1)
    assert pat1_view.status_code == 200
    print("  [OK] Patient 1 can view their own verified lab report.")

    # Patient 2 tries to view Patient 1's report -> 403 Forbidden
    pat2_view_pat1 = client.get(f"/lab/reports/{report_data['id']}", headers=headers_pat2)
    assert pat2_view_pat1.status_code == 403
    print("  [OK] Patient 2 blocked with 403 Forbidden when accessing Patient 1's report.")

    # 11. Receptionist & Pharmacist RBAC checks
    print("\n[STEP 11] Testing Receptionist & Pharmacist RBAC restrictions...")

    # Pharmacist try to view report -> 403
    pharm_rep = client.get(f"/lab/reports/{report_data['id']}", headers=headers_pharm)
    assert pharm_rep.status_code == 403
    print("  [OK] Pharmacist blocked with 403 Forbidden from viewing lab report.")

    # Receptionist try to submit results -> 403
    rec_sub = client.post(f"/lab/orders/{order2_data['id']}/report", json={"result_summary": "hack", "parameters": []}, headers=headers_rec)
    assert rec_sub.status_code == 403
    print("  [OK] Receptionist blocked with 403 Forbidden from submitting lab results.")

    # 12. Audit Log Verification
    print("\n[STEP 12] Verifying Audit Log Entries...")
    logs = db.query(AuditLog).filter(AuditLog.action.like("LAB_%")).all()
    assert len(logs) >= 5, "Expected at least 5 audit log entries for LAB actions"
    print(f"  [OK] Verified {len(logs)} audit log entries for Laboratory operations:")
    for l in logs[-5:]:
        print(f"    - [{l.action}] {l.detail}")

    db.close()
    print("\n==================================================")
    print("PASSED ALL LABORATORY MANAGEMENT TESTS SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_laboratory_tests()
