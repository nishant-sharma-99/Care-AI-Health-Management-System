import { useQuery } from '@tanstack/react-query'
import api from '../api/client'

export default function Reports() {
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: () => api.get('/reports/summary').then(r => r.data), retry: false })
  const { data: appointments = [] } = useQuery({ queryKey: ['report-appointments'], queryFn: () => api.get('/reports/appointments').then(r => r.data), retry: false })
  const { data: stock = [] } = useQuery({ queryKey: ['report-stock'], queryFn: () => api.get('/reports/pharmacy-stock').then(r => r.data), retry: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      {summary && (
        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="font-semibold text-gray-700 mb-3">Hospital Summary</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {Object.entries(summary).map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</p>
                <p className="text-xl font-bold">{typeof v === 'number' ? v.toFixed ? v.toFixed(2) : v : v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow overflow-auto">
        <h2 className="font-semibold text-gray-700 p-4 border-b">Appointment Schedule Report</h2>
        <table className="w-full text-sm">
          <thead className="bg-green-50 text-gray-600">
            <tr>{['ID', 'Patient', 'Doctor', 'Date', 'Time', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {appointments.map(a => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{a.id}</td>
                <td className="px-4 py-3">{a.patient_id}</td>
                <td className="px-4 py-3">{a.doctor_id}</td>
                <td className="px-4 py-3">{a.date}</td>
                <td className="px-4 py-3">{a.time}</td>
                <td className="px-4 py-3">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-2xl shadow overflow-auto">
        <h2 className="font-semibold text-gray-700 p-4 border-b">Pharmacy Stock Report</h2>
        <table className="w-full text-sm">
          <thead className="bg-purple-50 text-gray-600">
            <tr>{['ID', 'Drug', 'Qty', 'Price', 'Expiry', 'Alert'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {stock.map(d => (
              <tr key={d.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{d.id}</td>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.quantity}</td>
                <td className="px-4 py-3">${d.unit_price}</td>
                <td className="px-4 py-3">{d.expiry_date}</td>
                <td className="px-4 py-3">
                  {d.quantity < 10 && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Low Stock</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
