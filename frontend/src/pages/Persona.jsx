import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

const priorityBadges = {
  EMERGENCY: 'bg-red-100 text-red-800 border-red-300 animate-pulse font-bold',
  HIGH: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
  NORMAL: 'bg-blue-100 text-blue-800 border-blue-300',
  UNASSESSED: 'bg-gray-100 text-gray-600 border-gray-300'
}

const statusBadges = {
  WAITING: 'bg-yellow-100 text-yellow-800',
  ASSESSED: 'bg-blue-100 text-blue-800',
  ESCALATED: 'bg-red-100 text-red-800 font-bold',
  REFERRED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800'
}

export default function Persona() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const role = user?.role
  const isDoctorOrAdmin = ['doctor', 'admin'].includes(role)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedAssessment, setSelectedAssessment] = useState(null)
  const [reviewModalAssessment, setReviewModalAssessment] = useState(null)
  const [lastCreatedAssessment, setLastCreatedAssessment] = useState(null)
  const [doctorNotes, setDoctorNotes] = useState('')
  const [appendToEhr, setAppendToEhr] = useState(true)

  const { register, handleSubmit, reset, setValue } = useForm({
    defaultValues: {
      severity: 'moderate',
      temperature: '',
      blood_pressure: '',
      heart_rate: '',
      spo2: ''
    }
  })

  // Queries
  const { data: queue = [], isLoading: loadingQueue } = useQuery({
    queryKey: ['persona-queue'],
    queryFn: () => api.get('/persona/queue').then(r => r.data),
    refetchInterval: 10000 // auto refresh queue every 10s
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => api.get('/patients').then(r => r.data)
  })

  const { data: assessments = [] } = useQuery({
    queryKey: ['persona-assessments'],
    queryFn: () => api.get('/persona/assessments').then(r => r.data)
  })

  // Filter patients by search term
  const filteredPatients = patients.filter(p => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (p.hospital_id && p.hospital_id.toLowerCase().includes(term)) ||
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.contact && p.contact.toLowerCase().includes(term))
    )
  })

  // Create Assessment Mutation
  const createAssessment = useMutation({
    mutationFn: (formData) => api.post('/persona/assessments', formData),
    onSuccess: (res) => {
      qc.invalidateQueries(['persona-queue'])
      qc.invalidateQueries(['persona-assessments'])
      setLastCreatedAssessment(res.data)
      reset()
      setSelectedPatient(null)
      alert(`Initial Triage Complete! Assigned Priority: ${res.data.priority}`)
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to create triage assessment')
    }
  })

  // Doctor Review Mutation
  const doctorReview = useMutation({
    mutationFn: ({ id, reviewData }) => api.post(`/persona/assessments/${id}/doctor-review`, reviewData),
    onSuccess: (res) => {
      qc.invalidateQueries(['persona-queue'])
      qc.invalidateQueries(['persona-assessments'])
      qc.invalidateQueries(['ehr'])
      setReviewModalAssessment(null)
      setDoctorNotes('')
      alert(`Assessment Reviewed! Status updated to '${res.data.doctor_review_status}'`)
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to update doctor review')
    }
  })

  const handleSelectPatient = (p) => {
    setSelectedPatient(p)
    setValue('patient_id', p.id)
    if (p.hospital_id) setValue('hospital_id', p.hospital_id)
  }

  const handleQuickQRScan = (e) => {
    e.preventDefault()
    if (!searchTerm) return
    const matched = patients.find(p => p.hospital_id?.toUpperCase() === searchTerm.trim().toUpperCase())
    if (matched) {
      handleSelectPatient(matched)
    } else {
      alert(`No patient found matching Hospital ID '${searchTerm}'`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 p-6 rounded-2xl text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>🩺 Persona — Initial Assessment & Patient Prioritization</span>
          </h1>
          <p className="text-blue-200 text-sm mt-1">
            Junior Doctor & Triage Workflow • Automated Rule-Based Patient Prioritization • Real-Time Doctor Escalation
          </p>
        </div>
        <div className="bg-blue-950/60 border border-blue-700/60 p-3 rounded-xl max-w-md text-xs text-blue-100">
          <span className="font-semibold text-amber-300">⚠️ Safety Rule:</span> Persona performs initial assessment and helps prioritize patients for doctor consultation. The final clinical decision always belongs to the qualified attending doctor.
        </div>
      </div>

      {/* Main Grid: Form + Priority Result & Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Patient Search & Quick Select */}
        <div className="bg-white p-5 rounded-2xl shadow border space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center justify-between">
            <span>1. Patient Search / Identity</span>
            <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">QR Hospital ID Compatible</span>
          </h2>

          <form onSubmit={handleQuickQRScan} className="flex gap-2">
            <input
              type="text"
              placeholder="Search Name, Contact, or Hospital ID (e.g. MED000001)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 whitespace-nowrap">
              Scan / Find
            </button>
          </form>

          {/* Selected Patient Card */}
          {selectedPatient ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm relative">
              <button
                onClick={() => setSelectedPatient(null)}
                className="absolute top-2 right-2 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded px-1.5 py-0.5"
              >
                Change
              </button>
              <div className="font-semibold text-blue-900">{selectedPatient.name}</div>
              <div className="text-xs text-blue-700 mt-1 space-y-0.5">
                <div>Hospital ID: <span className="font-mono font-medium">{selectedPatient.hospital_id || 'N/A'}</span></div>
                <div>Age: {selectedPatient.age || 'N/A'} yrs • Gender: {selectedPatient.gender || 'N/A'}</div>
                <div>Contact: {selectedPatient.contact || 'N/A'}</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
              👈 Search patient above or select from the list below to start initial assessment.
            </div>
          )}

          {/* Patient Search Results */}
          <div className="max-h-60 overflow-y-auto space-y-1 divide-y">
            {filteredPatients.length === 0 ? (
              <div className="text-xs text-gray-400 p-3 text-center">No patients found matching search</div>
            ) : (
              filteredPatients.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPatient(p)}
                  className={`p-2 rounded-lg text-xs cursor-pointer transition hover:bg-blue-50 flex justify-between items-center ${selectedPatient?.id === p.id ? 'bg-blue-100 font-semibold' : ''}`}
                >
                  <div>
                    <div className="font-medium text-gray-800">{p.name}</div>
                    <div className="text-gray-500 font-mono">{p.hospital_id}</div>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded">Select</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Assessment Entry Form */}
        <div className="bg-white p-5 rounded-2xl shadow border space-y-4 lg:col-span-2">
          <h2 className="font-bold text-gray-800">
            2. Initial Assessment & Vitals Entry
          </h2>

          <form onSubmit={handleSubmit(data => createAssessment.mutate(data))} className="space-y-4">
            <input type="hidden" {...register('patient_id', { required: true })} />
            <input type="hidden" {...register('hospital_id')} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-700">Symptoms & Chief Complaint *</label>
                <textarea
                  {...register('symptoms', { required: true })}
                  placeholder="Describe patient's symptoms (e.g., chest pain, shortness of breath, fever, dizziness)..."
                  rows={2}
                  className="mt-1 w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Symptom Duration</label>
                <input
                  {...register('symptom_duration')}
                  placeholder="e.g. 2 hours, 3 days"
                  className="mt-1 w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Perceived Severity</label>
                <select
                  {...register('severity')}
                  className="mt-1 w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>

              {/* Vitals Grid */}
              <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600">Temp (°F)</label>
                  <input
                    type="number" step="0.1"
                    {...register('temperature')}
                    placeholder="98.6"
                    className="mt-1 w-full border rounded p-1.5 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600">Blood Pressure</label>
                  <input
                    type="text"
                    {...register('blood_pressure')}
                    placeholder="120/80"
                    className="mt-1 w-full border rounded p-1.5 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    {...register('heart_rate')}
                    placeholder="72"
                    className="mt-1 w-full border rounded p-1.5 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600">SpO2 (%)</label>
                  <input
                    type="number" step="0.1"
                    {...register('spo2')}
                    placeholder="98"
                    className="mt-1 w-full border rounded p-1.5 text-sm bg-white"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-700">Additional Notes / Observations</label>
                <input
                  {...register('additional_notes')}
                  placeholder="Optional observations for attending doctor..."
                  className="mt-1 w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={!selectedPatient || createAssessment.isPending}
                className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm shadow transition flex items-center gap-2"
              >
                {createAssessment.isPending ? 'Processing Prioritization...' : '⚡ Submit & Assign Priority'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Priority Result Banner (If assessment just created) */}
      {lastCreatedAssessment && (
        <div className="bg-white border rounded-2xl p-5 shadow space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">Last Triage Result Summary</h3>
            <button onClick={() => setLastCreatedAssessment(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border flex flex-col items-center justify-center bg-gray-50">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Assigned Queue Priority</span>
              <span className={`mt-1 px-4 py-1.5 rounded-full text-base font-extrabold border ${priorityBadges[lastCreatedAssessment.priority]}`}>
                {lastCreatedAssessment.priority}
              </span>
            </div>
            <div className="md:col-span-2 p-4 rounded-xl border bg-slate-50 text-sm space-y-1">
              <div className="font-semibold text-gray-800">Prioritization Reason:</div>
              <p className="text-gray-700 text-xs leading-relaxed">{lastCreatedAssessment.priority_reason}</p>
              <div className="text-[11px] text-gray-400 italic pt-1 border-t mt-2">
                {lastCreatedAssessment.disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Smart Priority Queue Table */}
      <div className="bg-white rounded-2xl shadow border overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <span>📊 Real-Time Patient Priority Queue</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                {queue.length} Patients in Queue
              </span>
            </h2>
            <p className="text-xs text-gray-500">Automatically ordered: 1. EMERGENCY → 2. HIGH → 3. NORMAL → 4. Routine/Unassessed</p>
          </div>
          <button
            onClick={() => qc.invalidateQueries(['persona-queue'])}
            className="text-xs bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg shadow-sm font-medium"
          >
            🔄 Refresh Queue
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-600 font-semibold text-xs border-b">
              <tr>
                <th className="px-4 py-3 text-center">Pos</th>
                <th className="px-4 py-3 text-left">Hospital ID</th>
                <th className="px-4 py-3 text-left">Patient Name</th>
                <th className="px-4 py-3 text-center">Priority</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Doctor Review</th>
                <th className="px-4 py-3 text-center">Waiting Time</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingQueue ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading priority queue...</td></tr>
              ) : queue.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No active patients in consultation queue</td></tr>
              ) : (
                queue.map(item => (
                  <tr key={`${item.patient_id}-${item.position}`} className={`hover:bg-blue-50/50 ${item.priority === 'EMERGENCY' ? 'bg-red-50/40' : item.priority === 'HIGH' ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-3 text-center font-bold text-gray-800">
                      #{item.position}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-900">
                      {item.hospital_id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.patient_name}</div>
                      <div className="text-[11px] text-gray-500">{item.age ? `${item.age} yrs` : ''} {item.gender ? `• ${item.gender}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs border ${priorityBadges[item.priority]}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${statusBadges[item.assessment_status || 'WAITING']}`}>
                        {item.assessment_status || 'WAITING'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {item.doctor_review_status === 'APPROVED' ? (
                        <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-medium">Approved</span>
                      ) : item.doctor_review_status === 'REVIEWED' ? (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-medium">Reviewed</span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">Pending Review</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-gray-600">
                      {item.waiting_time_minutes} mins
                    </td>
                    <td className="px-4 py-3 text-center flex justify-center gap-1.5">
                      {item.assessment_id && (
                        <button
                          onClick={() => {
                            const found = assessments.find(a => a.id === item.assessment_id)
                            if (found) setSelectedAssessment(found)
                            else api.get(`/persona/assessments/${item.assessment_id}`).then(r => setSelectedAssessment(r.data))
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-xs font-medium"
                        >
                          Details
                        </button>
                      )}
                      {isDoctorOrAdmin && item.assessment_id && (
                        <button
                          onClick={() => {
                            const found = assessments.find(a => a.id === item.assessment_id)
                            setReviewModalAssessment(found || item)
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-medium"
                        >
                          Doctor Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View Triage Details */}
      {selectedAssessment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-800 text-lg">Initial Triage Assessment #{selectedAssessment.id}</h3>
              <button onClick={() => setSelectedAssessment(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border">
                <div>
                  <div className="text-gray-500 font-semibold">Patient</div>
                  <div className="font-bold text-sm text-gray-900">{selectedAssessment.patient_name || `ID ${selectedAssessment.patient_id}`}</div>
                  <div className="font-mono text-blue-700">{selectedAssessment.hospital_id}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${priorityBadges[selectedAssessment.priority]}`}>
                  {selectedAssessment.priority}
                </span>
              </div>

              <div>
                <span className="font-semibold text-gray-700">Symptoms:</span>
                <p className="p-2 bg-gray-50 border rounded-lg mt-0.5 font-medium">{selectedAssessment.symptoms}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-700">
                <div>Duration: <span className="font-medium">{selectedAssessment.symptom_duration || 'N/A'}</span></div>
                <div>Perceived Severity: <span className="font-medium capitalize">{selectedAssessment.severity || 'N/A'}</span></div>
              </div>

              {/* Vitals Summary */}
              <div className="grid grid-cols-4 gap-2 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100 text-center">
                <div>
                  <div className="text-[10px] text-gray-500">Temp</div>
                  <div className="font-semibold text-blue-900">{selectedAssessment.temperature ? `${selectedAssessment.temperature}°F` : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">BP</div>
                  <div className="font-semibold text-blue-900">{selectedAssessment.blood_pressure || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">HR</div>
                  <div className="font-semibold text-blue-900">{selectedAssessment.heart_rate ? `${selectedAssessment.heart_rate} bpm` : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">SpO2</div>
                  <div className="font-semibold text-blue-900">{selectedAssessment.spo2 ? `${selectedAssessment.spo2}%` : '—'}</div>
                </div>
              </div>

              <div>
                <span className="font-semibold text-gray-700">Rule-Based Priority Reason:</span>
                <p className="p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg mt-0.5 text-xs">{selectedAssessment.priority_reason}</p>
              </div>

              {selectedAssessment.doctor_notes && (
                <div>
                  <span className="font-semibold text-indigo-900">Doctor Notes & Review:</span>
                  <p className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg mt-0.5 text-xs">{selectedAssessment.doctor_notes}</p>
                </div>
              )}

              <div className="text-[10px] text-gray-400 italic pt-2 border-t">
                {selectedAssessment.disclaimer}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedAssessment(null)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-300">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Doctor Review & EHR Append */}
      {reviewModalAssessment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span>Doctor Assessment Review</span>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${priorityBadges[reviewModalAssessment.priority]}`}>
                  {reviewModalAssessment.priority}
                </span>
              </h3>
              <button onClick={() => setReviewModalAssessment(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
                <div className="font-semibold text-gray-900">{reviewModalAssessment.patient_name || `Patient #${reviewModalAssessment.patient_id}`} ({reviewModalAssessment.hospital_id})</div>
                <div className="text-gray-600">Symptoms: <span className="font-medium">{reviewModalAssessment.symptoms}</span></div>
                <div className="text-gray-500 italic text-[11px]">{reviewModalAssessment.priority_reason}</div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Doctor Decision / Clinical Notes</label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter clinical review notes, verification findings, or escalation instructions..."
                  rows={3}
                  className="w-full border rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                <input
                  type="checkbox"
                  id="appendToEhr"
                  checked={appendToEhr}
                  onChange={(e) => setAppendToEhr(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="appendToEhr" className="text-xs font-semibold text-indigo-950 cursor-pointer">
                  Append assessment summary & doctor review to patient's Central EHR Clinical History
                </label>
              </div>

              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">
                ⚠️ The attending doctor remains the final clinical decision-maker.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setReviewModalAssessment(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={() => doctorReview.mutate({
                  id: reviewModalAssessment.id || reviewModalAssessment.assessment_id,
                  reviewData: {
                    doctor_review_status: 'APPROVED',
                    status: 'ASSESSED',
                    doctor_notes: doctorNotes,
                    append_to_ehr: appendToEhr
                  }
                })}
                disabled={doctorReview.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow"
              >
                {doctorReview.isPending ? 'Saving...' : '✓ Approve & Accept Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
