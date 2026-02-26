import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth, tokenStorage } from '../utils/api'
import { useConfigStore } from '../store/configStore'
import toast from 'react-hot-toast'
import {
  Building2,
  User,
  Key,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'

const STEPS = [
  { id: 1, title: 'Company Info',       icon: Building2 },
  { id: 2, title: 'Account Credentials', icon: User      },
  { id: 3, title: 'SlickPay Key',        icon: Key       },
  { id: 4, title: 'Review & Create',     icon: Check     }
]

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/

export default function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading]         = useState(false)
  const [showPassword, setShowPassword]  = useState(false)
  const [showConfirm, setShowConfirm]    = useState(false)

  const [formData, setFormData] = useState({
    instanceName: '',
    subdomain:    '',
    email:        '',
    password:     '',
    confirmPassword: '',
    slickpayKey:  ''
  })

  const { login } = useConfigStore()
  const navigate  = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    // Auto-sanitize subdomain as user types
    if (name === 'subdomain') {
      setFormData(prev => ({ ...prev, subdomain: value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const validateStep = () => {
    switch (currentStep) {
      case 1: {
        if (!formData.instanceName.trim() || formData.instanceName.trim().length < 2) {
          toast.error('Company name must be at least 2 characters')
          return false
        }
        if (!formData.subdomain || !SUBDOMAIN_REGEX.test(formData.subdomain)) {
          toast.error('Subdomain must be 3–63 lowercase letters, numbers, or hyphens')
          return false
        }
        return true
      }
      case 2: {
        if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          toast.error('Please enter a valid email address')
          return false
        }
        if (!formData.password || formData.password.length < 8) {
          toast.error('Password must be at least 8 characters')
          return false
        }
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match')
          return false
        }
        return true
      }
      case 3: {
        if (!formData.slickpayKey.trim() || formData.slickpayKey.trim().length < 10) {
          toast.error('Please enter a valid SlickPay API key')
          return false
        }
        return true
      }
      case 4:
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep === 4) {
        handleCreate()
      } else {
        setCurrentStep(s => s + 1)
      }
    }
  }

  const handleBack = () => setCurrentStep(s => s - 1)

  const handleCreate = async () => {
    try {
      setLoading(true)
      const res = await auth.register({
        name:        formData.instanceName.trim(),
        subdomain:   formData.subdomain,
        email:       formData.email.trim().toLowerCase(),
        password:    formData.password,
        slickpayKey: formData.slickpayKey.trim()
      })

      const { token, tenant } = res.data
      // auth.register doesn't auto-store the token (only auth.login does), so store it manually
      tokenStorage.set(token)

      login(token, tenant)
      toast.success(`Welcome to ClickPawPay, ${tenant.name}!`)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.'
      toast.error(msg)
      setLoading(false)
    }
  }

  const StepIcon = STEPS[currentStep - 1].icon

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🐾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ClickPawPay</h1>
          <p className="text-gray-500 text-sm mt-1">Create your account</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((step, idx) => {
            const Icon     = step.icon
            const isDone   = currentStep > step.id
            const isActive = currentStep === step.id
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isDone   ? 'bg-primary-600 text-white' :
                    isActive ? 'bg-primary-100 border-2 border-primary-600 text-primary-700' :
                               'bg-gray-100 border border-gray-200 text-gray-400'
                  }`}>
                    {isDone
                      ? <Check className="w-4 h-4" />
                      : <Icon className="w-4 h-4" />
                    }
                  </div>
                  <span className={`text-xs mt-1 font-medium hidden sm:block ${isActive ? 'text-primary-700' : 'text-gray-400'}`}>
                    {step.title.split(' ')[0]}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-all ${isDone ? 'bg-primary-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
              <StepIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Step {currentStep} of {STEPS.length}</p>
              <h2 className="text-sm font-bold text-gray-900">{STEPS[currentStep - 1].title}</h2>
            </div>
          </div>

          {/* Step 1 — Company Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Company Name</label>
                <input
                  type="text"
                  name="instanceName"
                  value={formData.instanceName}
                  onChange={handleChange}
                  placeholder="Acme Corp"
                  className="input w-full"
                  autoFocus
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Subdomain</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    name="subdomain"
                    value={formData.subdomain}
                    onChange={handleChange}
                    placeholder="acme-corp"
                    className="input flex-1"
                    maxLength={63}
                    pattern="[a-z0-9-]+"
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">.clickpawpay.com</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
            </div>
          )}

          {/* Step 2 — Account Credentials */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  className="input w-full"
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    className="input w-full pr-10"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat password"
                    className="input w-full pr-10"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — SlickPay Key */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                Your SlickPay secret API key is encrypted and stored securely. It is used by the AI agent to process payments on your behalf.
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">SlickPay Secret Key</label>
                <input
                  type="password"
                  name="slickpayKey"
                  value={formData.slickpayKey}
                  onChange={handleChange}
                  placeholder="sk_live_..."
                  className="input w-full font-mono"
                  autoFocus
                  autoComplete="off"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Find it in your{' '}
                  <a href="https://slick-pay.com/dashboard" target="_blank" rel="noopener noreferrer"
                    className="text-primary-600 hover:underline">
                    SlickPay Dashboard
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Review your details before creating your account.</p>
              {[
                { label: 'Company Name', value: formData.instanceName },
                { label: 'Subdomain',    value: `${formData.subdomain}.clickpawpay.com` },
                { label: 'Email',        value: formData.email },
                { label: 'SlickPay Key', value: `${formData.slickpayKey.slice(0, 4)}${'•'.repeat(Math.min(16, formData.slickpayKey.length - 4))}` }
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-medium text-gray-800 text-right max-w-[60%] break-all">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={loading}
                className="btn btn-secondary flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={loading}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
              ) : currentStep === 4 ? (
                <><Check className="w-4 h-4" /> Create Account</>
              ) : (
                <>Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}
