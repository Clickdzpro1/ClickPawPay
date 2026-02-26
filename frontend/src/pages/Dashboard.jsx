import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useConfigStore } from '../store/configStore'
import { balance as balanceApi, transactions as transactionsApi } from '../utils/api'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  TrendingUp,
  MessageSquare,
  ArrowLeftRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// DB returns uppercase enums: COMPLETED, PENDING, FAILED, CANCELLED
const STATUS_STYLES = {
  COMPLETED:  { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Completed' },
  PENDING:    { icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50',   label: 'Pending'   },
  FAILED:     { icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50',     label: 'Failed'    },
  CANCELLED:  { icon: XCircle,      color: 'text-gray-500',    bg: 'bg-gray-100',   label: 'Cancelled' },
}

function StatCard({ title, value, subtitle, icon: Icon, iconBg, loading }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-32 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
          )}
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-4 ${iconBg}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

function QuickAction({ icon: Icon, label, to, color }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all group`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700">{label}</span>
    </button>
  )
}

export default function Dashboard() {
  const { tenant } = useConfigStore()
  const navigate = useNavigate()
  const [accountBalance, setAccountBalance] = useState(null)
  const [recentTxns, setRecentTxns] = useState([])
  const [stats, setStats] = useState({ today: 0, month: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async (showToast = false) => {
    if (showToast) setRefreshing(true)
    try {
      const [balRes, txRes] = await Promise.allSettled([
        balanceApi.get(),
        transactionsApi.list({ limit: 5, page: 1 }),
      ])

      if (balRes.status === 'fulfilled') {
        setAccountBalance(balRes.value)
      }

      if (txRes.status === 'fulfilled') {
        const data = txRes.value
        setRecentTxns(data.transactions || [])
        setStats({
          today: data.stats?.today ?? 0,
          month: data.stats?.month ?? 0,
          total: data.stats?.total ?? 0,
        })
      }
      if (showToast) toast.success('Data refreshed')
    } catch {
      // Errors handled by interceptor
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const formatAmount = (amount, currency = 'DZD') =>
    `${Number(amount).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} ${currency}`

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {tenant?.name || 'ClickPawPay'} — AI Payment Agent
            </p>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 btn btn-secondary text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Account Balance"
            value={accountBalance ? formatAmount(accountBalance.balance, accountBalance.currency) : '—'}
            subtitle={accountBalance?.lastUpdated ? `Updated ${formatDate(accountBalance.lastUpdated)}` : 'Via SlickPay'}
            icon={Wallet}
            iconBg="bg-primary-50 text-primary-600"
            loading={loading}
          />
          <StatCard
            title="Transactions Today"
            value={loading ? '—' : stats.today}
            subtitle="Successful payments"
            icon={Activity}
            iconBg="bg-emerald-50 text-emerald-600"
            loading={loading}
          />
          <StatCard
            title="This Month"
            value={loading ? '—' : stats.month}
            subtitle="Total transactions"
            icon={TrendingUp}
            iconBg="bg-blue-50 text-blue-600"
            loading={loading}
          />
          <StatCard
            title="All Time"
            value={loading ? '—' : stats.total}
            subtitle="Total processed"
            icon={ArrowLeftRight}
            iconBg="bg-violet-50 text-violet-600"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Transactions */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Recent Transactions</h2>
                <button
                  onClick={() => navigate('/transactions')}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : recentTxns.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No transactions yet</p>
                  <p className="text-xs mt-1">Start by chatting with the AI agent</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTxns.map((txn) => {
                    // DB type: TRANSFER, INVOICE, REFUND — REFUND is a credit
                    const isCredit   = txn.type === 'REFUND'
                    const statusStyle = STATUS_STYLES[txn.status] || STATUS_STYLES.PENDING
                    const StatusIcon  = statusStyle.icon
                    return (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isCredit ? 'bg-emerald-50' : 'bg-primary-50'
                          }`}>
                            {isCredit ? (
                              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-primary-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {txn.toAccount || txn.description || txn.type}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(txn.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className={`text-sm font-semibold ${
                            isCredit ? 'text-emerald-600' : 'text-gray-900'
                          }`}>
                            {isCredit ? '+' : '-'}{formatAmount(txn.amount, txn.currency)}
                          </span>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusStyle.label}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions + Status */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction
                  icon={MessageSquare}
                  label="Send Payment"
                  to="/chat"
                  color="bg-primary-50 text-primary-600"
                />
                <QuickAction
                  icon={Wallet}
                  label="Check Balance"
                  to="/chat"
                  color="bg-emerald-50 text-emerald-600"
                />
                <QuickAction
                  icon={ArrowLeftRight}
                  label="History"
                  to="/transactions"
                  color="bg-blue-50 text-blue-600"
                />
                <QuickAction
                  icon={Activity}
                  label="Invoices"
                  to="/chat"
                  color="bg-violet-50 text-violet-600"
                />
              </div>
            </div>

            {/* Integration Status */}
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Integrations</h2>
              <div className="space-y-3">
                <IntegrationRow
                  label="AI Provider"
                  value="Anthropic Claude"
                  active={true}
                />
                <IntegrationRow
                  label="SlickPay"
                  value="Payment API"
                  active={true}
                />
                <IntegrationRow
                  label="Plan"
                  value={tenant?.plan || 'STARTER'}
                  active={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function IntegrationRow({ label, value, active }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{value}</span>
        <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      </div>
    </div>
  )
}
