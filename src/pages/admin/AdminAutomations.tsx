import { useCallback, useEffect, useMemo, useState } from 'react';
import { Zap, CheckCircle2, PauseCircle, X, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AUTOMATION_FLAGS_KEY,
  getAutomationsWithFlags,
  readAutomationFlags,
  writeAutomationFlags,
  type Automation,
  type AutomationStatus,
} from '@/lib/automations';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// Relative-time formatter matching the AdminAbandonedCarts convention
// (calendar-day anchored for > 1d, hour/minute precision for < 1d).
// Falls back to empty string for malformed dates so a bad ISO won't
// blow up the row render.
function formatRelative(iso: string | null): string {
  if (!iso) return 'jamais';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const now = Date.now();
  const diffMs = now - t.getTime();
  if (diffMs < 0) return "à l'instant";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.max(
    1,
    Math.round((startOfDay(new Date(now)).getTime() - startOfDay(t).getTime()) / 86_400_000),
  );
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Admin catalog of transactional automations with pause/resume toggles and a recent-runs drawer. */
export default function AdminAutomations() {
  useDocumentTitle('Automatisations — Admin Vision Affichage');

  // Merge localStorage overrides on top of seed defaults at mount.
  // Keep the merged list in state so the toggle renders instantly
  // without a re-read of localStorage — and the state is the source
  // of truth while the drawer is open.
  const [automations, setAutomations] = useState<Automation[]>(() => getAutomationsWithFlags());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (selectedId ? automations.find(a => a.id === selectedId) ?? null : null),
    [automations, selectedId],
  );

  // Re-sync from storage if another tab writes the flag map — keeps
  // two admin tabs consistent without a manual reload.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== AUTOMATION_FLAGS_KEY) return;
      setAutomations(getAutomationsWithFlags());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleStatus = useCallback((id: string) => {
    setAutomations(prev => {
      const next = prev.map(a =>
        a.id === id
          ? { ...a, status: (a.status === 'active' ? 'paused' : 'active') as AutomationStatus }
          : a,
      );
      // Persist only the overrides, not the whole registry — lets us
      // extend the seed catalog later without blowing away the admin's
      // pause state.
      const flags = readAutomationFlags();
      const target = next.find(a => a.id === id);
      if (target) {
        flags[id] = target.status;
        writeAutomationFlags(flags);
        toast.success(
          target.status === 'paused'
            ? `« ${target.name} » mise en pause`
            : `« ${target.name} » réactivée`,
        );
      }
      return next;
    });
  }, []);

  const activeCount = automations.filter(a => a.status === 'active').length;
  const pausedCount = automations.length - activeCount;
  const failingCount = automations.filter(a =>
    a.recentRuns.slice(0, 3).some(r => !r.ok),
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Automatisations</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Flux transactionnels déclenchés par Shopify, le site et Zapier. Mets en pause une
            automatisation pour bloquer son prochain envoi — la préférence est sauvegardée dans
            ton navigateur.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={CheckCircle2}
          label="Actives"
          value={activeCount}
          color="emerald"
        />
        <SummaryCard
          icon={PauseCircle}
          label="En pause"
          value={pausedCount}
          color="amber"
        />
        <SummaryCard
          icon={AlertCircle}
          label="Erreurs récentes"
          value={failingCount}
          color="rose"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Zap size={16} className="text-[#E8A838]" aria-hidden="true" />
          <h2 className="font-bold text-sm">Catalogue des automatisations</h2>
          <span className="text-xs text-zinc-400">· {automations.length}</span>
        </div>
        <div role="table" aria-label="Liste des automatisations" className="divide-y divide-zinc-100">
          <div
            role="row"
            className="hidden md:grid grid-cols-[2fr_1.4fr_1.4fr_110px_120px_80px] gap-4 px-5 py-2.5 bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500"
          >
            <div role="columnheader">Nom</div>
            <div role="columnheader">Déclencheur</div>
            <div role="columnheader">Action</div>
            <div role="columnheader">Statut</div>
            <div role="columnheader">Dernier envoi</div>
            <div role="columnheader" className="text-right">Activer</div>
          </div>
          {automations.map(a => (
            <AutomationRow
              key={a.id}
              automation={a}
              onSelect={() => setSelectedId(a.id)}
              onToggle={() => toggleStatus(a.id)}
            />
          ))}
        </div>
      </div>

      {selected && (
        <RunsDrawer
          automation={selected}
          onClose={() => setSelectedId(null)}
          onToggle={() => toggleStatus(selected.id)}
        />
      )}
    </div>
  );
}

// ───────────────── Row ─────────────────

interface RowProps {
  automation: Automation;
  onSelect: () => void;
  onToggle: () => void;
}

