import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { ErrorProvider } from '../context/ErrorContext';
import { ReportProvider } from '../context/ReportContext';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ErrorProvider>
          <ReportProvider>{children}</ReportProvider>
        </ErrorProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
