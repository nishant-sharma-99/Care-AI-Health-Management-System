import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login } = useAuth()
  const navigate = useNavigate()

  const onSubmit = async (data) => {
    try {
      const form = new FormData()
      form.append('username', data.username)
      form.append('password', data.password)
      const res = await api.post('/auth/login', form)
      login(res.data.user, res.data.access_token)
      navigate('/app')
    } catch (e) {
      alert(e.response?.data?.detail || e.message || 'Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏥</div>
          <h1 className="text-2xl font-bold text-blue-900">HMS Login</h1>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input {...register('username', { required: true })}
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.username && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" {...register('password', { required: true })}
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.password && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
          <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg font-semibold">
            Sign In
          </button>
        </form>
        <p className="text-center text-sm mt-4 text-gray-500">
          No account? <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  )
}
