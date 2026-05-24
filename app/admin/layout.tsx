import { AdminProvider } from '@/components/admin/AdminProvider';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata = {
  title: 'ILU SHOP — Admin',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
