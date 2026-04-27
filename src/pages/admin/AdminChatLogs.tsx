import { MessageSquare, AlertCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Volume II §22 — Admin Chat Logs.
//
// Surface for reviewing AIChatPanel sessions — operator triage of
// abandoned conversations, prompt tuning, escalation review. The
// Supabase `chat_sessions` table needs to land first (operator
// follow-up); until then we render a placeholder frame with the
// intended row shape so the route exists and the nav entry works.

interface ChatLogColumn {
  key: string;
  label: string;
  hint: string;
}

const COLUMNS: ChatLogColumn[] = [
  { key: 'started', label: 'Début', hint: 'started_at' },
  { key: 'visitor', label: 'Visiteur', hint: 'visitor_id / email' },
  { key: 'pages', label: 'Pages visitées', hint: 'context.pages[]' },
  { key: 'messages', label: 'Messages', hint: 'count(messages)' },
  { key: 'outcome', label: 'Résultat', hint: 'outcome (quote / cart / abandoned)' },
  { key: 'last', label: 'Dernier message', hint: 'last_message_at' },
];

export default function AdminChatLogs() {
  useDocumentTitle('Journaux de discussion — Admin');

  return (
    <div>
      <div role="status" className="mb-6 rounded-xl border border-[#D97706]/30 bg-[#FFFBEB] p-4 flex items-start gap-3">
        <span className="text-[#D97706] text-lg flex-shrink-0 mt-0.5" aria-hidden="true">⚠</span>
        <div className="flex-1">
          <p className="font-semibold text-[#0A0A0A] text-sm">Fonctionnalité en développement</p>
          <p className="text-[#374151] text-xs mt-1 leading-relaxed">
            Cette section attend la migration Supabase + l'intégration backend. Les données affichées peuvent être synthétiques ou vides en attendant. À ne pas utiliser comme source de vérité pour le moment.
          </p>
        </div>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <MessageSquare size={22} aria-hidden="true" className="text-[#0052CC]" />
          Journaux de discussion IA
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sessions du panneau AIChatPanel — utile pour l'ajustement de prompt, l'escalade et le suivi des conversions.
        </p>
      </div>

      <div
        role="note"
        className="mb-5 flex items-start gap-3 rounded-xl border border-[#E8A838]/40 bg-[#E8A838]/10 px-4 py-3 text-sm text-[#7a5208] dark:text-[#E8A838]"
      >
        <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <strong className="font-bold">Bientôt disponible.</strong>{' '}
          La table Supabase <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">chat_sessions</code> doit
          être créée avant que les sessions n'apparaissent ici. TODO opérateur :
          schéma (id, visitor_id, started_at, last_message_at, message_count, outcome enum, transcript jsonb, escalated_at nullable),
          activer la persistance côté <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">AIChatPanel</code> via
          un upsert à chaque message, puis brancher un select trié par <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">last_message_at desc</code> ici.
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                  >
                    <div>{col.label}</div>
                    <div className="mt-0.5 text-[10px] font-mono normal-case text-zinc-400 dark:text-zinc-500">
                      {col.hint}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center">
                  <div className="mx-auto max-w-md">
                    <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-[#0052CC]/10 text-[#0052CC] flex items-center justify-center">
                      <MessageSquare size={22} aria-hidden="true" />
                    </div>
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      Aucune session enregistrée
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Les conversations IA sont actuellement éphémères (mémoire de session côté navigateur).
                      Activez la persistance Supabase pour commencer la collecte.
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
