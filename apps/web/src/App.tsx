import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { useRealtimeNotifications } from './lib/useRealtimeNotifications.js';

// Layout
import AppLayout from './components/AppLayout.js';
import CookieBanner from './components/CookieBanner.js';
import CookiePreferences from './components/CookiePreferences.js';
import ToastContainer from './components/ToastContainer.js';
import GamificationPopup from './components/GamificationPopup.js';

// Páginas públicas
import LandingPage        from './pages/LandingPage.js';
import LoginPage          from './pages/LoginPage.js';
import RegisterPage       from './pages/RegisterPage.js';
import MfaVerifyPage      from './pages/MfaVerifyPage.js';
import ForgotPasswordPage from './pages/ForgotPasswordPage.js';
import ResetPasswordPage  from './pages/ResetPasswordPage.js';
import EmailConfirmedPage from './pages/EmailConfirmedPage.js';
import NotFoundPage       from './pages/NotFoundPage.js';
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
import HelpPage         from './pages/HelpPage.js';
import FriendsPage      from './pages/FriendsPage.js';
import FriendProfilePage from './pages/FriendProfilePage.js';
import ChatPage         from './pages/ChatPage.js';
import Spinner from './components/Spinner.js';

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
          <Spinner size="md" />
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
        <Spinner size="md" />
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

  // Sino: contador inicial + INSERT/UPDATE em notifications via Realtime
  useRealtimeNotifications();

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
        <Route
          path="/esqueci-senha"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />
        {/* Sem PublicOnlyRoute: o link do e-mail abre uma sessão de recuperação,
            e a página precisa aparecer mesmo assim */}
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        {/* Sem PublicOnlyRoute pelo mesmo motivo: o link de confirmação de
            cadastro abre uma sessão, que a página encerra depois de confirmar */}
        <Route path="/email-confirmado" element={<EmailConfirmedPage />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />

        {/* Rotas privadas — aninhadas sob AppLayout com sidebar */}
        <Route element={<PrivateAppLayout />}>
          <Route path="/dashboard"      element={<DashboardPage />} />
          <Route path="/tarefas"        element={<TasksPage />} />
          <Route path="/grupos"         element={<GroupsPage />} />
          <Route path="/grupos/:id"                element={<GroupDetailPage />} />
          <Route path="/grupos/:id/configuracoes" element={<GroupSettingsPage />} />
          <Route path="/ranking"        element={<RankingPage />} />
          <Route path="/amigos"         element={<FriendsPage />} />
          <Route path="/amigos/:id"     element={<FriendProfilePage />} />
          <Route path="/amigos/:id/chat" element={<ChatPage />} />
          <Route path="/conquistas"     element={<AchievementsPage />} />
          <Route path="/estatisticas"   element={<StatisticsPage />} />
          <Route path="/perfil"         element={<ProfilePage />} />
          <Route path="/configuracoes/seguranca" element={<SecurityPage />} />
          <Route path="/ajuda"          element={<HelpPage />} />
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
        <Route path="/help"         element={<Navigate to="/ajuda" replace />} />

        {/* 404 */}
        {/* Endereço inexistente: avisa em vez de voltar à landing sem explicação */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Elementos globais de consentimento de cookies — presentes em toda rota */}
      <CookieBanner />
      <CookiePreferences />
      <ToastContainer />
      <GamificationPopup />
    </>
  );
}