function AutomationRow({ automation, onSelect, onToggle }: RowProps) {
  const { id, name, triggerEvent, action, status, lastFired, recentRuns } = automation;
  const hasRecentFailure = recentRuns.slice(0, 3).some(r => !r.ok);

  // Entire row is a button so keyboard users can activate the drawer
  // with Enter/Space. The toggle switch is nested — we stop the click
  // from bubbling up so flipping pause/active doesn't also open the
  // drawer.
  return (
    <div
      role="row"
      className="group grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1.4fr_110px_120px_80px] gap-2 md:gap-4 px-5 py-3.5 hover:bg-zinc-50 focus-within:bg-zinc-50 transition-colors cursor-pointer"
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      aria-label={`Voir les exécutions récentes de ${name}`}
    >
      <div role="cell" className="min-w-0">
        <div className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
          <span className="truncate">{name}</span>
          {hasRecentFailure && (
            <span
              title="Au moins une erreur dans les 3 derniers envois"
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full"
            >
              <AlertCircle size={10} aria-hidden="true" />
              erreur
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-400 md:hidden mt-0.5 truncate">{triggerEvent}</div>
      </div>
      <div role="cell" className="text-xs text-zinc-600 truncate hidden md:block">{triggerEvent}</div>
      <div role="cell" className="text-xs text-zinc-600 truncate hidden md:block">{action}</div>
      <div role="cell">
        <StatusBadge status={status} />
      </div>
      <div role="cell" className="text-xs text-zinc-500 flex items-center gap-1.5">
        <Clock size={11} className="text-zinc-400" aria-hidden="true" />
        {formatRelative(lastFired)}
      </div>
      <div role="cell" className="flex justify-end">
        <SwitchButton
          id={id}
          label={name}
          enabled={status === 'active'}
          onToggle={() => {
            // stop row click from firing — toggling should not also open
            // the drawer.
            onToggle();
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AutomationStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      En pause
    </span>
  );
}

interface SwitchProps {
  id: string;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

function SwitchButton({ id, label, enabled, onToggle }: SwitchProps) {
  const labelId = `automation-${id}-switch`;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? 'Mettre en pause' : 'Activer'} ${label}`}
      aria-labelledby={labelId}
      onClick={e => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={e => {
        // Prevent Space/Enter from bubbling to the row handler which
        // would also open the drawer on toggle.
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
      }}
      className={`relative inline-block w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
        enabled ? 'bg-[#0052CC]' : 'bg-zinc-300'
      }`}
    >
      <span className="sr-only" id={labelId}>{label}</span>
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
          enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

// ───────────────── Summary card ─────────────────

interface SummaryProps {
  icon: typeof Zap;
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'rose';
}

function SummaryCard({ icon: Icon, label, value, color }: SummaryProps) {
  const ring: Record<SummaryProps['color'], string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${ring[color]}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
        <div className="text-2xl font-extrabold text-[#1B3A6B] leading-tight">{value}</div>
      </div>
    </div>
  );
}

// ───────────────── Drawer ─────────────────

interface DrawerProps {
  automation: Automation;
  onClose: () => void;
  onToggle: () => void;
}

function RunsDrawer({ automation, onClose, onToggle }: DrawerProps) {
  useEscapeKey(true, onClose);
  useBodyScrollLock(true);
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const runs = automation.recentRuns.slice(0, 10);

  return (
    <>
      <button
        type="button"
        aria-label="Fermer le panneau"
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-drawer-title"
        className="fixed top-0 right-0 bottom-0 w-full sm:max-w-md bg-white z-50 shadow-2xl flex flex-col"
      >
        <header className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#0052CC]">
              Automatisation
            </div>
            <h2 id="automation-drawer-title" className="text-lg font-extrabold text-[#1B3A6B] truncate">
              {automation.name}
            </h2>
            <div className="mt-1">
              <StatusBadge status={automation.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3 border-b border-zinc-100 bg-zinc-50/50">
          <MetaRow label="Déclencheur" value={automation.triggerEvent} />
          <MetaRow label="Action" value={automation.action} />
          <MetaRow
            label="Dernier envoi"
            value={automation.lastFired ? formatAbsolute(automation.lastFired) : 'Jamais'}
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {automation.status === 'active' ? 'Active' : 'En pause'}
            </span>
            <SwitchButton
              id={automation.id}
              label={automation.name}
              enabled={automation.status === 'active'}
              onToggle={onToggle}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            10 dernières exécutions
          </h3>
          {runs.length === 0 ? (
            <div className="text-center text-xs text-zinc-500 py-8">Aucune exécution enregistrée.</div>
          ) : (
            <ol className="space-y-2">
              {runs.map((run, i) => (
                <li
                  key={`${run.at}-${i}`}
                  className="border border-zinc-100 rounded-xl px-3.5 py-2.5 bg-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        run.ok
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {run.ok ? 'OK' : 'Erreur'}
                    </span>
                    <span className="text-[11px] text-zinc-500">{formatAbsolute(run.at)}</span>
                  </div>
                  <div className="text-xs text-zinc-700 mt-1.5 leading-relaxed">{run.msg}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5">
        {label}
      </span>
      <span className="text-xs text-zinc-800 text-right font-medium">{value}</span>
    </div>
  );
}
