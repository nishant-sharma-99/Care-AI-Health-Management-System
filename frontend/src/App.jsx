import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Appointments from './pages/Appointments'
import Pharmacy from './pages/Pharmacy'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import EHR from './pages/EHR'
import Persona from './pages/Persona'
import Laboratory from './pages/Laboratory'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected app routes */}
          <Route path="/app" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="persona" element={<Persona />} />
            <Route path="patients" element={<Patients />} />
            <Route path="laboratory" element={<Laboratory />} />
            <Route path="ehr" element={<EHR />} />
            <Route path="ehr/:patientId" element={<EHR />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="pharmacy" element={<Pharmacy />} />
            <Route path="billing" element={<Billing />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
