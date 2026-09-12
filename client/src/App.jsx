import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './components/login.jsx'
import Dashboard from './components/dashboard.jsx'
import UnitDashboard from './components/EmployeesDashboard.jsx'
import ApprovalInbox from './components/ApprovalInbox.jsx'

function App() {
  const employeeRole = sessionStorage.getItem('role')

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/unit-info" element={<UnitDashboard EmployeeRole={employeeRole} />} />
        <Route path="/approval-inbox" element={<ApprovalInbox />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
