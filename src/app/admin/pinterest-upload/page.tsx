'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface ParsedRow {
  [key: string]: string;
}

interface PinterestStatus {
  uploadedAt: string | null;
  campaignCount: number;
}

export default function PinterestUploadPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pinterestStatus, setPinterestStatus] = useState<PinterestStatus>({ uploadedAt: null, campaignCount: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ADMIN_PASSWORD = 'room99admin';

  useEffect(() => {
    if (isAuthenticated) {
      checkPinterestStatus();
    }
  }, [isAuthenticated]);

  const checkPinterestStatus = async () => {
    try {
      const res = await fetch('/api/upload-pinterest', {
        method: 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        setPinterestStatus(data);
      }
    } catch {
      // Pinterest data may not exist yet
    }
  };

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setStatus(null);
    } else {
      setStatus({ type: 'error', message: 'Nieprawidlowe haslo' });
    }
  };

  const parseCSV = async (file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> => {
    const Papa = (await import('papaparse')).default;
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as ParsedRow[];
          const headers = results.meta.fields || [];
          resolve({ headers, rows });
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  };

  const handleFile = async (selectedFile: File) => {
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(ext)) {
      setStatus({ type: 'error', message: 'Nieobslugiwany format pliku. Uzyj CSV lub XLSX.' });
      return;
    }

    setFile(selectedFile);
    setStatus({ type: 'info', message: `Plik "${selectedFile.name}" zaladowany. Parsowanie...` });

    try {
      const { headers, rows } = await parseCSV(selectedFile);
      setHeaders(headers);
      setPreview(rows.slice(0, 10));
      setStatus({ type: 'info', message: `Zaladowano ${rows.length} wierszy. Podglad ponizej (max 10 wierszy).` });
    } catch {
      setStatus({ type: 'error', message: 'Blad podczas parsowania pliku.' });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleSubmit = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Wybierz plik do przeslania.' });
      return;
    }

    setIsUploading(true);
    setStatus({ type: 'info', message: 'Przesylanie danych...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-pinterest', {
        method: 'POST',
        headers: {
          'x-admin-password': password,
        },
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: result.message || 'Dane Pinterest zaktualizowane pomyslnie!' });
        setFile(null);
        setPreview([]);
        setHeaders([]);
        checkPinterestStatus();
      } else {
        setStatus({ type: 'error', message: result.error || 'Blad podczas przesylania danych.' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Blad polaczenia z serwerem.' });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-6 max-w-md mx-auto mt-12">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8">
          <h1 className="text-[20px] font-bold text-[var(--text)] mb-6">Panel administracyjny</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mb-4">Wprowadz haslo, aby uzyskac dostep do importu danych Pinterest.</p>

          <div className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Haslo administratora"
              className="w-full px-3 py-2.5 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              onClick={handleLogin}
              className="w-full px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              Zaloguj
            </button>
          </div>

          {status && (
            <div className={`mt-4 px-3 py-2.5 rounded-lg text-[13px] font-medium ${
              status.type === 'error' ? 'bg-[var(--red-bg)] text-[var(--red)]' : ''
            }`}>
              {status.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[20px] font-bold text-[var(--text)] border-b-2 border-[var(--primary)] pb-2">
        Panel administracyjny — Import danych Pinterest
      </h1>

      {/* Current Pinterest data status */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
        <h2 className="text-[14px] font-bold text-[var(--text)] mb-3">Status danych Pinterest</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          <div>
            <span className="text-[var(--text-secondary)]">Ostatnia aktualizacja:</span>
            <span className="ml-2 font-medium text-[var(--text)]">
              {pinterestStatus.uploadedAt || 'Brak danych'}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">Liczba kampanii:</span>
            <span className="ml-2 font-medium text-[var(--text)]">
              {pinterestStatus.campaignCount}
            </span>
          </div>
        </div>
      </div>

      {/* File upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[var(--primary)] bg-[#e8f0fe]'
            : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--wire-bg)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
        <div className="text-[var(--text-secondary)] mb-2">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-[14px] font-semibold text-[var(--text)] mb-1">
          {file ? file.name : 'Przeciagnij plik CSV/XLSX lub kliknij, aby wybrac'}
        </p>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Obslugiwane formaty: CSV, XLSX
        </p>
      </div>

      {/* Status message */}
      {status && (
        <div className={`px-4 py-3 rounded-lg text-[13px] font-medium ${
          status.type === 'success' ? 'bg-[var(--green-bg)] text-[var(--green)]' :
          status.type === 'error' ? 'bg-[var(--red-bg)] text-[var(--red)]' :
          'bg-[#e8f0fe] text-[#1a73e8]'
        }`}>
          {status.message}
        </div>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[var(--wire-bg)] border-b border-[var(--border)]">
            <h3 className="text-[13px] font-bold text-[var(--text)]">Podglad danych (pierwsze 10 wierszy)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2.5 border-b border-[var(--border)] whitespace-nowrap">
                        {row[h] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit button */}
      {preview.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className={`px-6 py-2.5 text-[13px] font-semibold rounded-lg text-white transition-opacity ${
              isUploading
                ? 'bg-[var(--text-secondary)] cursor-not-allowed'
                : 'bg-[var(--primary)] hover:opacity-90'
            }`}
          >
            {isUploading ? 'Przesylanie...' : 'Importuj dane Pinterest'}
          </button>
        </div>
      )}
    </div>
  );
}
