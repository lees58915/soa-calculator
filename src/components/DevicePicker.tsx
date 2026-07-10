import { useEffect, useMemo, useState } from 'react';
import { getDeviceDatabase, SEED_DEVICES, type DeviceRecord } from '../engine/deviceDatabase';

interface DevicePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (device: DeviceRecord) => void;
}

export function DevicePicker({ open, onClose, onSelect }: DevicePickerProps) {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<DeviceRecord[]>([]);
  const [techFilter, setTechFilter] = useState<string>('all');
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const seedIds = useMemo(() => new Set(SEED_DEVICES.map((d) => d.id)), []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoaded(false);
    getDeviceDatabase()
      .list()
      .then((rs) => { if (active) { setRecords(rs); setLoaded(true); } })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (techFilter !== 'all' && r.technology !== techFilter) return false;
      if (!q) return true;
      return (
        r.partNumber.toLowerCase().includes(q) ||
        r.manufacturer.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.technology.toLowerCase().includes(q)
      );
    });
  }, [records, query, techFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDelete(id);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await getDeviceDatabase().remove(confirmDelete);
    setRecords((prev) => prev.filter((r) => r.id !== confirmDelete));
    setConfirmDelete(null);
  };

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>Device Database</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-toolbar">
          <input
            className="search-input"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="chip-row">
            {['all', 'Si', 'SiC', 'GaN'].map((t) => (
              <button
                key={t}
                className={'chip-btn' + (techFilter === t ? ' sel' : '')}
                onClick={() => setTechFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="device-list">
          {loaded && filtered.length === 0 && (
            <div className="empty">No devices match your search.</div>
          )}
          {!loaded && <div className="empty muted">Loading devices...</div>}
          {filtered.map((r) => (
            <button
              key={r.id}
              className="device-card"
              onClick={() => onSelect(r)}
            >
              <div className="dc-h">
                <div className="dc-mfr">{r.manufacturer}</div>
                <span className={'tech-badge tech-' + r.technology}>{r.technology}</span>
              </div>
              <div className="dc-pn">{r.partNumber}</div>
              {r.package && <div className="dc-pkg">Package: {r.package}</div>}
              {r.description && <div className="dc-desc">{r.description}</div>}
              <div className="dc-specs">
                <span><b>BV</b> {r.BV}V</span>
                <span><b>I<sub>D</sub></b> {r.ID_max}A</span>
                <span><b>R<sub>DS</sub></b> {r.RDS >= 0.001 ? (r.RDS * 1000).toFixed(1) + 'mΩ' : r.RDS.toFixed(3) + 'Ω'}</span>
                <span><b>T<sub>J</sub></b> {r.Tj_max}°C</span>
              </div>
              {!seedIds.has(r.id) && (
                <button className="dc-del" onClick={(e) => handleDelete(e, r.id)}>Delete</button>
              )}
            </button>
          ))}
        </div>

        {confirmDelete && (
          <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
              <p>Delete this custom device? This cannot be undone.</p>
              <div className="confirm-actions">
                <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button className="btn-danger" onClick={doDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
