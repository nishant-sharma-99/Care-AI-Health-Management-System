import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

const allNavItems = [
  { to: '/app', label: '🏠 Dashboard', roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'receptionist', 'patient', 'lab_technician'] },
  { to: '/app/persona', label: '🩺 Persona Triage', roles: ['admin', 'doctor', 'nurse', 'persona'] },
  { to: '/app/patients', label: '🧑⚕️ Patients', roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
  { to: '/app/laboratory', label: '🧪 Laboratory', roles: ['admin', 'doctor', 'nurse', 'lab_technician', 'patient'] },
  { to: '/app/ehr', label: '📋 Medical Records', roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'patient'] },
  { to: '/app/appointments', label: '📅 Appointments', roles: ['admin', 'doctor', 'receptionist', 'patient'] },
  { to: '/app/pharmacy', label: '💊 Pharmacy', roles: ['admin', 'pharmacist', 'doctor'] },
  { to: '/app/billing', label: '💳 Billing', roles: ['admin', 'receptionist', 'patient'] },
  { to: '/app/reports', label: '📊 Reports', roles: ['admin', 'doctor', 'receptionist', 'pharmacist'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = allNavItems.filter(item => item.roles.includes(user?.role))

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-blue-700 flex items-center gap-2">
          <img src={logo} alt="logo" className="h-8 w-auto" />
          <span>MediCare HMS</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg text-sm transition ${isActive ? 'bg-blue-600' : 'hover:bg-blue-700'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-blue-700 text-sm">
          <p className="mb-2 text-blue-200">{user?.username} <span className="capitalize">({user?.role})</span></p>
          <button onClick={handleLogout} className="w-full bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-white">
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
