import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { transactions as txApi } from '../utils/api'
import toast from 'react-hot-toast'
import {
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowLeftRight
} from 'lucide-react'

// DB returns uppercase enums: COMPLETED, PENDING, FAILED, CANCELLED
const STATUS_CONFIG = {
  COMPLETED:  { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Completed' },
  PENDING:    { icon: Clock,        color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Pending'   },
  FAILED:     { icon: XCircle,      color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Failed'    },
  CANCELLED:  { icon: XCircle,      color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200',    label: 'Cancelled' },
}

const PAGE_SIZE = 10

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: '',
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchTransactions = useCallback(async (pageNum, filt) => {
    setLoading(true)
    try {
      const params = {
        page: pageNum,
        limit: PAGE_SIZE,
        ...(filt.search && { search: filt.search }),
        ...(filt.status && { status: filt.status }),
        ...(filt.startDate && { startDate: filt.startDate }),
        ...(filt.endDate && { endDate: filt.endDate }),
      }
      const data = await txApi.list(params)
      setTransactions(data.transactions || [])
      setTotal(data.total || 0)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransactions(page, appliedFilters)
  }, [page, appliedFilters, fetchTransactions])

  const applyFilters = () => {
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  const resetFilters = () => {
    const empty = { search: '', status: '', startDate: '', endDate: '' }
    setFilters(empty)
    setAppliedFilters(empty)
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const url = await txApi.exportCsv({
        ...(appliedFilters.status && { status: appliedFilters.status }),
        ...(appliedFilters.startDate && { startDate: appliedFilters.startDate }),
        ...(appliedFilters.endDate && { endDate: appliedFilters.endDate }),
      })
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV exported successfully')
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const formatAmount = (amount, currency = 'DZD') =>
    `${Number(amount).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} ${currency}`

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="text-sm text-gray-500 mt-1">
              {total > 0 ? `${total} total transactions` : 'Payment history'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTransactions(page, appliedFilters)}
              className="btn btn-secondary text-sm flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || transactions.length === 0}
              className="btn btn-primary text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="Reference, recipient..."
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Status */}
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="input"
              >
                <option value="">All statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="input"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={applyFilters}
                className="btn btn-primary flex items-center gap-2 text-sm"
              >
                <Filter className="w-4 h-4" />
                Apply
              </button>
              <button
                onClick={resetFilters}
                className="btn btn-secondary text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient / Ref</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SlickPay Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-4 bg-gray-100 animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500 font-medium">No transactions found</p>
                      <p className="text-gray-400 text-xs mt-1">
                        Try different filters or start a payment via Chat
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                        {formatDate(txn.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {txn.type === 'REFUND' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-primary-600" />
                          )}
                          <span className="capitalize text-gray-700">
                            {txn.type === 'TRANSFER' ? 'Transfer' : txn.type === 'INVOICE' ? 'Invoice' : txn.type === 'REFUND' ? 'Refund' : txn.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-gray-900 font-medium truncate max-w-[180px]">
                          {txn.toAccount || txn.description || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                        <span className={txn.type === 'REFUND' ? 'text-emerald-600' : 'text-gray-900'}>
                          {txn.type === 'REFUND' ? '+' : '-'}
                          {formatAmount(txn.amount, txn.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={txn.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-400 font-mono text-xs">
                        {txn.slickpayRef ? (
                          <span title={txn.slickpayRef}>
                            {txn.slickpayRef.slice(0, 12)}…
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && transactions.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} · {total} transactions
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
