import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function EHR() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const isPatientRole = user?.role === 'patient'
  const isPharmacist = user?.role === 'pharmacist'
  const canEdit = ['admin', 'doctor', 'nurse'].includes(user?.role)

  const [activePatientId, setActivePatientId] = useState(patientId ? Number(patientId) : null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  // Clinical record form state
  const [recordType, setRecordType] = useState('consultation')
  const [recordTitle, setRecordTitle] = useState('')
  const [recordDetails, setRecordDetails] = useState('')
  const [vitals, setVitals] = useState({
    bp: '',
    hr: '',
    temp: '',
    spo2: '',
    weight: ''
  })

  // Profile edit form state
  const [profileForm, setProfileForm] = useState({
    medical_history: '',
    allergies: '',
    chronic_conditions: '',
    current_medications: '',
    blood_group: ''
  })

  // Fetch list of patients for staff search dropdown
  const { data: patientsList = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => api.get('/patients').then(r => r.data),
    enabled: !isPatientRole,
    retry: false
  })

  // For patient role, get own profile first
  const { data: myPatientProfile } = useQuery({
    queryKey: ['my-patient-profile'],
    queryFn: () => api.get('/patients/me').then(r => r.data),
    enabled: isPatientRole,
    retry: false
  })

  useEffect(() => {
    if (isPatientRole && myPatientProfile?.id) {
      setActivePatientId(myPatientProfile.id)
    } else if (!patientId && patientsList.length > 0 && !activePatientId) {
      setActivePatientId(patientsList[0].id)
    } else if (patientId) {
      setActivePatientId(Number(patientId))
    }
  }, [patientId, isPatientRole, myPatientProfile, patientsList])

  // Fetch EHR data for active patient
  const { data: ehrData, isLoading, isError, error } = useQuery({
    queryKey: ['patient-ehr', activePatientId],
    queryFn: () => api.get(`/patients/${activePatientId}/ehr`).then(r => r.data),
    enabled: !!activePatientId,
    retry: false
  })

  // Fetch basic patient info for identity header
  const { data: currentPatientInfo } = useQuery({
    queryKey: ['patient-info', activePatientId],
    queryFn: () => api.get(`/patients/${activePatientId}`).then(r => r.data),
    enabled: !!activePatientId,
    retry: false
  })

  const [selectedLabReportModal, setSelectedLabReportModal] = useState(null)

  // Fetch Lab Reports for active patient
  const { data: patientLabReports = [] } = useQuery({
    queryKey: ['patient-lab-reports', activePatientId],
    queryFn: () => api.get(`/lab/reports/patient/${activePatientId}`).then(r => r.data),
    enabled: !!activePatientId && !isPharmacist,
    retry: false
  })

  useEffect(() => {
    if (ehrData && !isPharmacist) {
      setProfileForm({
        medical_history: ehrData.medical_history || '',
        allergies: ehrData.allergies || '',
        chronic_conditions: ehrData.chronic_conditions || '',
        current_medications: ehrData.current_medications || '',
        blood_group: ehrData.blood_group || ''
      })
    }
  }, [ehrData, isPharmacist])

  // Mutation to update EHR background info
  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.put(`/patients/${activePatientId}/ehr`, data),
    onSuccess: () => {
      qc.invalidateQueries(['patient-ehr', activePatientId])
      setShowEditProfile(false)
    },
    onError: (err) => alert(err.response?.data?.detail || 'Failed to update EHR profile')
  })

  // Mutation to append a new clinical record
  const addRecordMutation = useMutation({
    mutationFn: (data) => api.post(`/patients/${activePatientId}/ehr/records`, data),
    onSuccess: () => {
      qc.invalidateQueries(['patient-ehr', activePatientId])
      setRecordTitle('')
      setRecordDetails('')
      setVitals({ bp: '', hr: '', temp: '', spo2: '', weight: '' })
    },
    onError: (err) => alert(err.response?.data?.detail || 'Failed to add clinical record')
  })

  const handleAddRecordSubmit = (e) => {
    e.preventDefault()
    if (!recordDetails.trim()) {
      alert('Please enter clinical details/notes.')
      return
    }
    const hasVitals = Object.values(vitals).some(v => v.trim() !== '')
    const payload = {
      record_type: recordType,
      title: recordTitle.trim() || `${recordType.toUpperCase()} Record`,
      details: recordDetails.trim(),
      vitals_json: hasVitals ? JSON.stringify(vitals) : null
    }
    addRecordMutation.mutate(payload)
  }

  const handleProfileSubmit = (e) => {
    e.preventDefault()
    updateProfileMutation.mutate(profileForm)
  }

  // Filter patients list by search query
  const filteredPatients = patientsList.filter(p => {
    const q = searchQuery.toLowerCase()
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.hospital_id && p.hospital_id.toLowerCase().includes(q))
    )
  })

  const handleSelectPatient = (pid) => {
    setActivePatientId(pid)
    navigate(`/app/ehr/${pid}`)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Patient Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📋</span> Electronic Health Record (EHR)
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Centralized digital patient chart & append-only clinical history
          </p>
        </div>

        {!isPatientRole && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search Hospital ID (MED...) or Name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            {patientsList.length > 0 && (
              <select
                value={activePatientId || ''}
                onChange={(e) => handleSelectPatient(Number(e.target.value))}
                className="border border-blue-200 rounded-xl px-3 py-2 text-sm bg-blue-50/50 text-blue-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {filteredPatients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.hospital_id || `MED${String(p.id).padStart(6, '0')}`} — {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="bg-white p-12 rounded-2xl shadow text-center text-gray-500 font-medium">
          Loading patient health records...
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center">
          <p className="font-semibold">Access Restricted</p>
          <p className="text-sm mt-1">{error?.response?.data?.detail || 'Unable to access EHR'}</p>
        </div>
      )}

      {!isLoading && !isError && currentPatientInfo && (
        <>
          {/* Patient Digital Identity Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-blue-700">
            <div className="space-y-3 flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-semibold px-3 py-1 rounded-full">
                  🏥 Verified EHR Patient Chart
                </span>
                <span className="font-mono text-sm font-bold bg-white text-blue-950 px-3 py-0.5 rounded-lg border border-white">
                  {currentPatientInfo.hospital_id || `MED${String(currentPatientInfo.id).padStart(6, '0')}`}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {currentPatientInfo.name}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-blue-200 bg-white/5 p-3 rounded-2xl border border-white/10">
                <div>
                  <span className="text-blue-300 block font-medium">Age / Gender:</span>
                  <span className="font-semibold text-white">{currentPatientInfo.age || '—'} yrs / {currentPatientInfo.gender || '—'}</span>
                </div>
                <div>
                  <span className="text-blue-300 block font-medium">Contact:</span>
                  <span className="font-semibold text-white">{currentPatientInfo.contact || '—'}</span>
                </div>
                <div>
                  <span className="text-blue-300 block font-medium">Blood Group:</span>
                  <span className="font-semibold text-white">{ehrData?.blood_group || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-blue-300 block font-medium">Address:</span>
                  <span className="font-semibold text-white truncate block">{currentPatientInfo.address || '—'}</span>
                </div>
              </div>
            </div>

            {currentPatientInfo.qr_code && (
              <button
                onClick={() => setShowQrModal(true)}
                className="bg-white p-3 rounded-2xl shadow-lg border-2 border-white/80 hover:scale-105 transition flex flex-col items-center group cursor-pointer"
              >
                <img
                  src={currentPatientInfo.qr_code}
                  alt={`QR ${currentPatientInfo.hospital_id}`}
                  className="w-28 h-28"
                />
                <span className="text-[10px] text-blue-900 font-mono font-bold mt-1 group-hover:underline">
                  View Digital Card
                </span>
              </button>
            )}
          </div>

          {/* PHARMACIST VIEW (Sanitized RBAC) */}
          {isPharmacist && ehrData && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-lg">
                <span>💊 Pharmacist Medication & Safety Profile</span>
              </div>
              <p className="text-xs text-amber-700 bg-amber-100/60 p-3 rounded-xl">
                🔒 Privacy Protection Enabled: Sensitive clinical notes and diagnoses are restricted. Showing relevant allergies, current medications, and active prescriptions.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm space-y-2">
                  <h3 className="text-sm font-bold text-red-700 flex items-center gap-1">
                    <span>⚠️</span> Allergies
                  </h3>
                  <p className="text-sm text-gray-800 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
                    {ehrData.allergies || 'No known drug allergies reported.'}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm space-y-2">
                  <h3 className="text-sm font-bold text-blue-700 flex items-center gap-1">
                    <span>💊</span> Current Medications
                  </h3>
                  <p className="text-sm text-gray-800 bg-blue-50 p-3 rounded-xl border border-blue-100 font-medium">
                    {ehrData.current_medications || 'No current medications recorded.'}
                  </p>
                </div>
              </div>

              {/* Active Prescriptions Table for Pharmacist */}
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Dispensing Prescriptions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                      <tr>
                        <th className="p-3">Drug Name</th>
                        <th className="p-3">Dosage</th>
                        <th className="p-3">Instructions</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(!ehrData.prescriptions || ehrData.prescriptions.length === 0) && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400">No prescriptions found.</td>
                        </tr>
                      )}
                      {ehrData.prescriptions?.map(rx => (
                        <tr key={rx.id} className="hover:bg-amber-50/40">
                          <td className="p-3 font-semibold text-gray-900">{rx.drug_name}</td>
                          <td className="p-3 text-gray-700">{rx.dosage}</td>
                          <td className="p-3 text-gray-600">{rx.instructions || '—'}</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              rx.dispensed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {rx.dispensed ? 'Dispensed' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FULL EHR VIEW (Doctor, Nurse, Admin, Patient) */}
          {!isPharmacist && ehrData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column — Medical Background & Overview */}
              <div className="space-y-6 lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                      <span>🩺</span> Medical Profile
                    </h3>
                    {canEdit && (
                      <button
                        onClick={() => setShowEditProfile(!showEditProfile)}
                        className="text-xs text-blue-700 hover:text-blue-900 font-semibold hover:underline"
                      >
                        {showEditProfile ? 'Cancel' : 'Edit Profile'}
                      </button>
                    )}
                  </div>

                  {showEditProfile && canEdit ? (
                    <form onSubmit={handleProfileSubmit} className="space-y-3 pt-1">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Blood Group</label>
                        <input
                          type="text"
                          value={profileForm.blood_group}
                          onChange={e => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                          placeholder="e.g. O+, A-, B+"
                          className="mt-1 w-full border rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Allergies</label>
                        <textarea
                          rows={2}
                          value={profileForm.allergies}
                          onChange={e => setProfileForm({ ...profileForm, allergies: e.target.value })}
                          placeholder="Penicillin, Peanuts, Latex..."
                          className="mt-1 w-full border rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Chronic Conditions</label>
                        <textarea
                          rows={2}
                          value={profileForm.chronic_conditions}
                          onChange={e => setProfileForm({ ...profileForm, chronic_conditions: e.target.value })}
                          placeholder="Hypertension, Asthma, Type 2 Diabetes..."
                          className="mt-1 w-full border rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Current Medications</label>
                        <textarea
                          rows={2}
                          value={profileForm.current_medications}
                          onChange={e => setProfileForm({ ...profileForm, current_medications: e.target.value })}
                          placeholder="Metformin 500mg, Amoxicillin..."
                          className="mt-1 w-full border rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Medical History</label>
                        <textarea
                          rows={3}
                          value={profileForm.medical_history}
                          onChange={e => setProfileForm({ ...profileForm, medical_history: e.target.value })}
                          placeholder="Past surgeries, hospitalizations, family medical history..."
                          className="mt-1 w-full border rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs py-2 rounded-xl transition shadow-sm"
                      >
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4 text-xs">
                      <div>
                        <span className="font-bold text-red-700 block mb-1">⚠️ Allergies</span>
                        <div className="bg-red-50 text-red-900 p-2.5 rounded-xl border border-red-100 font-medium">
                          {ehrData.allergies || 'No known allergies reported.'}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-amber-700 block mb-1">🩺 Chronic Conditions</span>
                        <div className="bg-amber-50 text-amber-900 p-2.5 rounded-xl border border-amber-100 font-medium">
                          {ehrData.chronic_conditions || 'None reported.'}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-blue-700 block mb-1">💊 Current Medications</span>
                        <div className="bg-blue-50 text-blue-900 p-2.5 rounded-xl border border-blue-100 font-medium">
                          {ehrData.current_medications || 'None recorded.'}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-gray-700 block mb-1">📖 Background Medical History</span>
                        <div className="bg-gray-50 text-gray-800 p-2.5 rounded-xl border border-gray-200 leading-relaxed">
                          {ehrData.medical_history || 'No background medical history provided.'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Laboratory Reports Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <span>🧪</span> Laboratory Reports
                    </h3>
                    <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                      {patientLabReports.length} Reports
                    </span>
                  </div>

                  {patientLabReports.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No completed laboratory reports found for this patient.</p>
                  )}

                  <div className="space-y-2.5">
                    {patientLabReports.map((report) => (
                      <div
                        key={report.id}
                        className="bg-gray-50 hover:bg-blue-50/50 p-3 rounded-xl border border-gray-200 transition space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-gray-900">{report.test_name}</span>
                          <span className="text-[10px] font-mono bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded">
                            {report.sample_id}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Verified: {report.verified_by_doctor_name || 'Doctor Approved'}</span>
                          <span>{new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                        <button
                          onClick={() => setSelectedLabReportModal(report)}
                          className="w-full mt-1 bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white text-[11px] font-semibold py-1 rounded-lg transition"
                        >
                          📄 View Verified Lab Report
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column — Clinical Records & Append-Only History */}
              <div className="space-y-6 lg:col-span-2">

                {/* Add Clinical Note Form (Doctor/Nurse/Admin only) */}
                {canEdit && (
                  <form onSubmit={handleAddRecordSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        <span>📝</span> Add Clinical Observation / Consultation Note
                      </h3>
                      <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">
                        Append-Only Entry
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Record Type</label>
                        <select
                          value={recordType}
                          onChange={e => setRecordType(e.target.value)}
                          className="mt-1 w-full border rounded-lg p-2 text-xs bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="consultation">Consultation Note</option>
                          <option value="diagnosis">Diagnosis & Assessment</option>
                          <option value="vital_signs">Vital Signs Check</option>
                          <option value="doctor_note">Doctor Clinical Note</option>
                          <option value="lab_report">Lab Result Note</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600">Title / Subject</label>
                        <input
                          type="text"
                          value={recordTitle}
                          onChange={e => setRecordTitle(e.target.value)}
                          placeholder="e.g. Routine Follow-up, Fever Check"
                          className="mt-1 w-full border rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Vitals Input Grid */}
                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-1">
                      <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                        💓 Vital Signs (Optional)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium">BP (mmHg)</label>
                          <input
                            type="text"
                            placeholder="120/80"
                            value={vitals.bp}
                            onChange={e => setVitals({ ...vitals, bp: e.target.value })}
                            className="w-full border rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium">HR (bpm)</label>
                          <input
                            type="text"
                            placeholder="72"
                            value={vitals.hr}
                            onChange={e => setVitals({ ...vitals, hr: e.target.value })}
                            className="w-full border rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium">Temp (°F)</label>
                          <input
                            type="text"
                            placeholder="98.6"
                            value={vitals.temp}
                            onChange={e => setVitals({ ...vitals, temp: e.target.value })}
                            className="w-full border rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium">SpO2 (%)</label>
                          <input
                            type="text"
                            placeholder="98"
                            value={vitals.spo2}
                            onChange={e => setVitals({ ...vitals, spo2: e.target.value })}
                            className="w-full border rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium">Weight (kg)</label>
                          <input
                            type="text"
                            placeholder="70"
                            value={vitals.weight}
                            onChange={e => setVitals({ ...vitals, weight: e.target.value })}
                            className="w-full border rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600">Clinical Details / Observations *</label>
                      <textarea
                        rows={3}
                        required
                        value={recordDetails}
                        onChange={e => setRecordDetails(e.target.value)}
                        placeholder="Detailed clinical notes, physical examination findings, recommendations..."
                        className="mt-1 w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={addRecordMutation.isPending}
                      className="bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
                    >
                      <span>➕</span>
                      <span>{addRecordMutation.isPending ? 'Recording...' : 'Append Record to Patient Chart'}</span>
                    </button>
                  </form>
                )}

                {/* Append-Only Clinical Timeline */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <span>📜</span> Clinical Records Timeline (Append-Only History)
                    </h3>
                    <span className="text-xs text-gray-500">
                      {ehrData.records?.length || 0} total entries
                    </span>
                  </div>

                  {(!ehrData.records || ehrData.records.length === 0) && (
                    <div className="py-8 text-center text-gray-400 text-xs">
                      No clinical records added yet. Clinical notes and observations added by medical staff will appear here.
                    </div>
                  )}

                  <div className="space-y-4">
                    {ehrData.records?.map((rec) => {
                      let parsedVitals = null
                      if (rec.vitals_json) {
                        try { parsedVitals = JSON.parse(rec.vitals_json) } catch (e) {}
                      }

                      return (
                        <div key={rec.id} className="border-l-4 border-blue-600 bg-gray-50/70 p-4 rounded-r-2xl space-y-2 border border-gray-100 shadow-2xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">{rec.title || 'Clinical Record'}</span>
                              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                                {rec.record_type}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400">
                              {new Date(rec.created_at).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {rec.details}
                          </p>

                          {parsedVitals && (
                            <div className="flex flex-wrap gap-2 text-[10px] pt-1">
                              {parsedVitals.bp && <span className="bg-white border px-2 py-0.5 rounded text-gray-700 font-mono">BP: <b>{parsedVitals.bp}</b></span>}
                              {parsedVitals.hr && <span className="bg-white border px-2 py-0.5 rounded text-gray-700 font-mono">HR: <b>{parsedVitals.hr} bpm</b></span>}
                              {parsedVitals.temp && <span className="bg-white border px-2 py-0.5 rounded text-gray-700 font-mono">Temp: <b>{parsedVitals.temp} °F</b></span>}
                              {parsedVitals.spo2 && <span className="bg-white border px-2 py-0.5 rounded text-gray-700 font-mono">SpO2: <b>{parsedVitals.spo2}%</b></span>}
                              {parsedVitals.weight && <span className="bg-white border px-2 py-0.5 rounded text-gray-700 font-mono">Weight: <b>{parsedVitals.weight} kg</b></span>}
                            </div>
                          )}

                          <div className="text-[11px] text-gray-500 font-medium pt-1 flex items-center gap-1">
                            <span>👩‍⚕️</span> Recorded by: <span className="font-semibold text-gray-800">{rec.doctor_name || 'Medical Staff'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}

      {/* QR Code Modal */}
      {showQrModal && currentPatientInfo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 text-center relative">
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
              <div className="text-3xl mb-1">🏥</div>
              <h3 className="text-lg font-bold">MediCare Hospital</h3>
              <p className="text-xs text-blue-200">Digital Patient Identity Card</p>
            </div>
            <div className="p-6 text-center">
              <img src={currentPatientInfo.qr_code} alt="QR" className="w-44 h-44 mx-auto border p-2 rounded-2xl mb-3" />
              <p className="font-mono font-bold text-blue-900 bg-blue-50 inline-block px-3 py-1 rounded-full text-sm">
                {currentPatientInfo.hospital_id}
              </p>
              <h4 className="font-bold text-gray-900 text-lg mt-2">{currentPatientInfo.name}</h4>
              <p className="text-xs text-gray-500 mt-1">
                🔒 Scannable QR contains ONLY the Hospital ID for secure lookup.
              </p>
              <button
                onClick={() => setShowQrModal(false)}
                className="mt-5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-6 rounded-xl text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verified Lab Report Viewer Modal */}
      {selectedLabReportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-green-500/30 text-green-200 font-bold px-2 py-0.5 rounded uppercase">
                  Verified EHR Laboratory Record
                </span>
                <h3 className="text-lg font-bold mt-1">{selectedLabReportModal.test_name}</h3>
                <p className="text-xs text-blue-200">Sample ID: {selectedLabReportModal.sample_id} • Hospital ID: {selectedLabReportModal.hospital_id}</p>
              </div>
              <button
                onClick={() => setSelectedLabReportModal(null)}
                className="text-white/80 hover:text-white text-xl font-bold bg-white/10 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2">
                <span className="font-bold text-gray-900 block text-xs border-b pb-2">Structured Lab Parameters</span>
                <table className="w-full text-xs text-left">
                  <thead className="text-gray-500 border-b">
                    <tr>
                      <th className="py-2">Parameter</th>
                      <th className="py-2">Result</th>
                      <th className="py-2">Unit</th>
                      <th className="py-2">Ref Range</th>
                      <th className="py-2">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedLabReportModal.parameters?.map((p, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium text-gray-900">{p.parameter_name}</td>
                        <td className="py-2 font-bold text-gray-900">{p.result_value}</td>
                        <td className="py-2 text-gray-500">{p.unit || '—'}</td>
                        <td className="py-2 text-gray-500">{p.reference_range || '—'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.flag === 'CRITICAL' ? 'bg-red-600 text-white' :
                            p.flag === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                            p.flag === 'LOW' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {p.flag}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedLabReportModal.result_summary && (
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <span className="font-bold text-gray-700 block mb-1">Technician Result Summary:</span>
                  <p className="text-gray-800 leading-relaxed">{selectedLabReportModal.result_summary}</p>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-green-950 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold block">Doctor Verification:</span>
                  <span>{selectedLabReportModal.verified_by_doctor_name || 'Attending Physician Approved'}</span>
                </div>
                <span className="bg-green-200 text-green-900 text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                  {selectedLabReportModal.verification_status}
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedLabReportModal(null)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
