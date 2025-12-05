import React, { useState, useEffect } from 'react';
import { AppView, Site, InspectionLog } from './types';
import { storageService } from './services/storageService';
import { HomeView } from './components/HomeView';
import { AdminDashboard } from './components/AdminDashboard';
import { InspectionRunner } from './components/InspectionRunner';
import { InspectionSummary } from './components/InspectionSummary';
import { InspectionHistory } from './components/InspectionHistory';
import { Toaster, toast } from 'react-hot-toast';
import { Menu, X, Settings, ListChecks, History, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { checkSupabaseConfig } from './services/supabaseClient';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [inspectionResult, setInspectionResult] = useState<InspectionLog | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Monitor Network & Sync
  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        triggerSync();
      }
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    // Initial load
    storageService.getSites();
    updatePendingCount();

    // Try sync on mount if online
    if (navigator.onLine) triggerSync();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const updatePendingCount = () => {
     const logs = storageService.getInspections();
     const pending = logs.filter(l => !l.synced).length;
     setPendingCount(pending);
  };

  const triggerSync = async () => {
    if (!checkSupabaseConfig()) return;
    setIsSyncing(true);
    try {
       const { syncedCount } = await storageService.syncPendingData();
       if (syncedCount > 0) {
           toast.success(`${syncedCount} inspecciones subidas a la nube.`);
       }
       updatePendingCount();
    } catch (e) {
       console.error(e);
    } finally {
       setIsSyncing(false);
    }
  };

  const handleStartInspection = (site: Site) => {
    setSelectedSite(site);
    setCurrentView(AppView.INSPECTION_RUN);
    setIsMenuOpen(false);
  };

  const handleFinishInspection = (log: InspectionLog) => {
    setInspectionResult(log);
    setCurrentView(AppView.INSPECTION_SUMMARY);
  };

  const handleSaveAndExit = async () => {
    if (inspectionResult) {
      await storageService.saveInspection(inspectionResult);
      updatePendingCount();
      // Logic handled in Summary component now (download/email), we just save state here
      setInspectionResult(null);
      setSelectedSite(null);
      setCurrentView(AppView.HOME);
      // Try sync after save
      triggerSync();
    }
  };
  
  const handleViewHistoryReport = (log: InspectionLog) => {
    setInspectionResult(log);
    setCurrentView(AppView.INSPECTION_SUMMARY);
    setIsMenuOpen(false);
  };

  const NavItem = ({ view, icon: Icon, label }: { view: AppView, icon: any, label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsMenuOpen(false);
      }}
      className={`flex items-center w-full px-4 py-3 mb-2 rounded-lg transition-colors ${
        currentView === view ? 'bg-safety-100 text-safety-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Toaster position="bottom-center" />
      
      {/* Mobile Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 h-16 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-safety-500 rounded-lg flex items-center justify-center mr-3 shadow-md">
            <ListChecks className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Seguridad<span className="text-safety-600">Pro</span></h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Indicator */}
          <div className="flex items-center gap-1">
             {isSyncing ? (
                 <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
             ) : !isOnline ? (
                 <WifiOff className="w-4 h-4 text-red-400" />
             ) : (
                 <div className="relative">
                    <Wifi className="w-4 h-4 text-green-500" />
                    {pendingCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                            {pendingCount}
                        </span>
                    )}
                 </div>
             )}
          </div>

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full hover:bg-slate-100"
          >
            {isMenuOpen ? <X className="w-6 h-6 text-slate-600" /> : <Menu className="w-6 h-6 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* Navigation Drawer (Mobile) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute top-16 right-0 w-64 bg-white h-[calc(100vh-4rem)] shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <nav className="mt-4">
              <NavItem view={AppView.HOME} icon={ListChecks} label="Inicio / Inspeccionar" />
              <NavItem view={AppView.HISTORY} icon={History} label="Historial Inspecciones" />
              <NavItem view={AppView.ADMIN} icon={Settings} label="Configuración" />
            </nav>
            <div className="border-t border-slate-100 mt-4 pt-4 px-4">
                <p className="text-xs text-slate-400 font-bold mb-2">ESTADO DE CONEXIÓN</p>
                <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                    {isOnline ? 'Conectado a Internet' : 'Sin conexión'}
                </div>
                {!checkSupabaseConfig() && (
                    <p className="text-xs text-orange-500 mt-2">Supabase no configurado. Solo modo local.</p>
                )}
                {pendingCount > 0 && (
                    <button 
                       onClick={triggerSync} 
                       disabled={!isOnline || isSyncing}
                       className="mt-3 w-full py-2 bg-blue-50 text-blue-600 rounded text-xs font-bold flex items-center justify-center gap-2"
                    >
                       <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /> 
                       Sincronizar ({pendingCount})
                    </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
        {currentView === AppView.HOME && (
          <HomeView onSelectSite={handleStartInspection} />
        )}
        
        {currentView === AppView.HISTORY && (
          <InspectionHistory onViewReport={handleViewHistoryReport} />
        )}

        {currentView === AppView.ADMIN && (
          <AdminDashboard />
        )}

        {currentView === AppView.INSPECTION_RUN && selectedSite && (
          <InspectionRunner 
            site={selectedSite} 
            onComplete={handleFinishInspection}
            onCancel={() => setCurrentView(AppView.HOME)}
          />
        )}

        {currentView === AppView.INSPECTION_SUMMARY && inspectionResult && (
          <InspectionSummary 
            log={inspectionResult} 
            onConfirm={handleSaveAndExit}
            onBack={() => {
                if(inspectionResult.status === 'completed' && !selectedSite) {
                    // Viewing history
                    setCurrentView(AppView.HISTORY);
                } else {
                    // Running inspection
                    setCurrentView(AppView.INSPECTION_RUN);
                }
            }}
          />
        )}
      </main>
    </div>
  );
}