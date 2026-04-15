'use client';

import { useState } from 'react';
import { Shield, Save, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';

const SETTING_FIELDS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-api03-...' },
  { key: 'MCP_GA4_URL', label: 'GA4 MCP Server URL', placeholder: 'https://...' },
  { key: 'MCP_GA4_TOKEN', label: 'GA4 MCP Token', placeholder: 'Token (opcjonalnie)' },
  { key: 'MCP_GOOGLE_ADS_URL', label: 'Google Ads MCP Server URL', placeholder: 'https://...' },
  { key: 'MCP_GOOGLE_ADS_TOKEN', label: 'Google Ads MCP Token', placeholder: 'Token (opcjonalnie)' },
  { key: 'MCP_META_ADS_URL', label: 'Meta Ads MCP Server URL', placeholder: 'https://...' },
  { key: 'MCP_META_ADS_TOKEN', label: 'Meta Ads MCP Token', placeholder: 'Token (opcjonalnie)' },
  { key: 'MCP_CRITEO_URL', label: 'Criteo MCP Server URL', placeholder: 'https://...' },
  { key: 'MCP_CRITEO_TOKEN', label: 'Criteo MCP Token', placeholder: 'Token (opcjonalnie)' },
  { key: 'MCP_BASELINKER_URL', label: 'BaseLinker MCP Server URL', placeholder: 'https://...' },
  { key: 'MCP_BASELINKER_TOKEN', label: 'BaseLinker MCP Token', placeholder: 'Token (opcjonalnie)' },
  { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads Customer ID', placeholder: 'np. 123-456-7890' },
];

export default function AdminSettingsPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authError, setAuthError] = useState('');

  const handleLogin = async () => {
    setAuthError('');
    try {
      const res = await fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`);
      if (!res.ok) {
        setAuthError('Nieprawidlowe haslo');
        return;
      }
      const data = await res.json();
      setAuthenticated(true);
      // Show masked existing values as placeholders
    } catch {
      setAuthError('Blad polaczenia');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, settings: values }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Blad zapisu' });
      } else {
        setMessage({ type: 'success', text: data.message || 'Zapisano!' });
        // Clear values after save
        setValues({});
      }
    } catch {
      setMessage({ type: 'error', text: 'Blad polaczenia z serwerem' });
    } finally {
      setSaving(false);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-[16px] font-bold text-text">Panel administracyjny</h1>
          </div>

          <label className="block text-[12px] font-medium text-text-secondary mb-1">
            Haslo administratora
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Haslo..."
              className="flex-1 bg-wire-bg border border-border rounded px-3 py-2 text-[13px] text-text"
            />
            <button
              onClick={handleLogin}
              className="bg-primary text-white text-[13px] font-medium rounded px-4 py-2 hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Zaloguj
            </button>
          </div>
          {authError && (
            <p className="text-red text-[12px] mt-2">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  // Settings form
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-[16px] font-bold text-text">Ustawienia — Klucze API i serwery MCP</h1>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-[13px] ${
          message.type === 'success' ? 'bg-green-bg text-green border border-green/20' : 'bg-red-bg text-red border border-red/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {SETTING_FIELDS.map((field) => (
          <div key={field.key} className="px-4 py-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              {field.label}
            </label>
            <div className="flex gap-2">
              <input
                type={showKeys[field.key] ? 'text' : 'password'}
                value={values[field.key] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="flex-1 bg-wire-bg border border-border rounded px-3 py-1.5 text-[13px] text-text font-mono"
              />
              <button
                onClick={() => toggleShowKey(field.key)}
                className="text-text-secondary hover:text-text transition-colors cursor-pointer px-2"
                title={showKeys[field.key] ? 'Ukryj' : 'Pokaz'}
              >
                {showKeys[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || Object.values(values).every((v) => !v.trim())}
          className="flex items-center gap-2 bg-primary text-white text-[13px] font-medium rounded px-5 py-2.5 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
        </button>
        <span className="text-[11px] text-text-secondary">
          Po zapisaniu zrestartuj serwer (pnpm dev)
        </span>
      </div>

      <div className="mt-6 bg-yellow-bg border border-yellow/20 rounded-lg px-4 py-3 text-[12px] text-text-secondary">
        <strong className="text-yellow">Uwaga:</strong> Klucze sa zapisywane w pliku konfiguracyjnym na serwerze.
        Puste pola nie nadpisuja istniejacych wartosci. Po zmianie kluczy wymagany jest restart serwera.
      </div>
    </div>
  );
}
