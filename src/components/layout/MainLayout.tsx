import { ReactNode } from 'react';
import { Menu, X } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
}

const MainLayout = ({ children, sidebarVisible, toggleSidebar }: MainLayoutProps) => {
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部导航栏 */}
      <header className="bg-card border-b border-border p-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">RTP2HTTPD Player</h1>
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-muted rounded-md"
          aria-label="Toggle sidebar"
        >
          {sidebarVisible ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      
      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      
      {/* 页脚 */}
      <footer className="bg-card border-t border-border p-2 text-center text-xs text-muted-foreground">
        RTP2HTTPD Player - {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default MainLayout;
