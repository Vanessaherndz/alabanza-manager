import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import RoleRoute from './components/RoleRoute.jsx'
import Layout from './components/Layout/Layout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Services from './pages/Services.jsx'
import Rehearsals from './pages/Rehearsals.jsx'
import Teams from './pages/Teams.jsx'
import Songs from './pages/Songs.jsx'
import Availability from './pages/Availability.jsx'
import Members from './pages/Members.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="servicios" element={<Services />} />
        <Route path="ensayos" element={<Rehearsals />} />
        <Route path="equipos" element={<Teams />} />
        <Route path="canciones" element={<Songs />} />
        <Route path="disponibilidad" element={<Availability />} />
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
