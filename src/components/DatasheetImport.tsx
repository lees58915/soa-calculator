import { useEffect, useRef, useState } from 'react';
import { extractFromPdf, extractFromText, type ExtractionResult, summarizeExtraction } from '../engine/datasheetExtractor';
import type { DeviceRecord } from '../engine/deviceDatabase';
import { fnum } from '../engine/soaEngine';

interface DatasheetImportProps {
  open: boolean;
  onClose: () => void;
  onApply: (device: Partial<DeviceRecord>) => void;
}

export function DatasheetImport({ open, onClose, onApply }: DatasheetImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    if (file.size > 10 * 1024 * 1024) {
      setError('File is larger than 10 MB — processing may be slow or fail.');
    }
    try {
      const res = await extractFromPdf(file);
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to extract from PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleText = () => {
    setError(null);
    setResult(null);
    const trimmed = pastedText.trim();
    if (trimmed.length < 20) {
      setError('Text is too short — paste at least a few lines of the datasheet.');
      return;
    }
    try {
      const res = extractFromText(trimmed);
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to parse text.');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Allow default paste behavior — this is just for extra safety
    const text = e.clipboardData.getData('text');
    if (text.length > 500_000) {
      e.preventDefault();
      setError('Pasted text is too large (>500KB). Try pasting just the relevant tables.');
    }
  };

  const buildDevice = (): Partial<DeviceRecord> => {
    if (!result) return {};
    const out: Partial<DeviceRecord> = {};
    for (const [k, v] of Object.entries(result.fields)) {
      if (!v) continue;
      // @ts-expect-error: we know the keys
      out[k] = v.value;
    }
    out.id = (out.manufacturer ?? 'unk').toLowerCase().replace(/\s+/g, '-') + '-' + (out.partNumber ?? 'unnamed').toLowerCase();
    return out;
  };

  const apply = () => {
    if (!result) return;
    onApply(buildDevice());
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>Import from Datasheet</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="importer">
          <div className={'importer-drop' + (dragging ? ' dz-active' : '')}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon">PDF</div>
            <div className="drop-title">Drop a datasheet PDF here</div>
            <div className="drop-sub">or click to browse — processing is local in your browser</div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          <div className="importer-or">— or paste text —</div>
          <textarea
            className="text-input"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste the absolute-maximum / electrical-characteristics table here..."
            rows={6}
          />
          <div className="importer-actions">
            <button className="btn-secondary" onClick={handleText} disabled={!pastedText.trim()}>
              Parse Text
            </button>
          </div>

          {busy && <div className="busy">Reading PDF...</div>}
          {error && <div className="err-msg show">{error}</div>}

          {result && (
            <div className="extract-result">
              <h3>Extracted {result.pages > 0 ? `(${result.pages} page${result.pages === 1 ? '' : 's'})` : 'from text'}</h3>
              <div className="field-grid">
                {Object.entries(result.fields).length === 0 && (
                  <div className="muted">No fields detected. Check the input.</div>
                )}
                {Object.entries(result.fields).map(([k, v]) => v && (
                  <div className={'field-card conf-' + v.confidence} key={k}>
                    <div className="f-name">{k}</div>
                    <div className="f-val">
                      {typeof v.value === 'number' ? fnum(v.value, 3) : String(v.value)}
                    </div>
                    <div className="f-conf">{v.confidence}</div>
                    {v.raw && <div className="f-raw">{v.raw}</div>}
                  </div>
                ))}
              </div>

              {result.warnings.length > 0 && (
                <div className="advisory show">
                  <div className="adv-h">⚠ Review carefully</div>
                  <ul>
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <details className="raw-text">
                <summary>Raw extracted text ({result.text.length} chars)</summary>
                <pre>{summarizeExtraction(result)}</pre>
              </details>
            </div>
          )}
        </div>

        <div className="modal-f">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={apply} disabled={!result || busy}>
            Apply to Calculator
          </button>
        </div>
      </div>
    </div>
  );
}
