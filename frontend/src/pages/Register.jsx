import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api/client'

const roles = ['admin', 'doctor', 'nurse', 'pharmacist', 'receptionist', 'patient']

export default function Register() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const navigate = useNavigate()

  const onSubmit = async (data) => {
    try {
      await api.post('/auth/register', data)
      navigate('/login')
    } catch (e) {
      alert(e.response?.data?.detail || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏥</div>
          <h1 className="text-2xl font-bold text-blue-900">Create Account</h1>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {['username', 'email'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 capitalize">{field}</label>
              <input {...register(field, { required: true })}
                className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {errors[field] && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" {...register('password', { required: true })}
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.password && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select {...register('role')} className="mt-1 w-full border rounded-lg px-3 py-2">
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg font-semibold">
            Register
          </button>
        </form>
        <p className="text-center text-sm mt-4 text-gray-500">
          Have an account? <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  )
}
