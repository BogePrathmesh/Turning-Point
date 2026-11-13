import React from 'react';
import { Search, Database, RefreshCw, ChevronDown } from 'lucide-react';

export default function TopBar({
  activeView,
  currentOrg,
  setCurrentOrg,
  globalSearch,
  setGlobalSearch,
  onRefresh,
  isRefreshing,
  health
}) {
  const viewTitles = {
    overview: 'Overview',
    messages: 'Event Messages',
    ai: 'AI Assistant',
    analytics: 'Analytics',
    sources: 'Data Sources',
    monitor: 'Ingestion Monitor',
    saved: 'Saved Searches',
    reports: 'Reports',
    organization: 'Organization Profile',
    audit: 'Audit Log',
    status: 'System Status'
  };

  return (
    <header style={{
      height: '56px',
      backgroundColor: 'var(--surface)',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 30
    }}>
      {/* Breadcrumb Path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Workspace</span>
        <span style={{ color: 'var(--border-highlight)' }}>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{currentOrg}</span>
        <span style={{ color: 'var(--border-highlight)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {viewTitles[activeView] || activeView}
        </span>
      </div>

      {/* Global Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Global Filter / Search */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-control"
            placeholder="Search flights, NOTAMs, airports..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
          />
        </div>

        {/* Database Health Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 10px',
          borderRadius: '999px',
          backgroundColor: health?.database === 'connected' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
          border: `1px solid ${health?.database === 'connected' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
          fontSize: '11px',
          fontWeight: 600,
          color: health?.database === 'connected' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
        }}>
          <span className={`status-dot pulse-dot`} style={{ backgroundColor: 'currentColor' }} />
          <span>{health?.database === 'connected' ? `MongoDB Active (${health.eventsCount})` : 'Offline'}</span>
        </div>

        {/* Manual Refresh Trigger */}
        <button
          onClick={onRefresh}
          className="btn btn-ghost btn-sm"
          title="Refresh Data from MongoDB"
          style={{ padding: '6px' }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
        </button>

        {/* Organization Switcher */}
        <div style={{ position: 'relative' }}>
          <select
            value={currentOrg}
            onChange={(e) => setCurrentOrg(e.target.value)}
            style={{
              appearance: 'none',
              backgroundColor: 'var(--canvas)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              borderRadius: '7px',
              padding: '6px 28px 6px 10px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="Turning Point Apps Default">Turning Point Apps Default</option>
            <option value="Reliance Industries">Reliance Industries</option>
            <option value="Demo Aviation Corp">Demo Aviation Corp</option>
          </select>
          <ChevronDown size={12} color="var(--text-muted)" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        {/* User Mini Avatar */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#1e293b',
          border: '1px solid var(--border-highlight)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: '#e2e8f0'
        }}>
          JD
        </div>
      </div>
    </header>
  );
}
