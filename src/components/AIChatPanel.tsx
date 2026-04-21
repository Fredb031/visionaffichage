import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, ChevronLeft, Trash2, Check, CheckCheck } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { KBTopic, Lang } from '@/lib/aiKnowledgeBase';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

type ViewMode = 'menu' | 'topic' | 'chat';

/** Dynamically load the knowledge base the first time the chat opens.
 * Keeps ~15 KB of bilingual Q&A out of the initial page bundle — it's
 * only relevant if the user actually talks to the bot.
 *
 * Retries on failure: we cache only successful modules. If the first
 * import rejects (chunk 404, network blip, captive portal), subsequent
 * calls used to return the same rejected promise forever — the chat
 * was permanently broken until page reload. Now a rejection clears the
 * cache so the next open can retry. */
type KbModule = typeof import('@/lib/aiKnowledgeBase');
let kbPromise: Promise<KbModule> | null = null;
const loadKb = () => {
  if (!kbPromise) {
    kbPromise = import('@/lib/aiKnowledgeBase').catch(err => {
      kbPromise = null;
      throw err;
    });
  }
  return kbPromise;
};

// sessionStorage key for the in-progress chat transcript. Per-session
// rather than persistent — closing the tab wipes the conversation, but
// a hard reload (page nav, customizer-mid-flow refresh) preserves it.
// Cap at 200 messages to match the in-memory MAX so we don't grow the
// quota unbounded across reloads.
const TRANSCRIPT_KEY = 'vision-aichat-transcript';
const TRANSCRIPT_MAX = 200;

