import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';

// Layout
import AppLayout from './components/AppLayout.js';
import CookieBanner from './components/CookieBanner.js';
import CookiePreferences from './components/CookiePreferences.js';

// Páginas públicas
import LandingPage        from './pages/LandingPage.js';
import LoginPage          from './pages/LoginPage.js';
import RegisterPage       from './pages/RegisterPage.js';
import MfaVerifyPage      from './pages/MfaVerifyPage.js';
import PrivacyPolicyPage  from './pages/PrivacyPolicyPage.js';

// Páginas privadas
import DashboardPage    from './pages/DashboardPage.js';
import TasksPage        from './pages/TasksPage.js';
import GroupsPage       from './pages/GroupsPage.js';
import GroupDetailPage    from './pages/GroupDetailPage.js';
import GroupSettingsPage from './pages/GroupSettingsPage.js';
import RankingPage      from './pages/RankingPage.js';
import AchievementsPage from './pages/AchievementsPage.js';
import StatisticsPage   from './pages/StatisticsPage.js';
import ProfilePage      from './pages/ProfilePage.js';
import SecurityPage     from './pages/SecurityPage.js';

// ---------------------------------------------------------------------------
// Layout privado — protege + fornece sidebar
// ---------------------------------------------------------------------------

function PrivateAppLayout() {
  const { isAuthenticated, isInitializing } = useAuthStore((s) => ({
    isAuthenticated: s.isAuthenticated,
    isInitializing:  s.isInitializing,
  }));

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}

// ---------------------------------------------------------------------------
// Rota pública — redireciona para /dashboard se já autenticado
// ---------------------------------------------------------------------------

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuthStore((s) => ({
    isAuthenticated: s.isAuthenticated,
    isInitializing:  s.isInitializing,
  }));

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// App principal
// ---------------------------------------------------------------------------

export default function App() {
  const loadSession = useAuthStore((s) => s.loadSession);
  const location    = useLocation();

  useEffect(() => {
    void loadSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/cadastro"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        {/* Step-up de 2FA no login — acessível apenas com um login aal1 em andamento */}
        <Route path="/verificar-2fa" element={<MfaVerifyPage />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />

        {/* Rotas privadas — aninhadas sob AppLayout com sidebar */}
        <Route element={<PrivateAppLayout />}>
          <Route path="/dashboard"      element={<DashboardPage />} />
          <Route path="/tarefas"        element={<TasksPage />} />
          <Route path="/grupos"         element={<GroupsPage />} />
          <Route path="/grupos/:id"                element={<GroupDetailPage />} />
          <Route path="/grupos/:id/configuracoes" element={<GroupSettingsPage />} />
          <Route path="/ranking"        element={<RankingPage />} />
          <Route path="/conquistas"     element={<AchievementsPage />} />
          <Route path="/estatisticas"   element={<StatisticsPage />} />
          <Route path="/perfil"         element={<ProfilePage />} />
          <Route path="/configuracoes/seguranca" element={<SecurityPage />} />
        </Route>

        {/* Aliases em inglês → PT-BR */}
        <Route path="/register"     element={<Navigate to="/cadastro"   replace />} />
        <Route path="/tasks"        element={<Navigate to="/tarefas"    replace />} />
        <Route path="/groups"       element={<Navigate to="/grupos"     replace />} />
        <Route path="/groups/:id"   element={<Navigate to="/grupos/:id" replace />} />
        <Route path="/achievements" element={<Navigate to="/conquistas" replace />} />
        <Route path="/profile"      element={<Navigate to="/perfil"     replace />} />
        <Route path="/security"     element={<Navigate to="/configuracoes/seguranca" replace />} />
        <Route path="/privacy-policy" element={<Navigate to="/politica-de-privacidade" replace />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Elementos globais de consentimento de cookies — presentes em toda rota */}
      <CookieBanner />
      <CookiePreferences />
    </>
  );
}
