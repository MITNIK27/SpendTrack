import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/auth/AuthContext"
import { ProtectedRoute, EmployeeRoute, ApproverRoute, AdminRoute } from "@/routes/ProtectedRoute"
import { AppLayout } from "@/layout/AppLayout"
import Login from "@/screens/Login"
import MyInitiatives from "@/screens/MyInitiatives"
import CreateInitiative from "@/screens/CreateInitiative"
import EditInitiative from "@/screens/EditInitiative"
import InitiativeDetail from "@/screens/InitiativeDetail"
import AddSpend from "@/screens/AddSpend"
import SpendRequestDetail from "@/screens/SpendRequestDetail"
import Dashboard from "@/screens/Dashboard"
import ApprovalsDashboard from "@/screens/ApprovalsDashboard"
import AdminConsole from "@/screens/AdminConsole"
import About from "@/screens/About"

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route element={<EmployeeRoute />}>
                  <Route index element={<MyInitiatives />} />
                  <Route path="initiatives/new" element={<CreateInitiative />} />
                  <Route path="initiatives/:id/edit" element={<EditInitiative />} />
                  <Route path="initiatives/:id/spend-requests/new" element={<AddSpend />} />
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
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
