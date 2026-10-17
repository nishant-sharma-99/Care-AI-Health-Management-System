import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Billing() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const role = user?.role
  const isPatient = role === 'patient'
  const canCreate = ['admin', 'receptionist'].includes(role)

  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => api.get('/billing/invoices').then(r => r.data) })
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => api.get('/patients').then(r => r.data), enabled: !isPatient })
  const { register, handleSubmit, reset } = useForm()

  const create = useMutation({
    mutationFn: (data) => api.post('/billing/invoices', { ...data, amount: Number(data.amount) }),
    onSuccess: () => { qc.invalidateQueries(['invoices']); reset() },
  })

  const pay = useMutation({
    mutationFn: (id) => api.post(`/billing/invoices/${id}/pay`),
    onSuccess: () => qc.invalidateQueries(['invoices']),
  })

  const getName = (id) => patients.find(p => p.id === Number(id))?.name || id

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Billing</h1>

      {canCreate && (
        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="font-semibold text-gray-700 mb-3">Create Invoice</h2>
          <form onSubmit={handleSubmit(d => create.mutate(d))} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Patient</label>
              <select {...register('patient_id', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Amount ($)</label>
              <input type="number" step="0.01" {...register('amount', { required: true })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-600">Description</label>
              <input {...register('description')} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <button type="submit" className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm">Create Invoice</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-yellow-50 text-gray-600">
            <tr>{['ID', 'Patient', 'Amount', 'Description', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No invoices found</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{inv.id}</td>
                <td className="px-4 py-3">{isPatient ? user.username : getName(inv.patient_id)}</td>
                <td className="px-4 py-3 font-medium">${Number(inv.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-500">{inv.description}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inv.status === 'unpaid' && (
                    <button onClick={() => pay.mutate(inv.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                      {isPatient ? 'Pay Now' : 'Mark Paid'}
                    </button>
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
