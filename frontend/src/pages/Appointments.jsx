import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function Appointments() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const role = user?.role
  const isPatient = role === 'patient'
  const canManage = ['admin', 'receptionist', 'doctor'].includes(role)
  const canAddDoctor = ['admin', 'receptionist'].includes(role)

  const { data: appointments = [] } = useQuery({ queryKey: ['appointments'], queryFn: () => api.get('/appointments').then(r => r.data) })
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => api.get('/patients').then(r => r.data), enabled: !isPatient })
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: () => api.get('/doctors').then(r => r.data) })
  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: () => api.get('/patients/me').then(r => r.data), enabled: isPatient, retry: false })

  const { register, handleSubmit, reset } = useForm()
  const { register: regDoc, handleSubmit: handleDoc, reset: resetDoc } = useForm()

  const create = useMutation({
    mutationFn: (data) => api.post('/appointments', data),
    onSuccess: () => { qc.invalidateQueries(['appointments']); reset() },
    onError: (e) => alert(e.response?.data?.detail || 'Failed to book appointment'),
  })

  const addDoctor = useMutation({
    mutationFn: (data) => api.post('/doctors', data),
    onSuccess: () => { qc.invalidateQueries(['doctors']); resetDoc() },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/appointments/${id}/status?status=${status}`),
    onSuccess: () => qc.invalidateQueries(['appointments']),
  })

  const getName = (list, id, field = 'name') => list.find(i => i.id === Number(id))?.[field] || id

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>

      {canAddDoctor && (
        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="font-semibold text-gray-700 mb-3">Add Doctor</h2>
          <form onSubmit={handleDoc(d => addDoctor.mutate(d))} className="grid grid-cols-3 gap-4">
            {[['name', 'Name'], ['specialization', 'Specialization'], ['contact', 'Contact']].map(([f, l]) => (
              <div key={f}>
                <label className="text-sm font-medium text-gray-600">{l}</label>
                <input {...regDoc(f, { required: f === 'name' })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="col-span-3">
              <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm">Add Doctor</button>
            </div>
          </form>
        </div>
      )}

      {/* Patient self-booking form */}
      {isPatient && (
        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="font-semibold text-gray-700 mb-3">Book an Appointment</h2>
          {!myProfile ? (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              ⚠️ Your account is not linked to a patient profile yet. Please ask a receptionist or admin to register your patient profile and link it to your account.
            </p>
          ) : (
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Booking as: <span className="font-medium text-gray-800">{myProfile.name}</span></p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Doctor</label>
                <select {...register('doctor_id', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select doctor</option>
                  {doctors.length === 0 && <option disabled>No doctors available yet</option>}
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Date</label>
                <input type="date" {...register('date', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Time</label>
                <input type="time" {...register('time', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Notes</label>
                <input {...register('notes')} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <button type="submit" className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">Book Appointment</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Staff booking form */}
      {canManage && (
        <form onSubmit={handleSubmit(d => create.mutate(d))} className="bg-white p-4 rounded-2xl shadow grid grid-cols-2 gap-4">
          <h2 className="col-span-2 font-semibold text-gray-700">Book Appointment</h2>
          <div>
            <label className="text-sm font-medium text-gray-600">Patient</label>
            <select {...register('patient_id', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select patient</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Doctor</label>
            <select {...register('doctor_id', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select doctor</option>
              {doctors.length === 0 && <option disabled>No doctors added yet</option>}
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Date</label>
            <input type="date" {...register('date', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Time</label>
            <input type="time" {...register('time', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-600">Notes</label>
            <input {...register('notes')} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <button type="submit" className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">Book Appointment</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 text-gray-600">
            <tr>
              {['ID', 'Patient', 'Doctor', 'Date', 'Time', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No appointments found</td></tr>
            )}
            {appointments.map(a => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{a.id}</td>
                <td className="px-4 py-3">{isPatient ? (myProfile?.name || a.patient_id) : getName(patients, a.patient_id)}</td>
                <td className="px-4 py-3">{getName(doctors, a.doctor_id)}</td>
                <td className="px-4 py-3">{a.date}</td>
                <td className="px-4 py-3">{a.time}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[a.status] || ''}`}>{a.status}</span>
                </td>
                <td className="px-4 py-3 flex gap-1 flex-wrap">
                  {canManage && ['completed', 'cancelled'].map(s => (
                    <button key={s} onClick={() => updateStatus.mutate({ id: a.id, status: s })}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 capitalize">{s}</button>
                  ))}
                  {isPatient && a.status === 'scheduled' && (
                    <button onClick={() => updateStatus.mutate({ id: a.id, status: 'cancelled' })}
                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
