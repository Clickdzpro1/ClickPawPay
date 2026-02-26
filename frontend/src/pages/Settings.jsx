import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { settings as settingsApi } from '../utils/api'
import { useConfigStore } from '../store/configStore'
import toast from 'react-hot-toast'
import {
  Settings as SettingsIcon,
  User,
  Key,
  Zap,
  LogOut,
  Loader2,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw
} from 'lucide-react'

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useConfigStore()

  const [settingsData, setSettingsData] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [testing, setTesting]           = useState(false)

  // Form state
  const [nameInput, setNameInput]       = useState('')
  const [slickpayKey, setSlickpayKey]   = useState('')

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const data = await settingsApi.get()
      setSettingsData(data)
      setNameInput(data.name || '')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveName = async (e) => {
    e.preventDefault()
    if (!nameInput.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    try {
      setSaving(true)
      const res = await settingsApi.update({ name: nameInput.trim() })
      setSettingsData(prev => ({ ...prev, name: res.tenant.name }))
      toast.success('Name updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSlickpay = async (e) => {
    e.preventDefault()
    if (!slickpayKey.trim()) {
      toast.error('Please enter a SlickPay API key')
      return
    }
    try {
      setSaving(true)
      await settingsApi.update({ slickpayKey: slickpayKey.trim() })
      setSlickpayKey('')
      toast.success('SlickPay key updated successfully')
      fetchSettings() // refresh masked key display
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update SlickPay key')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      const res = await settingsApi.test('slickpay')
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSignOut = () => {
    logout()
    navigate('/login')
  }

  const usagePct = settingsData
    ? Math.min(100, Math.round((settingsData.requestCount / settingsData.requestLimit) * 100))
    : 0

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Settings</h1>
              <p className="text-xs text-gray-400">Manage your account configuration</p>
            </div>
          </div>
          <button
            onClick={fetchSettings}
            className="btn btn-secondary text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Account Info */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Account Info</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Subdomain</p>
              <p className="font-medium text-gray-800">{settingsData?.subdomain}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Plan</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100">
                {settingsData?.plan}
              </span>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Status</p>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${settingsData?.isActive ? 'text-green-600' : 'text-red-500'}`}>
                {settingsData?.isActive
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Active</>
                  : <><AlertCircle className="w-3.5 h-3.5" /> Inactive</>
                }
              </span>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Member since</p>
              <p className="font-medium text-gray-800">
                {settingsData?.createdAt
                  ? new Date(settingsData.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>

          {/* Request usage */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>API Requests</span>
              <span>{settingsData?.requestCount ?? 0} / {settingsData?.requestLimit ?? 0}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-yellow-400' : 'bg-primary-500'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {settingsData?.resetDate && (
              <p className="text-xs text-gray-400 mt-1">
                Resets {new Date(settingsData.resetDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Update Name */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Company Name</h2>
          </div>
          <form onSubmit={handleSaveName} className="flex gap-3">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Company name"
              className="input flex-1"
              minLength={2}
              maxLength={100}
            />
            <button
              type="submit"
              disabled={saving || !nameInput.trim() || nameInput.trim() === settingsData?.name}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </form>
        </div>

        {/* SlickPay Key */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">SlickPay API Key</h2>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="btn btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {testing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Zap className="w-3.5 h-3.5" />
              }
              Test Connection
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Current key: <span className="font-mono text-gray-600">{settingsData?.slickpayKeyMasked || '****'}</span>
          </p>

          <form onSubmit={handleSaveSlickpay} className="flex gap-3">
            <input
              type="password"
              value={slickpayKey}
              onChange={e => setSlickpayKey(e.target.value)}
              placeholder="Enter new SlickPay secret key"
              className="input flex-1 font-mono"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={saving || !slickpayKey.trim()}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Update
            </button>
          </form>
        </div>

        {/* Sign Out */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Sign Out</p>
              <p className="text-xs text-gray-400 mt-0.5">Sign out of your account on this device</p>
            </div>
            <button
              onClick={handleSignOut}
              className="btn flex items-center gap-2 text-red-600 border border-red-200 hover:bg-red-50 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

      </div>
    </Layout>
  )
}
