import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import RoleRoute from './components/RoleRoute.jsx'
import Layout from './components/Layout/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Services from './pages/Services.jsx'
import ServiceForm from './pages/ServiceForm.jsx'
import ServiceDetail from './pages/ServiceDetail.jsx'
import Teams from './pages/Teams.jsx'
import Songs from './pages/Songs.jsx'
import Members from './pages/Members.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="servicios" element={<Services />} />
        <Route path="servicios/nuevo" element={<ServiceForm />} />
        <Route path="servicios/:id" element={<ServiceDetail />} />
        <Route path="equipos" element={<Teams />} />
        <Route path="canciones" element={<Songs />} />
        <Route
          path="miembros"
          element={
            <RoleRoute allow={['admin']}>
              <Members />
            </RoleRoute>
          }
        />
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  )
}
