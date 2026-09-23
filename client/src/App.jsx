import { Navigate, Route, Routes } from 'react-router-dom'
import useCurrentUser from './hooks/useCurrentUser'
import Login from './components/login.jsx'
import Dashboard from './components/dashboard.jsx'
import UnitDashboard from './components/EmployeesDashboard.jsx'
import ApprovalInbox from './components/ApprovalInbox.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import EmployeeDetails from './components/EmployeeDetails.jsx'
import LeaveTitles from './components/LeaveTitles.jsx'
import AddEmployee from './components/AddEmployee.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const { loading, user, role } = useCurrentUser();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/unit-info" element={<ProtectedRoute allowedRoles={['head', 'hr', 'drh', 'admin']}><UnitDashboard /></ProtectedRoute>} />
        <Route path="/approval-inbox" element={<ProtectedRoute allowedRoles={['head', 'hr', 'drh', 'admin']}><ApprovalInbox /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'drh']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/employees/:employeeId" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'drh']}><EmployeeDetails /></ProtectedRoute>} />
        <Route path="/leave-titles" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'drh']}><LeaveTitles /></ProtectedRoute>} />
        <Route path="/add-employee" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'drh']}><AddEmployee /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
