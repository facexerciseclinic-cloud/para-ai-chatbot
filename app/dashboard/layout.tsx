import AppSidebar from '@/components/layout/AppSidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Main Navigation Sidebar */}
      <AppSidebar />
      
      {/* Content Area */}
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
