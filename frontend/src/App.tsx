import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/auth/AuthContext"
import { CurrencyProvider } from "@/context/CurrencyContext"
import { ProtectedRoute, MemberRoute, ApproverRoute, AdminRoute } from "@/routes/ProtectedRoute"
import { AppLayout } from "@/layout/AppLayout"
import Login from "@/screens/Login"
import MyInitiatives from "@/screens/MyInitiatives"
import CreateInitiative from "@/screens/CreateInitiative"
import EditInitiative from "@/screens/EditInitiative"
import InitiativeDetail from "@/screens/InitiativeDetail"
import SpendRequestDetail from "@/screens/SpendRequestDetail"
import Dashboard from "@/screens/Dashboard"
import ApprovalsDashboard from "@/screens/ApprovalsDashboard"
import AdminConsole from "@/screens/AdminConsole"
import UserManagement from "@/screens/UserManagement"
import About from "@/screens/About"

const queryClient = new QueryClient({
  // Approver A's decision must show up for approver B without a manual
  // refresh — refetching on window focus is the cheap, zero-infrastructure
  // way to get most of that (switching back to this tab picks up whatever
  // changed elsewhere). Combined with the polling on the specific
  // approval-relevant queries (useInitiatives/useInitiative/useSpendRequests)
  // for the case where a tab is just left open and never re-focused.
  defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route element={<MemberRoute />}>
                  <Route index element={<MyInitiatives />} />
                  <Route path="initiatives/new" element={<CreateInitiative />} />
                  <Route path="initiatives/:id/edit" element={<EditInitiative />} />
                </Route>
                <Route path="initiatives" element={<MyInitiatives />} />
                <Route path="initiatives/:id" element={<InitiativeDetail />} />
                <Route path="about" element={<About />} />
                <Route path="spend-requests/:id" element={<SpendRequestDetail />} />
                <Route element={<ApproverRoute />}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="approvals" element={<ApprovalsDashboard />} />
                  <Route path="leadership-report" element={<Navigate to="/dashboard" replace />} />
                </Route>
                <Route element={<AdminRoute />}>
                  <Route path="admin" element={<AdminConsole />} />
                  <Route path="user-management" element={<UserManagement />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
