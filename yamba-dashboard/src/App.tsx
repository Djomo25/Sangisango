import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Conversations } from './pages/Conversations';
import { RendezVous } from './pages/RendezVous';
import { MonCommerce } from './pages/MonCommerce';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/rendez-vous" element={<RendezVous />} />
            <Route path="/mon-commerce" element={<MonCommerce />} />
          </Route>

          <Route path="/" element={<Navigate to="/conversations" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
