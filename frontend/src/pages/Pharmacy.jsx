import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Pharmacy() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const role = user?.role
  const canManageDrugs = ['admin', 'pharmacist'].includes(role)
  const canPrescribe = ['admin', 'doctor'].includes(role)
  const canDispense = ['admin', 'pharmacist'].includes(role)
  const { data: drugs = [] } = useQuery({ queryKey: ['drugs'], queryFn: () => api.get('/pharmacy/drugs').then(r => r.data) })
  const { data: prescriptions = [] } = useQuery({ queryKey: ['prescriptions'], queryFn: () => api.get('/pharmacy/prescriptions').then(r => r.data) })
  const { register, handleSubmit, reset } = useForm()

  const addDrug = useMutation({
    mutationFn: (data) => api.post('/pharmacy/drugs', { ...data, quantity: Number(data.quantity), unit_price: Number(data.unit_price) }),
    onSuccess: () => { qc.invalidateQueries(['drugs']); reset() }
  })

  const dispense = useMutation({
    mutationFn: (id) => api.put(`/pharmacy/prescriptions/${id}/dispense`),
    onSuccess: () => { qc.invalidateQueries(['prescriptions']); qc.invalidateQueries(['drugs']) }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pharmacy</h1>
      <div className="bg-white p-4 rounded-2xl shadow">
        <h2 className="font-semibold text-gray-700 mb-3">Add Drug</h2>
        {canManageDrugs ? (
        <form onSubmit={handleSubmit(d => addDrug.mutate(d))} className="grid grid-cols-2 gap-4">
          {[['name', 'Drug Name'], ['quantity', 'Quantity'], ['unit_price', 'Unit Price ($)'], ['expiry_date', 'Expiry Date']].map(([f, l]) => (
            <div key={f}>
              <label className="text-sm font-medium text-gray-600">{l}</label>
              <input type={f === 'expiry_date' ? 'date' : f === 'quantity' || f === 'unit_price' ? 'number' : 'text'}
                {...register(f)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <div className="col-span-2">
            <button type="submit" className="bg-purple-700 text-white px-4 py-2 rounded-lg text-sm">Add Drug</button>
          </div>
        </form>
        ) : <p className="text-sm text-gray-500">Only admins and pharmacists can add drugs.</p>}
      </div>
      <div className="bg-white rounded-2xl shadow overflow-auto">
        <h2 className="font-semibold text-gray-700 p-4 border-b">Drug Inventory</h2>
        <table className="w-full text-sm">
          <thead className="bg-purple-50 text-gray-600">
            <tr>{['ID', 'Name', 'Qty', 'Price', 'Expiry'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {drugs.map(d => (
              <tr key={d.id} className={`border-t hover:bg-gray-50 ${d.quantity < 10 ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3">{d.id}</td>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.quantity}</td>
                <td className="px-4 py-3">${d.unit_price}</td>
                <td className="px-4 py-3">{d.expiry_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-2xl shadow overflow-auto">
        <h2 className="font-semibold text-gray-700 p-4 border-b">Prescriptions</h2>
        <table className="w-full text-sm">
          <thead className="bg-purple-50 text-gray-600">
            <tr>{['ID', 'Patient', 'Drug', 'Dosage', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {prescriptions.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{p.id}</td>
                <td className="px-4 py-3">{p.patient_id}</td>
                <td className="px-4 py-3">{p.drug_id}</td>
                <td className="px-4 py-3">{p.dosage}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${p.dispensed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {p.dispensed ? 'Dispensed' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {!p.dispensed && canDispense && (
                    <button onClick={() => dispense.mutate(p.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                      Dispense
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
