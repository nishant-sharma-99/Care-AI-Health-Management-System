import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Laboratory() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const isPatient = user?.role === 'patient'
  const isDoctor = ['admin', 'doctor'].includes(user?.role)
  const isTechnician = ['admin', 'lab_technician'].includes(user?.role)
  const canCreateOrder = ['admin', 'doctor', 'nurse'].includes(user?.role)

  // Active Tab / View state
  const [activeTab, setActiveTab] = useState('queue') // 'create', 'queue', 'reports'

  // Modals state
  const [showResultModal, setShowResultModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)

  // Section A: Create Lab Order state
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedTestName, setSelectedTestName] = useState('')
  const [orderPriority, setOrderPriority] = useState('NORMAL')
  const [clinicalNotes, setClinicalNotes] = useState('')

  // Section B: Result Entry form state
  const [resultSummary, setResultSummary] = useState('')
  const [parameters, setParameters] = useState([])
  const [reportSubmitStatus, setReportSubmitStatus] = useState('AWAITING_VERIFICATION')

  // Section C: Doctor Verification form state
  const [verificationNotes, setVerificationNotes] = useState('Results reviewed and verified.')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  // Filter for reports tab
  const [reportFilter, setReportFilter] = useState('ALL')

  // --- API QUERIES ---

  // Fetch Test Catalog
  const { data: catalog = [] } = useQuery({
    queryKey: ['lab-catalog'],
    queryFn: () => api.get('/lab/catalog').then(r => r.data)
  })

  // Fetch Patients for order creation
  const { data: patientsList = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => api.get('/patients').then(r => r.data),
    enabled: canCreateOrder,
    retry: false
  })

  // Fetch Patient Profile if role is patient
  const { data: myPatientProfile } = useQuery({
    queryKey: ['my-patient-profile'],
    queryFn: () => api.get('/patients/me').then(r => r.data),
    enabled: isPatient,
    retry: false
  })

  // Fetch Pending Queue
  const { data: queue = [], isLoading: isLoadingQueue } = useQuery({
    queryKey: ['lab-queue'],
    queryFn: () => api.get('/lab/queue').then(r => r.data),
    enabled: !isPatient,
    refetchInterval: 10000
  })

  // Fetch Lab Orders
  const { data: allOrders = [] } = useQuery({
    queryKey: ['lab-orders'],
    queryFn: () => api.get('/lab/orders').then(r => r.data),
    enabled: !isPatient
  })

  // Fetch Reports
  const { data: reportsList = [], isLoading: isLoadingReports } = useQuery({
    queryKey: ['lab-reports', isPatient ? myPatientProfile?.id : 'all'],
    queryFn: () => {
      if (isPatient && myPatientProfile?.id) {
        return api.get(`/lab/reports/patient/${myPatientProfile.id}`).then(r => r.data)
      }
      return api.get('/lab/orders').then(async () => {
        // Fetch reports for all patients by getting unique orders or direct endpoint
        const ords = await api.get('/lab/orders').then(r => r.data)
        const repPromises = ords.map(o => api.get(`/lab/reports/${o.id}`).then(r => r.data).catch(() => null))
        const res = await Promise.all(repPromises)
        return res.filter(Boolean)
      })
    },
    enabled: isPatient ? !!myPatientProfile?.id : true
  })

  // Sync default test selection from catalog
  useEffect(() => {
    if (catalog.length > 0 && !selectedTestName) {
      setSelectedTestName(catalog[0].test_name)
    }
  }, [catalog, selectedTestName])

  // Set default tab based on user role
  useEffect(() => {
    if (isPatient) {
      setActiveTab('reports')
    } else if (canCreateOrder && !isTechnician) {
      setActiveTab('create')
    } else if (isTechnician) {
      setActiveTab('queue')
    }
  }, [isPatient, isTechnician, canCreateOrder])

  // --- MUTATIONS ---

  // Create Lab Order
  const createOrderMutation = useMutation({
    mutationFn: (data) => api.post('/lab/orders', data),
    onSuccess: (res) => {
      alert(`Lab Order created successfully! Sample ID: ${res.data.sample_id}`)
      qc.invalidateQueries(['lab-queue'])
      qc.invalidateQueries(['lab-orders'])
      setSelectedPatient(null)
      setClinicalNotes('')
      setOrderPriority('NORMAL')
      setActiveTab('queue')
    },
    onError: (err) => alert(err.response?.data?.detail || 'Failed to create lab order')
  })

  // Update Status
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }) => api.put(`/lab/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries(['lab-queue'])
      qc.invalidateQueries(['lab-orders'])
    },
    onError: (err) => alert(err.response?.data?.detail || 'Failed to update order status')
  })

  // Submit Result Report
  const submitReportMutation = useMutation({
    mutationFn: ({ orderId, payload }) => api.post(`/lab/orders/${orderId}/report`, payload),
    onSuccess: () => {
      alert('Laboratory results submitted successfully!')
      qc.invalidateQueries(['lab-queue'])
      qc.invalidateQueries(['lab-orders'])
      qc.invalidateQueries(['lab-reports'])
      setShowResultModal(false)
      setSelectedOrder(null)
    },
    onError: (err) => alert(err.response?.data?.detail || 'Failed to submit lab report')
  })

  // Doctor Verification
  const verifyReportMutation = useMutation({
    mutationFn: ({ reportId, payload }) => api.post(`/lab/reports/${reportId}/verify`, payload),
    onSuccess: (res) => {
      const statusText = res.data.verification_status
      alert(`Report ${statusText === 'VERIFIED' ? 'Verified & Approved! Linked to Patient Central EHR.' : 'Rejected.'}`)
      qc.invalidateQueries(['lab-queue'])
      qc.invalidateQueries(['lab-orders'])
      qc.invalidateQueries(['lab-reports'])
      qc.invalidateQueries(['patient-ehr'])
      setShowVerifyModal(false)
      setSelectedReport(null)
    },
    onError: (err) => alert(err.response?.data?.detail || 'Failed to verify lab report')
  })

  // --- HANDLERS ---

  const handleSelectPatientForOrder = (p) => {
    setSelectedPatient(p)
  }

  const handleCreateOrderSubmit = (e) => {
    e.preventDefault()
    if (!selectedPatient) {
      alert('Please select a patient first.')
      return
    }
    const testObj = catalog.find(t => t.test_name === selectedTestName)
    const payload = {
      patient_id: selectedPatient.id,
      test_name: selectedTestName,
      test_category: testObj ? testObj.test_category : 'General',
      clinical_notes: clinicalNotes.trim() || null,
      priority: orderPriority
    }
    createOrderMutation.mutate(payload)
  }

  const handleOpenResultModal = (order) => {
    setSelectedOrder(order)
    // Populate parameters from catalog template if available
    const catItem = catalog.find(c => c.test_name === order.test_name)
    if (catItem && catItem.parameters) {
      setParameters(catItem.parameters.map(p => ({
        parameter_name: p.parameter_name,
        result_value: '',
        unit: p.unit || '',
        reference_range: p.reference_range || '',
        flag: 'NORMAL'
      })))
    } else {
      setParameters([{ parameter_name: '', result_value: '', unit: '', reference_range: '', flag: 'NORMAL' }])
    }
    setResultSummary('')
    setShowResultModal(true)
  }

  const handleAddParameterRow = () => {
    setParameters([...parameters, { parameter_name: '', result_value: '', unit: '', reference_range: '', flag: 'NORMAL' }])
  }

  const handleRemoveParameterRow = (idx) => {
    setParameters(parameters.filter((_, i) => i !== idx))
  }

  const handleParameterChange = (idx, field, val) => {
    const updated = [...parameters]
    updated[idx][field] = val
    setParameters(updated)
  }

  const handleSubmitResultsForm = (e) => {
    e.preventDefault()
    if (parameters.length === 0) {
      alert('Please enter at least one test parameter.')
      return
    }
    for (const p of parameters) {
      if (!p.parameter_name.trim() || !p.result_value.trim()) {
        alert('Please fill out Parameter Name and Result Value for all rows.')
        return
      }
    }
    const payload = {
      result_summary: resultSummary.trim() || 'Laboratory test completed.',
      parameters: parameters.map(p => ({
        parameter_name: p.parameter_name.trim(),
        result_value: p.result_value.trim(),
        unit: p.unit.trim() || null,
        reference_range: p.reference_range.trim() || null,
        flag: p.flag
      })),
      report_status: reportSubmitStatus
    }
    submitReportMutation.mutate({ orderId: selectedOrder.order_id || selectedOrder.id, payload })
  }

  const handleOpenVerifyModal = async (report) => {
    try {
      const fullReport = await api.get(`/lab/reports/${report.id}`).then(r => r.data)
      setSelectedReport(fullReport)
      setVerificationNotes('Results reviewed and verified.')
      setRejectionReason('')
      setIsRejecting(false)
      setShowVerifyModal(true)
    } catch (err) {
      alert('Unable to load report details.')
    }
  }

  const handleVerifySubmit = (approved) => {
    if (!approved && !rejectionReason.trim()) {
      alert('Please provide a rejection reason.')
      return
    }
    const payload = {
      approved: approved,
      verification_notes: approved ? verificationNotes.trim() : null,
      rejection_reason: !approved ? rejectionReason.trim() : null
    }
    verifyReportMutation.mutate({ reportId: selectedReport.id, payload })
  }

  const handleOpenReportModal = async (report) => {
    try {
      const fullReport = await api.get(`/lab/reports/${report.id}`).then(r => r.data)
      setSelectedReport(fullReport)
      setShowReportModal(true)
    } catch (err) {
      alert('Unable to load full lab report.')
    }
  }

  // Patient search filtering
  const filteredPatients = patientsList.filter(p => {
    const q = patientSearch.toLowerCase()
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.hospital_id && p.hospital_id.toLowerCase().includes(q)) ||
      (p.contact && p.contact.toLowerCase().includes(q))
    )
  })

  // Filtered reports
  const filteredReportsList = reportsList.filter(r => {
    if (reportFilter === 'ALL') return true
    if (reportFilter === 'AWAITING_VERIFICATION') return r.report_status === 'AWAITING_VERIFICATION'
    if (reportFilter === 'VERIFIED') return r.report_status === 'VERIFIED'
    if (reportFilter === 'REJECTED') return r.report_status === 'REJECTED'
    if (reportFilter === 'CRITICAL') return r.has_critical_result
    return true
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🧪</span> Laboratory Management Module
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Test ordering, sample tracking (Sample ID), technician result processing, & doctor verified EHR reports
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          {canCreateOrder && (
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'create' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ➕ Create Lab Order
            </button>
          )}

          {!isPatient && (
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'queue' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>📋</span>
              <span>Pending Queue</span>
              {queue.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {queue.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'reports' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Lab Reports
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A — CREATE LAB ORDER (DOCTOR / STAFF) */}
      {/* ========================================================================= */}
      {activeTab === 'create' && canCreateOrder && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Lookup Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4 lg:col-span-1">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
              <span>👤</span> 1. Select Patient
            </h2>

            <div>
              <label className="text-xs font-semibold text-gray-600">Search Patient</label>
              <input
                type="text"
                placeholder="Search Hospital ID (MED...), Name, Contact..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {filteredPatients.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No matching patients found.</p>
              )}
              {filteredPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPatientForOrder(p)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 font-semibold text-blue-900 shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-900">{p.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {p.hospital_id || `MED${String(p.id).padStart(6, '0')}`}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400">{p.age}y / {p.gender}</span>
                  </div>
                )
              })}
            </div>

            {selectedPatient && (
              <div className="bg-blue-900 text-white p-4 rounded-2xl space-y-1 text-xs">
                <span className="text-[10px] bg-blue-500/30 text-blue-200 font-bold px-2 py-0.5 rounded-md uppercase">
                  Selected Patient
                </span>
                <div className="font-bold text-sm text-white">{selectedPatient.name}</div>
                <div className="font-mono text-blue-200">{selectedPatient.hospital_id || `MED${String(selectedPatient.id).padStart(6, '0')}`}</div>
                <div className="text-blue-300 text-[11px]">
                  {selectedPatient.age} yrs • {selectedPatient.gender} • {selectedPatient.contact || 'No Contact'}
                </div>
              </div>
            )}
          </div>

          {/* Test Order Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5 lg:col-span-2">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
              <span>🩺</span> 2. Select Test & Clinical Parameters
            </h2>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Select Laboratory Test from Catalog *</label>
                <select
                  value={selectedTestName}
                  onChange={(e) => setSelectedTestName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-gray-50 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {catalog.map((t) => (
                    <option key={t.test_name} value={t.test_name}>
                      [{t.test_category}] {t.test_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show selected test description & parameters */}
              {(() => {
                const currentTest = catalog.find(t => t.test_name === selectedTestName)
                if (!currentTest) return null
                return (
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-900">{currentTest.test_name}</span>
                      <span className="bg-indigo-200 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {currentTest.test_category}
                      </span>
                    </div>
                    <p className="text-gray-600 text-[11px]">{currentTest.description}</p>
                    <div className="pt-1">
                      <span className="font-semibold text-indigo-950 block text-[10px] uppercase tracking-wider mb-1">Standard Parameters Tested:</span>
                      <div className="flex flex-wrap gap-1">
                        {currentTest.parameters?.map(p => (
                          <span key={p.parameter_name} className="bg-white text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-medium">
                            {p.parameter_name} ({p.unit || 'unit'})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Priority Level</label>
                  <div className="flex items-center gap-3">
                    <label className={`flex-1 p-2.5 rounded-xl border text-center cursor-pointer text-xs font-bold transition ${
                      orderPriority === 'NORMAL' ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-gray-200 text-gray-600'
                    }`}>
                      <input
                        type="radio"
                        name="priority"
                        value="NORMAL"
                        checked={orderPriority === 'NORMAL'}
                        onChange={() => setOrderPriority('NORMAL')}
                        className="sr-only"
                      />
                      <span>🟢 NORMAL</span>
                    </label>
                    <label className={`flex-1 p-2.5 rounded-xl border text-center cursor-pointer text-xs font-bold transition ${
                      orderPriority === 'URGENT' ? 'border-red-600 bg-red-50 text-red-900' : 'border-gray-200 text-gray-600'
                    }`}>
                      <input
                        type="radio"
                        name="priority"
                        value="URGENT"
                        checked={orderPriority === 'URGENT'}
                        onChange={() => setOrderPriority('URGENT')}
                        className="sr-only"
                      />
                      <span>🚨 URGENT</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Clinical Notes / Requisition Instructions (Optional)</label>
                <textarea
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Patient is fasting 10 hours. Check for suspected Dengue fever..."
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={createOrderMutation.isPending || !selectedPatient}
                className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2"
              >
                <span>🧪</span>
                <span>{createOrderMutation.isPending ? 'Generating Sample ID & Order...' : 'Create Laboratory Test Order'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B — LAB QUEUE (TECHNICIAN / STAFF WORKFLOW) */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && !isPatient && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📋</span> Pending Laboratory Work Queue
              </h2>
              <p className="text-xs text-gray-500">
                Sorted by priority (URGENT first) and ordered time. Click actions to process sample & enter structured results.
              </p>
            </div>
            <span className="text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full">
              {queue.length} Pending Orders
            </span>
          </div>

          {isLoadingQueue && (
            <div className="py-12 text-center text-gray-500 text-xs font-medium">
              Loading pending lab queue...
            </div>
          )}

          {!isLoadingQueue && queue.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-xs font-medium">
              🎉 No pending lab orders in queue! All tests processed.
            </div>
          )}

          {!isLoadingQueue && queue.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                  <tr>
                    <th className="p-3">Pos</th>
                    <th className="p-3">Sample ID</th>
                    <th className="p-3">Hospital ID</th>
                    <th className="p-3">Patient Name</th>
                    <th className="p-3">Test Requested</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Ordered Time</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {queue.map((item) => {
                    const isUrgent = item.priority === 'URGENT'
                    return (
                      <tr
                        key={item.order_id}
                        className={`hover:bg-gray-50/80 transition ${
                          isUrgent ? 'bg-red-50/40' : ''
                        }`}
                      >
                        <td className="p-3 font-bold text-gray-700">#{item.position}</td>
                        <td className="p-3 font-mono font-bold text-blue-900 bg-blue-50/60 rounded px-2 py-0.5 inline-block my-1 border border-blue-100">
                          {item.sample_id}
                        </td>
                        <td className="p-3 font-mono text-gray-600 font-medium">{item.hospital_id}</td>
                        <td className="p-3 font-bold text-gray-900">{item.patient_name}</td>
                        <td className="p-3 font-medium text-gray-800">
                          {item.test_name}
                          <span className="block text-[10px] text-gray-400">{item.test_category}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isUrgent ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            item.status === 'ORDERED' ? 'bg-yellow-100 text-yellow-800' :
                            item.status === 'SAMPLE_COLLECTED' ? 'bg-blue-100 text-blue-800' :
                            item.status === 'PROCESSING' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 text-[11px]">
                          {new Date(item.ordered_at).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === 'ORDERED' && isTechnician && (
                              <button
                                onClick={() => updateStatusMutation.mutate({ orderId: item.order_id, status: 'SAMPLE_COLLECTED' })}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] px-2.5 py-1 rounded-lg transition"
                              >
                                🩸 Collect Sample
                              </button>
                            )}

                            {item.status === 'SAMPLE_COLLECTED' && isTechnician && (
                              <button
                                onClick={() => updateStatusMutation.mutate({ orderId: item.order_id, status: 'PROCESSING' })}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] px-2.5 py-1 rounded-lg transition"
                              >
                                ⚙️ Start Processing
                              </button>
                            )}

                            {['PROCESSING', 'SAMPLE_COLLECTED', 'AWAITING_VERIFICATION'].includes(item.status) && isTechnician && (
                              <button
                                onClick={() => handleOpenResultModal(item)}
                                className="bg-green-700 hover:bg-green-800 text-white font-semibold text-[11px] px-2.5 py-1 rounded-lg transition shadow-xs"
                              >
                                📝 Enter Results
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION C — LAB REPORTS & DOCTOR VERIFICATION */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📊</span> Laboratory Reports Repository
              </h2>
              <p className="text-xs text-gray-500">
                {isPatient ? 'Viewing your completed and clinically verified laboratory reports.' : 'Review draft results, doctor verification status, and finalized clinical reports.'}
              </p>
            </div>

            {!isPatient && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium">Filter:</span>
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg p-1.5 text-xs bg-gray-50 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AWAITING_VERIFICATION">⏳ Awaiting Verification</option>
                  <option value="VERIFIED">✅ Doctor Verified (Final)</option>
                  <option value="REJECTED">❌ Doctor Rejected</option>
                  <option value="CRITICAL">⚠️ Critical Results</option>
                </select>
              </div>
            )}
          </div>

          {isLoadingReports && (
            <div className="py-12 text-center text-gray-500 text-xs font-medium">
              Loading laboratory reports...
            </div>
          )}

          {!isLoadingReports && filteredReportsList.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-xs font-medium">
              No lab reports found.
            </div>
          )}

          {!isLoadingReports && filteredReportsList.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReportsList.map((r) => {
                const isVerified = r.report_status === 'VERIFIED'
                const isAwaiting = r.report_status === 'AWAITING_VERIFICATION'
                const isRejected = r.report_status === 'REJECTED'

                return (
                  <div
                    key={r.id}
                    className={`rounded-2xl p-5 border space-y-3 transition shadow-xs hover:shadow-md flex flex-col justify-between ${
                      r.has_critical_result
                        ? 'border-red-300 bg-red-50/30'
                        : isVerified
                        ? 'border-green-200 bg-green-50/20'
                        : isAwaiting
                        ? 'border-yellow-200 bg-yellow-50/30'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded">
                          {r.sample_id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isVerified ? 'bg-green-100 text-green-800 border border-green-300' :
                          isAwaiting ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                          isRejected ? 'bg-red-100 text-red-800 border border-red-300' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {r.report_status.replace('_', ' ')}
                        </span>
                      </div>

                      {r.has_critical_result && (
                        <div className="bg-red-100 text-red-900 border border-red-300 p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <span>🚨</span> Critical Result — Doctor Review Required
                        </div>
                      )}

                      <h3 className="font-bold text-gray-900 text-sm">{r.test_name}</h3>

                      <div className="text-xs space-y-1 text-gray-600 bg-white/80 p-2.5 rounded-xl border border-gray-100">
                        <div><span className="font-semibold text-gray-800">Patient:</span> {r.patient_name} ({r.hospital_id})</div>
                        <div><span className="font-semibold text-gray-800">Technician:</span> {r.technician_name}</div>
                        {r.verified_by_doctor_name && (
                          <div className="text-green-800 font-medium">
                            <span className="font-semibold">Verified by:</span> {r.verified_by_doctor_name}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 pt-0.5">
                          Date: {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenReportModal(r)}
                        className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs py-2 rounded-xl transition text-center shadow-xs"
                      >
                        📄 View Report
                      </button>

                      {isDoctor && isAwaiting && (
                        <button
                          onClick={() => handleOpenVerifyModal(r)}
                          className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs py-2 rounded-xl transition text-center shadow-sm"
                        >
                          🩺 Doctor Verify
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1 — RESULT ENTRY MODAL (FOR LAB TECHNICIAN) */}
      {/* ========================================================================= */}
      {showResultModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-blue-400/30 text-blue-200 font-bold px-2 py-0.5 rounded uppercase">
                  Sample ID: {selectedOrder.sample_id}
                </span>
                <h3 className="text-lg font-bold mt-1">Enter Results: {selectedOrder.test_name}</h3>
                <p className="text-xs text-blue-200">Patient: {selectedOrder.patient_name} ({selectedOrder.hospital_id})</p>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="text-white/80 hover:text-white text-xl font-bold bg-white/10 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitResultsForm} className="p-6 flex-1 overflow-y-auto space-y-5 text-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-gray-900 text-sm">Structured Parameters Table</span>
                  <button
                    type="button"
                    onClick={handleAddParameterRow}
                    className="bg-blue-50 text-blue-700 font-semibold px-3 py-1 rounded-lg hover:bg-blue-100 transition"
                  >
                    ➕ Add Parameter Row
                  </button>
                </div>

                <div className="space-y-2">
                  {parameters.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                      <div className="col-span-3">
                        <label className="text-[10px] text-gray-500 font-medium">Parameter</label>
                        <input
                          type="text"
                          required
                          value={p.parameter_name}
                          onChange={(e) => handleParameterChange(idx, 'parameter_name', e.target.value)}
                          placeholder="e.g. Hemoglobin"
                          className="w-full border rounded p-1.5 bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-gray-500 font-medium">Result Value *</label>
                        <input
                          type="text"
                          required
                          value={p.result_value}
                          onChange={(e) => handleParameterChange(idx, 'result_value', e.target.value)}
                          placeholder="e.g. 13.5"
                          className="w-full border rounded p-1.5 bg-white text-xs font-bold text-gray-900"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-500 font-medium">Unit</label>
                        <input
                          type="text"
                          value={p.unit}
                          onChange={(e) => handleParameterChange(idx, 'unit', e.target.value)}
                          placeholder="g/dL"
                          className="w-full border rounded p-1.5 bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-500 font-medium">Ref Range</label>
                        <input
                          type="text"
                          value={p.reference_range}
                          onChange={(e) => handleParameterChange(idx, 'reference_range', e.target.value)}
                          placeholder="13-17"
                          className="w-full border rounded p-1.5 bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 font-medium">Flag</label>
                          <select
                            value={p.flag}
                            onChange={(e) => handleParameterChange(idx, 'flag', e.target.value)}
                            className={`w-full border rounded p-1 text-xs font-bold ${
                              p.flag === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                              p.flag === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                              p.flag === 'LOW' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}
                          >
                            <option value="NORMAL">NORMAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="LOW">LOW</option>
                            <option value="CRITICAL">CRITICAL</option>
                          </select>
                        </div>
                        {parameters.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParameterRow(idx)}
                            className="text-red-500 hover:text-red-700 font-bold p-1 mt-3"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Result Summary / Technician Observations</label>
                <textarea
                  rows={3}
                  value={resultSummary}
                  onChange={(e) => setResultSummary(e.target.value)}
                  placeholder="Summary of observations, e.g. Mild leucocytosis noted."
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                🔒 <b>Verification Policy:</b> Submitting results sets report status to <i>AWAITING_VERIFICATION</i>. A Doctor must review and approve this report before it becomes FINAL and links to the Central EHR.
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="px-4 py-2 border rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={() => setReportSubmitStatus('AWAITING_VERIFICATION')}
                  disabled={submitReportMutation.isPending}
                  className="px-6 py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded-xl transition shadow-md flex items-center gap-2"
                >
                  <span>📨</span>
                  <span>{submitReportMutation.isPending ? 'Submitting...' : 'Submit for Doctor Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 — DOCTOR VERIFICATION MODAL (FOR DOCTORS) */}
      {/* ========================================================================= */}
      {showVerifyModal && selectedReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-blue-400/30 text-blue-200 font-bold px-2 py-0.5 rounded uppercase">
                  Doctor Clinical Review
                </span>
                <h3 className="text-lg font-bold mt-1">Verify: {selectedReport.test_name}</h3>
                <p className="text-xs text-blue-200">Sample ID: {selectedReport.sample_id} • Patient: {selectedReport.patient_name}</p>
              </div>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="text-white/80 hover:text-white text-xl font-bold bg-white/10 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              {selectedReport.has_critical_result && (
                <div className="bg-red-500 text-white p-3 rounded-xl font-bold flex items-center gap-2 animate-pulse">
                  <span className="text-lg">🚨</span>
                  <div>
                    <div>CRITICAL RESULT DETECTED</div>
                    <div className="text-[11px] font-normal">One or more parameters fall into critical ranges. Requires immediate clinical attention.</div>
                  </div>
                </div>
              )}

              {/* Parameter Table Review */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2">
                <span className="font-bold text-gray-900 block text-xs border-b pb-2">Laboratory Observations & Parameters</span>
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
                    {selectedReport.parameters?.map((p, idx) => (
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

              {selectedReport.result_summary && (
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <span className="font-bold text-gray-700 block mb-1">Technician Result Summary:</span>
                  <p className="text-gray-800 leading-relaxed">{selectedReport.result_summary}</p>
                </div>
              )}

              {!isRejecting ? (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Doctor Verification Notes</label>
                  <textarea
                    rows={2}
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Results reviewed. Approved for central EHR."
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-red-700 block mb-1">Reason for Rejection *</label>
                  <textarea
                    rows={2}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Specify why report is rejected (e.g. Inconsistent hemoglobin value, re-test required)..."
                    className="w-full border border-red-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-3 border-t flex items-center justify-between gap-3">
                {!isRejecting ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejecting(true)}
                      className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs rounded-xl transition"
                    >
                      ❌ Reject Report
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifySubmit(true)}
                      disabled={verifyReportMutation.isPending}
                      className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-1.5"
                    >
                      <span>✅</span>
                      <span>{verifyReportMutation.isPending ? 'Verifying & Linking to EHR...' : 'Approve & Link to EHR'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejecting(false)}
                      className="px-4 py-2 border text-gray-600 font-medium rounded-xl hover:bg-gray-100 text-xs"
                    >
                      Cancel Rejection
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifySubmit(false)}
                      disabled={verifyReportMutation.isPending}
                      className="px-6 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition shadow-md"
                    >
                      Confirm Rejection
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3 — FORMAL HOSPITAL LAB REPORT VIEWER / PRINT VIEW */}
      {/* ========================================================================= */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 print:shadow-none print:max-w-none print:w-full">
            {/* Header Controls (Hidden on print) */}
            <div className="bg-gray-900 text-white p-4 flex items-center justify-between print:hidden">
              <span className="font-bold text-sm">MediCare HMS — Formal Laboratory Report</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                >
                  🖨️ Print / Download Report
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-white/80 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Print Body */}
            <div className="p-8 flex-1 overflow-y-auto space-y-6 text-xs text-gray-900 bg-white">
              {/* Report Letterhead Header */}
              <div className="border-b-2 border-blue-900 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-blue-950 uppercase tracking-tight">MediCare Diagnostic Laboratories</h1>
                  <p className="text-[11px] text-gray-600">Central Pathology & Clinical Biochemistry Unit</p>
                  <p className="text-[10px] text-gray-400">MediCare Hospital Complex • Phone: +1 (800) 555-MEDICARE</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold bg-blue-100 text-blue-950 px-3 py-1 rounded-md border border-blue-300 inline-block">
                    SAMPLE ID: {selectedReport.sample_id}
                  </span>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Report Date: {new Date(selectedReport.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Patient & Order Details Header Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] font-medium uppercase">Patient Name:</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedReport.patient_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-medium uppercase">Hospital ID:</span>
                  <span className="font-mono font-bold text-blue-900">{selectedReport.hospital_id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-medium uppercase">Test Name:</span>
                  <span className="font-bold text-gray-900">{selectedReport.test_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-medium uppercase">Category:</span>
                  <span className="font-medium text-gray-800">{selectedReport.test_category}</span>
                </div>
              </div>

              {selectedReport.has_critical_result && (
                <div className="bg-red-500 text-white p-2.5 rounded-xl font-bold text-center text-xs">
                  🚨 CRITICAL RESULT NOTIFIED TO ATTENDING PHYSICIAN
                </div>
              )}

              {/* Parameter Results Table */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900 border-b pb-1 text-xs uppercase tracking-wider">Laboratory Observations</h3>
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 font-bold border-y border-gray-300">
                    <tr>
                      <th className="p-2.5">Test Parameter</th>
                      <th className="p-2.5">Observed Result</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5">Biological Reference Range</th>
                      <th className="p-2.5 text-center">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedReport.parameters?.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-2.5 font-semibold text-gray-900">{p.parameter_name}</td>
                        <td className="p-2.5 font-extrabold text-gray-950 text-sm">{p.result_value}</td>
                        <td className="p-2.5 text-gray-600">{p.unit || '—'}</td>
                        <td className="p-2.5 text-gray-600 font-mono text-[11px]">{p.reference_range || '—'}</td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-block ${
                            p.flag === 'CRITICAL' ? 'bg-red-600 text-white' :
                            p.flag === 'HIGH' ? 'bg-orange-100 text-orange-900 border border-orange-300' :
                            p.flag === 'LOW' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                            'bg-green-100 text-green-900'
                          }`}>
                            {p.flag}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedReport.result_summary && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-bold text-gray-800 text-xs block">Technician Summary:</span>
                  <p className="text-gray-700 text-xs leading-relaxed">{selectedReport.result_summary}</p>
                </div>
              )}

              {/* Doctor Verification & Sign-off Box */}
              <div className="pt-4 border-t-2 border-gray-300 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">Laboratory Technician:</span>
                  <span className="font-bold text-gray-900 text-xs">{selectedReport.technician_name}</span>
                </div>

                <div className="text-right bg-green-50/80 border border-green-200 p-3 rounded-2xl">
                  <span className="text-[10px] text-green-800 uppercase block font-bold">Clinical Doctor Sign-Off:</span>
                  <span className="font-extrabold text-green-950 text-xs block">
                    {selectedReport.verified_by_doctor_name || 'Pending Doctor Review'}
                  </span>
                  <span className="text-[10px] text-green-700 block">
                    Status: <b>{selectedReport.verification_status}</b>
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="pt-4 border-t text-[10px] text-gray-400 text-center leading-normal">
                This diagnostic report is digitally generated by MediCare HMS Laboratory Module and clinically validated by authorized medical staff. Please consult your physician for medical interpretation.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
