import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../utils/api'
import { useConfigStore } from '../store/configStore'
import toast from 'react-hot-toast'
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useConfigStore()

  const [formData, setFormData] = useState({
    subdomain: '',
    email:     '',
    password:  ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { subdomain, email, password } = formData
    if (!subdomain.trim() || !email.trim() || !password) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      setLoading(true)
      // auth.login() already stores the JWT via tokenStorage.set()
      const data = await auth.login({
        subdomain: subdomain.trim().toLowerCase(),
        email:     email.trim().toLowerCase(),
        password
      })

      // Update store with auth state
      login(data.token, data.tenant)
      toast.success(`Welcome back, ${data.tenant?.name || 'there'}!`)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid credentials. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🐾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ClickPawPay</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Subdomain
            </label>
            <input
              type="text"
              name="subdomain"
              value={formData.subdomain}
              onChange={handleChange}
              placeholder="your-company"
              className="input w-full"
              autoComplete="organization"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="input w-full"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input w-full pr-10"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <LogIn className="w-4 h-4" />
            }
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{' '}
          <Link to="/setup" className="text-primary-600 hover:text-primary-700 font-medium">
            Create one
          </Link>
        </p>

      </div>
    </div>
  )
}
