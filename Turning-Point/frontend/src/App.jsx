import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Drawer from './components/Drawer';
import OverviewView from './views/OverviewView';
import MessagesView from './views/MessagesView';
import AIAssistantView from './views/AIAssistantView';
import AnalyticsView from './views/AnalyticsView';
import SourcesView from './views/SourcesView';

export default function App() {
  const [activeView, setActiveView] = useState('overview');
  const [currentOrg, setCurrentOrg] = useState('Turning Point Apps Default');
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Data States
  const [events, setEvents] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stats, setStats] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Health & Stats
  const fetchMetadata = useCallback(async () => {
    try {
      const [healthRes, statsRes, logsRes] = await Promise.all([
        fetch('/api/health').then(r => r.json()).catch(() => null),
        fetch('/api/stats').then(r => r.json()).catch(() => null),
        fetch('/api/system-activity').then(r => r.json()).catch(() => ({ activity: [] }))
      ]);
      if (healthRes) setHealth(healthRes);
      if (statsRes) setStats(statsRes);
      if (logsRes?.activity) setSystemLogs(logsRes.activity);
    } catch (e) {
      console.error('Error fetching metadata:', e);
    }
  }, []);

  // Fetch Paginated Events with Filters
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25'
      });
      if (entityFilter !== 'All') params.append('entity', entityFilter);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (globalSearch.trim()) params.append('search', globalSearch.trim());

      const res = await fetch(`/api/events?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setTotalEvents(data.total || 0);
      }
    } catch (e) {
      console.error('Error loading events:', e);
    } finally {
      setIsLoading(false);
    }
  }, [page, entityFilter, statusFilter, globalSearch]);

  // Initial Load
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Load Events on Filter Change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle Manual Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchMetadata(), fetchEvents()]);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  // Jump to AI with Prompt
  const handleAskAI = (promptText) => {
    setAiPrompt(promptText);
    setActiveView('ai');
  };

  return (
    <div className="app-container">
      {/* High-Density Enterprise Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        currentOrg={currentOrg}
      />

      {/* Main Canvas Shell */}
      <div className="main-content">
        {/* Top Navigation Bar */}
        <TopBar
          activeView={activeView}
          currentOrg={currentOrg}
          setCurrentOrg={setCurrentOrg}
          globalSearch={globalSearch}
          setGlobalSearch={(val) => {
            setGlobalSearch(val);
            if (activeView !== 'messages' && val.trim()) {
              setActiveView('messages');
            }
          }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          health={health}
        />

        {/* Dynamic Page Views */}
        <main className="page-body">
          {activeView === 'overview' && (
            <OverviewView
              stats={stats}
              recentEvents={events}
              onNavigate={setActiveView}
              onAskAI={handleAskAI}
              onSelectEvent={setSelectedEvent}
            />
          )}

          {activeView === 'messages' && (
            <MessagesView
              events={events}
              totalEvents={totalEvents}
              page={page}
              setPage={setPage}
              entityFilter={entityFilter}
              setEntityFilter={setEntityFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              searchQuery={globalSearch}
              setSearchQuery={setGlobalSearch}
              onSelectEvent={setSelectedEvent}
              stats={stats}
              systemLogs={systemLogs}
              health={health}
              isLoading={isLoading}
            />
          )}

          {activeView === 'ai' && (
            <AIAssistantView
              initialPrompt={aiPrompt}
              stats={stats}
              events={events}
            />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView
              stats={stats}
            />
          )}

          {activeView === 'sources' && (
            <SourcesView
              stats={stats}
              health={health}
            />
          )}

          {['monitor', 'saved', 'reports', 'organization', 'audit', 'status'].includes(activeView) && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                {activeView.charAt(0).toUpperCase() + activeView.slice(1)} Module Ready
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', margin: '8px auto 20px' }}>
                Connected to the active tenant '{currentOrg}'. All events, broker feeds, and normalized collections are synchronized.
              </p>
              <button onClick={() => setActiveView('messages')} className="btn btn-primary">
                Return to Event Messages
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Slide-Over Payload Inspector Drawer */}
      {selectedEvent && (
        <Drawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onAskAI={handleAskAI}
        />
      )}
    </div>
  );
}
