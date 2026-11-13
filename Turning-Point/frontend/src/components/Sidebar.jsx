import React from 'react';
import {
  Layers,
  Sparkles,
  Inbox,
  BarChart3,
  Radio,
  Activity,
  Bookmark,
  FileText,
  Building2,
  ShieldAlert,
  Server,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, currentOrg }) {
  const navSections = [
    {
      title: 'Workspace',
      items: [
        { id: 'overview', label: 'Overview', icon: Layers },
        { id: 'messages', label: 'Messages', icon: Inbox, badge: 'Live' },
        { id: 'ai', label: 'AI Assistant', icon: Sparkles },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    {
      title: 'Configuration',
      items: [
        { id: 'sources', label: 'Data Sources', icon: Radio },
        { id: 'monitor', label: 'Ingestion Monitor', icon: Activity },
        { id: 'saved', label: 'Saved Searches', icon: Bookmark },
        { id: 'reports', label: 'Reports', icon: FileText },
      ]
    },
    {
      title: 'Administration',
      items: [
        { id: 'organization', label: 'Organization', icon: Building2 },
        { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
        { id: 'status', label: 'System Status', icon: Server },
      ]
    }
  ];

  return (
    <aside style={{
      width: '240px',
      backgroundColor: 'var(--sidebar)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100vh',
      position: 'sticky',
      top: 0
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 18px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#fff', letterSpacing: '-0.5px' }}>E</span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.3px', color: '#fff' }}>
            EventInsight AI
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Enterprise Intelligence
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 10px' }}>
        {navSections.map((sec, sIdx) => (
          <div key={sec.title} style={{ marginBottom: sIdx < navSections.length - 1 ? '20px' : '0' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              padding: '0 10px 8px',
            }}>
              {sec.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--border-highlight)' : 'transparent',
                      background: isActive ? 'var(--surface-active)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--surface-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon size={16} color={isActive ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--accent-emerald)',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tenant Context Footer */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-blue)'
          }}>
            TP
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {currentOrg}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Tenant: Aviation Ops
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
