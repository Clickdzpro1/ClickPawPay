import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useConfigStore } from './store/configStore'
import { tokenStorage } from './utils/api'
import SetupWizard  from './pages/SetupWizard'
import Login        from './pages/Login'
import Dashboard    from './pages/Dashboard'
import Chat         from './pages/Chat'
import Settings     from './pages/Settings'
import Transactions from './pages/Transactions'

function App() {
  const { isConfigured, isLoggedIn } = useConfigStore()

  // If a JWT token exists in storage but isLoggedIn is false (e.g. page refresh),
  // trust the token until the next 401 clears it.
  const hasToken = Boolean(tokenStorage.get())
  const authenticated = isLoggedIn || hasToken

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* State 1: Never registered → Registration Wizard */}
        {!isConfigured ? (
          <>
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="*"      element={<Navigate to="/setup" replace />} />
          </>
        ) : !authenticated ? (
          /* State 2: Registered but not logged in → Login */
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="*"      element={<Navigate to="/login" replace />} />
          </>
        ) : (
          /* State 3: Logged in → Full app */
          <>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/chat"         element={<Chat />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="*"             element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
