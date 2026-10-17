import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

function StatCard({ label, value, color }) {
  return (
    <div className={`bg-white rounded-2xl shadow p-6 border-l-4 ${color}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isPatient = user?.role === 'patient'

  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
    enabled: isAdmin,
    retry: false,
  })

  const { data: myAppointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(r => r.data),
    enabled: isPatient,
    retry: false,
  })

  const { data: myInvoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then(r => r.data),
    enabled: isPatient,
    retry: false,
  })

  const { data: myProfile } = useQuery({
    queryKey: ['my-patient-profile'],
    queryFn: () => api.get('/patients/me').then(r => r.data).catch(() => null),
    enabled: isPatient,
    retry: false,
  })

  if (isPatient) {
    const pending = myInvoices.filter(i => i.status === 'unpaid').length
    const scheduled = myAppointments.filter(a => a.status === 'scheduled').length
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Welcome, {user.username} 👋</h1>
          <p className="text-sm text-gray-500">Access your digital hospital identity and appointments</p>
        </div>

        {/* Patient Digital Identity Card */}
        {myProfile && (
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-blue-700">
            <div className="space-y-3 flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-semibold text-blue-200">
                <span>🏥 Official Patient Digital ID</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold">{myProfile.name}</h2>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                  <span className="font-mono text-lg font-bold bg-white text-blue-950 px-3 py-0.5 rounded-lg">
                    {myProfile.hospital_id || `MED${String(myProfile.id).padStart(6, '0')}`}
                  </span>
                </div>
              </div>
              <div className="text-xs text-blue-200 space-y-2">
                <p>Contact: {myProfile.contact || 'Not provided'} • Age: {myProfile.age || '—'} yrs</p>
                <div className="pt-1">
                  <Link
                    to="/app/ehr"
                    className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-sm"
                  >
                    <span>📋</span> View My EHR / Medical Records
                  </Link>
                </div>
              </div>
            </div>
            {myProfile.qr_code && (
              <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-white flex flex-col items-center">
                <img 
                  src={myProfile.qr_code} 
                  alt={`QR for ${myProfile.hospital_id}`} 
                  className="w-32 h-32"
                />
                <span className="text-[10px] text-gray-600 font-mono font-bold mt-1 tracking-wider">
                  {myProfile.hospital_id}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <StatCard label="My Appointments" value={myAppointments.length} color="border-blue-500" />
          <StatCard label="Scheduled" value={scheduled} color="border-green-500" />
          <StatCard label="Pending Invoices" value={pending} color="border-red-500" />
          <StatCard label="Total Invoices" value={myInvoices.length} color="border-yellow-500" />
        </div>
      </div>
    )
  }

  const { data: labQueue = [] } = useQuery({
    queryKey: ['lab-queue-summary'],
    queryFn: () => api.get('/lab/queue').then(r => r.data).catch(() => []),
    enabled: !isPatient,
    retry: false
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      {!isAdmin && (
        <p className="text-sm text-gray-500 mb-4">Full statistics are available to admins only.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label="Total Patients" value={data?.total_patients} color="border-blue-500" />
        <StatCard label="Total Appointments" value={data?.total_appointments} color="border-green-500" />
        <StatCard label="Pending Lab Work" value={labQueue.length} color="border-indigo-500" />
        <StatCard label="Drugs in Stock" value={data?.total_drugs} color="border-purple-500" />
        <StatCard label="Total Revenue ($)" value={data?.total_revenue?.toFixed(2)} color="border-yellow-500" />
        <StatCard label="Pending Invoices" value={data?.pending_invoices} color="border-red-500" />
      </div>
    </div>
  )
}
