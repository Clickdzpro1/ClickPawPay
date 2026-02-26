import { useState, useRef, useEffect } from 'react'
import Layout from '../components/Layout'
import { chat as chatApi } from '../utils/api'
import { useConfigStore } from '../store/configStore'
import toast from 'react-hot-toast'
import {
  Send,
  Bot,
  User,
  Loader2,
  Plus,
  Zap,
  Info
} from 'lucide-react'

const EXAMPLE_COMMANDS = [
  { icon: '💸', text: 'Send 500 DZD to +213555000001' },
  { icon: '💰', text: 'Check my SlickPay balance' },
  { icon: '🧾', text: 'Create invoice for 1200 DZD' },
  { icon: '📋', text: 'List my last 5 transactions' },
  { icon: '📊', text: 'Get exchange rates' },
  { icon: '🔗', text: 'Generate a payment link for 800 DZD' },
]

function Message({ message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-500">
          <Info className="w-3.5 h-3.5" />
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-primary-600' : 'bg-gray-100 border border-gray-200'
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-white" />
          : <Bot className="w-4 h-4 text-gray-600" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
        }`}>
          {message.content}
        </div>
        {message.timestamp && (
          <span className="text-xs text-gray-400 px-1">
            {new Date(message.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {/* Tool calls badge */}
        {message.toolCallsExecuted?.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.toolCallsExecuted.map((tc, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs rounded-full">
                <Zap className="w-2.5 h-2.5" />
                {tc.tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-gray-600" />
      </div>
      <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  const { tenant } = useConfigStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const startNewConversation = () => {
    setMessages([])
    setConversationId(null)
    setInput('')
    inputRef.current?.focus()
  }

  const sendMessage = async (text) => {
    const messageText = (text || input).trim()
    if (!messageText || loading) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const data = await chatApi.send({
        message: messageText,
        conversationId,
      })

      if (data.conversationId) {
        setConversationId(data.conversationId)
      }

      const agentMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply || 'I processed your request.',
        timestamp: new Date().toISOString(),
        toolCallsExecuted: data.toolCallsExecuted || [],
      }
      setMessages((prev) => [...prev, agentMessage])
    } catch (err) {
      const errText = err.response?.data?.error || 'Something went wrong. Please try again.'
      const errMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `⚠️ ${errText}`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMessage])
    } finally {
      setLoading(false)
      // Re-focus input
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-0px)] lg:h-screen max-h-screen">
        {/* Chat header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Payment Agent</p>
              <p className="text-xs text-gray-400">
                {tenant?.name ? `${tenant.name} · ` : ''}Powered by Anthropic Claude
              </p>
            </div>
          </div>
          <button
            onClick={startNewConversation}
            className="flex items-center gap-2 btn btn-secondary text-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-gray-50">
          {isEmpty ? (
            /* Welcome screen */
            <div className="max-w-xl mx-auto pt-4">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Hi! I'm your Payment Agent 🐾
                </h2>
                <p className="text-gray-500 text-sm">
                  I can send transfers, check balances, create invoices, and more via SlickPay.
                  Just tell me what you need!
                </p>
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">
                Try asking...
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EXAMPLE_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.text}
                    onClick={() => sendMessage(cmd.text)}
                    className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl text-left hover:border-primary-300 hover:bg-primary-50 transition-all group"
                  >
                    <span className="text-lg">{cmd.icon}</span>
                    <span className="text-sm text-gray-700 group-hover:text-primary-700">
                      {cmd.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}
              {loading && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 py-4 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a payment command... (Enter to send, Shift+Enter for new line)"
                rows={1}
                disabled={loading}
                className="input resize-none py-3 pr-4 min-h-[44px] max-h-32 overflow-y-auto"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="btn btn-primary p-3 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Send className="w-5 h-5" />
              }
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            Powered by Anthropic Claude · SlickPay payments are real
          </p>
        </div>
      </div>
    </Layout>
  )
}