function readTranscript(): ChatMessage[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(sessionStorage.getItem(TRANSCRIPT_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    // Defensive shape coercion — a devtools edit could land non-string
    // text or an unknown role and break the strict union downstream.
    const VALID_ROLES = new Set(['user', 'assistant']);
    return raw
      .filter((m): m is ChatMessage => {
        return !!m && typeof m === 'object'
          && VALID_ROLES.has(m.role)
          && typeof m.text === 'string'
          && typeof m.ts === 'number'
          && Number.isFinite(m.ts);
      })
      .slice(-TRANSCRIPT_MAX);
  } catch {
    return [];
  }
}

export function AIChatPanel() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('menu');
  const [activeTopic, setActiveTopic] = useState<KBTopic | null>(null);
  // Hydrate from sessionStorage on first mount so a customer who refreshes
  // mid-conversation doesn't lose context.
  const [messages, setMessages] = useState<ChatMessage[]>(() => readTranscript());
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [topics, setTopics] = useState<KBTopic[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Focus target when the clear-conversation button is clicked. The
  // button unmounts immediately after (gated on `messages.length > 0`),
  // so without an explicit restore the browser drops focus back to
  // <body> — keyboard users lose their place in the dialog and screen
  // readers announce nothing, making the action feel like the chat
  // closed. We refocus the always-present message input instead so the
  // user can keep typing.
  const inputRef = useRef<HTMLInputElement>(null);

  // If we hydrated to messages, show the chat view immediately so the
  // user sees their continued conversation instead of the topic menu.
  useEffect(() => {
    if (messages.length > 0) setView('chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist transcript on change. Keeps storage in sync with in-memory
  // state without blocking renders. Wrapped in try/catch for private-
  // browsing modes where setItem throws.
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      if (messages.length === 0) sessionStorage.removeItem(TRANSCRIPT_KEY);
      else sessionStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(messages.slice(-TRANSCRIPT_MAX)));
    } catch { /* private mode / quota — chat still works in-memory */ }
  }, [messages]);
  // Synchronous in-flight flag. The `thinking` STATE doesn't propagate
  // until React commits the next render, so an Enter press immediately
  // followed by a Click (or two clicks within one frame) both saw
  // `thinking=false` from their captured closure and pushed a duplicate
  // user message before the first send had a chance to flip the state.
  // The ref updates synchronously and is checked first.
  const sendingRef = useRef(false);

  // Warm-up: start loading the KB the first time the panel opens.
  // If the dynamic import fails (chunk 404, offline), log + swallow so
  // the chat still renders a typing input — users can still ask
  // questions (send() also catches and posts a fallback answer).
  useEffect(() => {
    if (!open) return;
    loadKb()
      .then(mod => setTopics(mod.KB_TOPICS))
      .catch(err => {
        console.warn('[AIChat] Failed to load knowledge base:', err);
      });
  }, [open]);

  // Auto-scroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, view]);

  useEscapeKey(open, () => setOpen(false), { skipInTextInputs: true });

  const hello = lang === 'fr'
    ? 'Salut ! Je réponds à toutes tes questions sur Vision Affichage — prix, délais, produits, impression, couleurs, livraison. Choisis un sujet ou pose-moi n\u2019importe quoi.'
    : 'Hi! I answer every question about Vision Affichage — pricing, timing, products, printing, colours, shipping. Pick a topic or ask anything.';

  const send = async (text: string) => {
    const trimmed = text.trim();
    // Check the synchronous ref first — `thinking` state lags one render
    // and an Enter+Click within the same frame would otherwise duplicate
    // the user message.
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;
    // Cap the transcript at 200 messages so a user who hammers the
    // bot in one session doesn't grow the in-memory list unbounded.
    // The DOM can handle it for a while but the scroll animation
    // chugs badly past ~500 nodes on lower-end phones, and the
    // knowledge-base answers are static so there's no research value
    // in keeping ancient history.
    const MAX_MESSAGES = 200;
    setMessages(m => {
      const next = [...m, { role: 'user' as const, text: trimmed, ts: Date.now() }];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
    setInput('');
    setThinking(true);
    setView('chat');
    try {
      // Natural pause so it doesn't feel like a form POST.
      await new Promise(r => setTimeout(r, 350 + Math.random() * 400));
      const { answerQuestion } = await loadKb();
      const { answer } = answerQuestion(trimmed, lang as Lang);
      setMessages(m => {
        const next = [...m, { role: 'assistant' as const, text: answer, ts: Date.now() }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    } catch (err) {
      // If the KB import fails (chunk 404, offline), the user was
      // stuck on an eternal "typing…" spinner with no reply. Surface
      // a graceful fallback so they can still call us.
      console.warn('[AIChat] Failed to answer:', err);
      const fallback = lang === 'fr'
        ? 'Désolé, je n\u2019arrive pas à charger mes réponses pour l\u2019instant. Appelle-nous au 367-380-4808 ou écris à info@visionaffichage.com.'
        : 'Sorry, I can\u2019t load my answers right now. Call us at 367-380-4808 or email info@visionaffichage.com.';
      setMessages(m => {
        const next = [...m, { role: 'assistant' as const, text: fallback, ts: Date.now() }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    } finally {
      setThinking(false);
      sendingRef.current = false;
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const openTopic = (topic: KBTopic) => {
    setActiveTopic(topic);
    setView('topic');
  };

  const pickFromTopic = (qFr: string, qEn: string, aFr: string, aEn: string) => {
    setMessages(m => [
      ...m,
      { role: 'user',      text: lang === 'fr' ? qFr : qEn, ts: Date.now() },
      { role: 'assistant', text: lang === 'fr' ? aFr : aEn, ts: Date.now() + 1 },
    ]);
    setView('chat');
  };

  const backToMenu = () => {
    // Always switch to the menu view — the button labelled "Parcourir
    // les sujets" / "Browse topics" promises navigation, and the prior
    // logic (setView('chat') when messages exist) made the button
    // appear to do nothing because chat was the view we were already
    // in. Messages remain in state and are visible again the next
    // time the user types into the input.
    setView('menu');
    setActiveTopic(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open
          ? (lang === 'en' ? 'Close chat' : 'Fermer la conversation')
          : (lang === 'en' ? 'Open chat' : 'Ouvrir la conversation')}
        aria-expanded={open}
        className="fixed right-4 z-[450] w-14 h-14 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0052CC]/30"
        // Float above the bottom nav (60 px) + iOS safe area + a bit
        // of breathing room. Replaces the old hardcoded bottom-24 px
        // that clashed with tall safe-area bezels on newer phones.
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        {open ? <X size={20} aria-hidden="true" /> : <MessageCircle size={22} aria-hidden="true" />}
        {!open && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={lang === 'en' ? 'Chat with Vision AI' : 'Discuter avec Vision AI'}
          aria-modal="false"
          className="fixed right-4 z-[450] w-[380px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-200px)] bg-white rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-[staggerUp_0.3s_cubic-bezier(.34,1.4,.64,1)_forwards]"
          // Sits directly above the FAB (FAB is at ~80 px from bottom
          // including safe-area; panel starts another 68 px up).
          style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 92px)' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white p-4 flex items-center gap-3">
            {view !== 'menu' && (
              <button
                type="button"
                onClick={() => { setView('menu'); setActiveTopic(null); }}
                aria-label={lang === 'en' ? 'Back to topics' : 'Retour aux sujets'}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0052CC]"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-sm">Vision AI</div>
              <div className="text-[11px] opacity-80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {lang === 'en' ? 'Online · Replies instantly' : 'En ligne · Réponse instantanée'}
              </div>
            </div>
            {/* Clear-conversation button — only shown when there's history.
                Now that the transcript persists across reload (sessionStorage)
                the user needs an explicit way to start fresh. */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  // Confirm prompt so a mis-click on the trash icon
                  // doesn't silently nuke a long conversation the user
                  // was still consulting. Bilingual to match the rest
                  // of the panel.
                  const prompt = lang === 'en'
                    ? 'Clear conversation?'
                    : 'Effacer la conversation ?';
                  if (typeof window !== 'undefined' && !window.confirm(prompt)) return;
                  setMessages([]);
                  setView('menu');
                  setActiveTopic(null);
                  // Belt-and-suspenders: the [messages] effect clears
                  // sessionStorage when the list empties, but clearing
                  // explicitly here keeps the wipe atomic with the
                  // user's click even if the effect is delayed.
                  try {
                    sessionStorage.removeItem(TRANSCRIPT_KEY);
                  } catch { /* private mode — no-op */ }
                  // The trash button unmounts as soon as messages is
                  // cleared — hand focus to the input so it doesn't
                  // fall to <body>. rAF defers past the re-render.
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                aria-label={lang === 'en' ? 'Clear conversation' : 'Effacer la conversation'}
                title={lang === 'en' ? 'Clear conversation' : 'Effacer la conversation'}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0052CC]"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Body — switches between menu / topic / chat */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-secondary/30">
            {view === 'menu' && (
              <div className="space-y-3">
                {/* Greeting */}
                <div className="bg-white border border-border rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                  {hello}
                </div>

                {/* Topic grid */}
                <div className="pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                    {lang === 'en' ? 'Browse by topic' : 'Parcourir par sujet'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {topics.map(topic => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => openTopic(topic)}
                        className="group flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2.5 text-left hover:border-[#0052CC] hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                      >
                        <span className="text-lg flex-shrink-0" aria-hidden="true">{topic.icon}</span>
                        <span className="text-[12px] font-bold text-foreground leading-tight group-hover:text-[#0052CC]">
                          {lang === 'fr' ? topic.titleFr : topic.titleEn}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hint */}
                <div className="text-[11px] text-muted-foreground text-center pt-2">
                  {lang === 'en' ? 'Or type your question below ↓' : 'Ou écris ta question ci-dessous ↓'}
                </div>
              </div>
            )}

            {view === 'topic' && activeTopic && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="text-lg" aria-hidden="true">{activeTopic.icon}</span>
                  <h3 className="text-sm font-extrabold text-foreground">
                    {lang === 'fr' ? activeTopic.titleFr : activeTopic.titleEn}
                  </h3>
                </div>
                {activeTopic.entries.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => pickFromTopic(entry.qFr, entry.qEn, entry.aFr, entry.aEn)}
                    className="w-full text-left bg-white border border-border rounded-xl px-3 py-2.5 hover:border-[#0052CC] hover:shadow-sm transition-all text-[13px] font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                  >
                    {lang === 'fr' ? entry.qFr : entry.qEn}
                  </button>
                ))}
              </div>
            )}

            {view === 'chat' && (
              <div className="space-y-3" role="log" aria-live="polite" aria-label={lang === 'en' ? 'Chat history' : 'Historique de la conversation'}>
                {messages.map((m, idx) => {
                  // Read-receipt state for user messages: single check as
                  // soon as it's on screen (delivered to local transcript),
                  // double check once the assistant has responded after
                  // it. Mirrors the iMessage/WhatsApp affordance so the
                  // customer has visual confirmation their question was
                  // processed — previously the bubble was silent and a
                  // slow reply read as "did it send?".
                  const isUser = m.role === 'user';
                  const answered = isUser && messages.slice(idx + 1).some(n => n.role === 'assistant');
                  return (
                    // Stable key tied to the message itself, not its array
                    // index. Once the transcript hits MAX_MESSAGES (200)
                    // the front gets sliced off and every surviving
                    // message's index shifts down by one — index-keyed
                    // nodes had their content swapped under them, which
                    // both burned a render and (worse) tripped aria-live
                    // to re-announce stale text in the screen-reader log.
                    <div
                      key={`${m.ts}-${m.role}`}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line ${
                          isUser
                            ? 'bg-[#0052CC] text-white rounded-br-md'
                            : 'bg-white text-foreground border border-border rounded-bl-md shadow-sm'
                        }`}
                      >
                        <span className="sr-only">{isUser ? (lang === 'en' ? 'You: ' : 'Toi : ') : (lang === 'en' ? 'Assistant: ' : 'Assistant : ')}</span>
                        {m.text}
                        {isUser && (
                          <span
                            className="ml-1.5 inline-flex items-center align-middle"
                            aria-label={answered ? (lang === 'en' ? 'Read' : 'Lu') : (lang === 'en' ? 'Delivered' : 'Livré')}
                            title={answered ? (lang === 'en' ? 'Read' : 'Lu') : (lang === 'en' ? 'Delivered' : 'Livré')}
                          >
                            {answered
                              ? <CheckCheck size={12} className="text-white/90" aria-hidden="true" />
                              : <Check      size={12} className="text-white/70" aria-hidden="true" />}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {thinking && (
                  <div className="flex justify-start" role="status" aria-live="polite">
                    <span className="sr-only">{lang === 'en' ? 'Assistant is typing…' : 'L\u2019assistant écrit…'}</span>
                    <div className="bg-white text-muted-foreground border border-border rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm flex items-center gap-1">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                          style={{ animationDelay: `${i * 120}ms` }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {messages.length > 0 && !thinking && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={backToMenu}
                      className="text-[11px] font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                    >
                      ← {lang === 'en' ? 'Browse topics' : 'Parcourir les sujets'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input — available on every view */}
          <form onSubmit={onSubmit} className="p-3 border-t border-border bg-white flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={lang === 'en' ? 'Ask anything…' : 'Pose ta question…'}
              aria-label={lang === 'en' ? 'Your question' : 'Ta question'}
              autoCapitalize="sentences"
              autoComplete="off"
              className="flex-1 bg-secondary border border-border rounded-full px-4 py-2 text-sm outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 transition-shadow"
              disabled={thinking}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="w-11 h-11 rounded-full bg-[#0052CC] text-white flex items-center justify-center disabled:opacity-30 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40 focus-visible:ring-offset-1"
              aria-label={lang === 'en' ? 'Send' : 'Envoyer'}
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
