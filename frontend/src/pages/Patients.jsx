import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Patients() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const canManage = ['admin', 'receptionist', 'doctor', 'nurse'].includes(user?.role)
  const [editing, setEditing] = useState(null)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: patients = [] } = useQuery({ 
    queryKey: ['patients'], 
    queryFn: () => api.get('/patients').then(r => r.data) 
  })
  const { register, handleSubmit, reset, setValue } = useForm()

  const save = useMutation({
    mutationFn: (data) => {
      const payload = { 
        ...data, 
        age: data.age ? Number(data.age) : null, 
        user_id: data.user_id ? Number(data.user_id) : null 
      }
      return editing ? api.put(`/patients/${editing}`, payload) : api.post('/patients', payload)
    },
    onSuccess: () => { 
      qc.invalidateQueries(['patients'])
      reset()
      setEditing(null) 
    },
    onError: (e) => alert(e.response?.data?.detail || 'Failed to save patient'),
  })

  const startEdit = (p) => {
    setEditing(p.id)
    Object.entries(p).forEach(([k, v]) => setValue(k, v))
  }

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase()
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.hospital_id && p.hospital_id.toLowerCase().includes(q)) ||
      (p.contact && p.contact.toLowerCase().includes(q))
    )
  })

  const handlePrintIdCard = () => {
    window.print()
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Patients Directory</h1>
          <p className="text-sm text-gray-500">Manage patient records & digital identities</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by Name, Hospital ID, Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      {canManage && (
        <form onSubmit={handleSubmit(d => save.mutate(d))} className="bg-white p-5 rounded-2xl shadow mb-6 grid grid-cols-2 gap-4 border border-blue-50">
          <div className="col-span-2 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-lg">
              {editing ? 'Edit Patient Record' : 'Register New Patient'}
            </h2>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              ✨ Unique Hospital ID & Digital QR Identity automatically generated
            </span>
          </div>

          {[['name', 'Full Name'], ['age', 'Age'], ['gender', 'Gender'], ['contact', 'Contact Number'], ['address', 'Address']].map(([f, l]) => (
            <div key={f}>
              <label className="text-sm font-medium text-gray-600">{l}</label>
              <input 
                {...register(f)} 
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder={f === 'name' ? 'e.g. John Doe' : ''}
              />
            </div>
          ))}

          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-600">Medical History</label>
            <textarea 
              {...register('medical_history')} 
              rows={2} 
              placeholder="Allergies, chronic illnesses, surgeries..."
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-600">
              Link to User Account <span className="text-gray-400 font-normal">(User ID — optional, enables patient portal login)</span>
            </label>
            <input 
              type="number" 
              {...register('user_id')} 
              placeholder="Leave blank if not linked to a user account" 
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div className="col-span-2 flex gap-2 pt-2">
            <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
              {editing ? 'Update Patient' : 'Register Patient'}
            </button>
            {editing && (
              <button 
                type="button" 
                onClick={() => { setEditing(null); reset() }} 
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow overflow-hidden border border-gray-100">
        <table className="w-full text-sm text-left">
          <thead className="bg-blue-50/70 text-gray-700 font-semibold border-b border-blue-100">
            <tr>
              <th className="px-4 py-3.5">Hospital ID</th>
              <th className="px-4 py-3.5">Digital ID / QR</th>
              <th className="px-4 py-3.5">Name</th>
              <th className="px-4 py-3.5">Age / Gender</th>
              <th className="px-4 py-3.5">Contact</th>
              <th className="px-4 py-3.5">User ID</th>
              {canManage && <th className="px-4 py-3.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPatients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {searchQuery ? 'No patients found matching your search.' : 'No patients registered yet.'}
                </td>
              </tr>
            )}
            {filteredPatients.map(p => (
              <tr key={p.id} className="hover:bg-blue-50/30 transition">
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                    {p.hospital_id || `MED${String(p.id).padStart(6, '0')}`}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {p.qr_code ? (
                    <button
                      onClick={() => setSelectedPatient(p)}
                      title="Click to view full digital patient card & scannable QR"
                      className="group flex items-center gap-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-1 pr-2 transition cursor-pointer"
                    >
                      <img 
                        src={p.qr_code} 
                        alt={`QR ${p.hospital_id}`} 
                        className="w-8 h-8 rounded border border-gray-200 bg-white group-hover:scale-105 transition"
                      />
                      <span className="text-xs font-medium text-blue-700 group-hover:underline">View ID Card</span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3.5 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3.5 text-gray-600">
                  {p.age ? `${p.age} yrs` : '—'} {p.gender ? `• ${p.gender}` : ''}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{p.contact || '—'}</td>
                <td className="px-4 py-3.5 text-gray-500 font-mono text-xs">
                  {p.user_id ? `#${p.user_id}` : <span className="text-gray-400 font-sans">—</span>}
                </td>
                {canManage && (
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <Link
                      to={`/app/ehr/${p.id}`}
                      className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs hover:underline"
                    >
                      EHR Record
                    </Link>
                    <button 
                      onClick={() => setSelectedPatient(p)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-xs hover:underline"
                    >
                      Digital ID
                    </button>
                    <button 
                      onClick={() => startEdit(p)} 
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Digital Patient Identity Card Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* ID Card Header */}
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 text-center relative">
              <button 
                onClick={() => setSelectedPatient(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
              <div className="text-3xl mb-1">🏥</div>
              <h3 className="text-lg font-bold tracking-wide">MediCare Hospital</h3>
              <p className="text-xs text-blue-200 font-medium uppercase tracking-wider">Digital Patient Identity Card</p>
            </div>

            {/* ID Card Body */}
            <div className="p-6 text-center">
              {/* QR Code */}
              <div className="inline-block p-3 bg-white rounded-2xl shadow-inner border-2 border-dashed border-blue-200 mb-4">
                {selectedPatient.qr_code ? (
                  <img 
                    src={selectedPatient.qr_code} 
                    alt={`QR Code for ${selectedPatient.hospital_id}`} 
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-sm">QR Not Generated</div>
                )}
              </div>

              {/* Patient Identifiers */}
              <div className="space-y-1 mb-4">
                <span className="inline-block bg-blue-100 text-blue-900 text-sm font-mono font-bold px-3 py-1 rounded-full border border-blue-200">
                  {selectedPatient.hospital_id || `MED${String(selectedPatient.id).padStart(6, '0')}`}
                </span>
                <h2 className="text-xl font-bold text-gray-900 pt-1">{selectedPatient.name}</h2>
              </div>

              {/* Patient Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-left bg-gray-50 p-4 rounded-xl text-xs text-gray-700 mb-4 border border-gray-100">
                <div>
                  <span className="text-gray-400 block font-medium">Age / Gender:</span>
                  <span className="font-semibold">{selectedPatient.age || '—'} yrs / {selectedPatient.gender || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Contact:</span>
                  <span className="font-semibold">{selectedPatient.contact || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block font-medium">Address:</span>
                  <span className="font-semibold">{selectedPatient.address || '—'}</span>
                </div>
                {selectedPatient.user_id && (
                  <div className="col-span-2">
                    <span className="text-gray-400 block font-medium">Linked Portal User:</span>
                    <span className="font-semibold font-mono">User ID #{selectedPatient.user_id}</span>
                  </div>
                )}
              </div>

              {/* Security note */}
              <p className="text-[11px] text-gray-400 italic mb-5">
                🔒 Verified Hospital Token: Scannable QR contains ONLY the Hospital ID for secure lookup. Medical history remains encrypted in accordance with privacy compliance.
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handlePrintIdCard}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition shadow-sm flex items-center justify-center gap-2"
                >
                  🖨️ Print / Save Card
                </button>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-5 rounded-xl text-sm font-medium transition"
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
