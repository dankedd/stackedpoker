'use client'

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, type ReactNode, type KeyboardEvent } from 'react'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoachMessage } from '@/lib/learn/types'
import { sendCoachMessage } from '@/lib/learn/api'

// ── Props ──────────────────────────────────────────────────────────────────────

interface CoachChatProps {
  token: string
  context?: Record<string, unknown>
  sessionId?: string | null
  className?: string
  /** Sent automatically once, on mount, as if the coach proactively opened
   *  the conversation (used for Coach Review's personalized lesson recap). */
  initialMessage?: string
  /** Rendered above the message list instead of the "ask anything" empty
   *  state — used for the Coach Review banner. */
  banner?: ReactNode
}

export interface CoachChatHandle {
  /** Sends a message as if the learner typed it — used by external
   *  "suggested question" buttons that live outside this component. */
  sendMessage: (text: string) => void
}

// ── Suggested starters ────────────────────────────────────────────────────────

const STARTERS = [
  'Why should I c-bet small on dry boards?',
  'When is it correct to fold to a pot-sized bet?',
  'How do I balance my bluffs?',
]

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border/50 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-violet-400/70 inline-block animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: CoachMessage }) {
  const isCoach = msg.role === 'coach'
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // tick used to re-render and refresh relative timestamp
  void tick

  return (
    <div className={cn('flex gap-3', isCoach ? 'items-start' : 'items-start flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5',
          isCoach
            ? 'bg-gradient-to-br from-violet-600 to-blue-500'
            : 'bg-secondary border border-border/60'
        )}
      >
        {isCoach ? (
          <Bot className="h-3.5 w-3.5 text-white" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Content + timestamp */}
      <div className={cn('flex flex-col gap-1 max-w-[85%]', isCoach ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isCoach
              ? 'rounded-tl-sm bg-card border border-border/50 text-foreground'
              : 'rounded-tr-sm bg-violet-600/15 border border-violet-500/25 text-foreground'
          )}
        >
          {msg.content}

          {msg.concept_ids && msg.concept_ids.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
              {msg.concept_ids.map(c => (
                <span
                  key={c}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400"
                >
                  {c.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/30 px-1">
          {relativeTime(msg.timestamp)}
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const CoachChat = forwardRef<CoachChatHandle, CoachChatProps>(function CoachChat({
  token,
  context = {},
  sessionId: initSessionId = null,
  className,
  initialMessage,
  banner,
}, ref) {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initSessionId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoStarted = useRef(false)

  // Auto-scroll on new messages or typing indicator
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleInputChange(val: string) {
    setInput(val)
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`
  }

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    const userMsg: CoachMessage = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const { session_id, reply } = await sendCoachMessage(currentSessionId, msg, context, token)
      setCurrentSessionId(session_id)
      setMessages(prev => [
        ...prev,
        reply.content.trim() ? reply : { ...reply, content: "Hmm, I didn't catch that — could you rephrase?" },
      ])
    } catch (err) {
      const status = (err as { status?: number } | undefined)?.status
      let content = "Sorry, I couldn't connect right now. Please try again in a moment."
      if (status === 401) content = 'Your session expired — please sign in again to keep chatting.'
      else if (status === 429) content = "You're sending messages a bit fast — give it a few seconds and try again."
      else if (status === 0) content = 'That took too long to respond. Please try again.'
      else if (status && status >= 500) content = 'The coach is temporarily unavailable. Please try again shortly.'
      setMessages(prev => [
        ...prev,
        { role: 'coach', content, timestamp: new Date().toISOString() },
      ])
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({ sendMessage: (text: string) => { void send(text) } }))

  // Auto-send the opening message once (e.g. Coach Review's lesson recap) —
  // the ref guard keeps this from double-firing under StrictMode's double-invoke.
  useEffect(() => {
    if (initialMessage && !autoStarted.current) {
      autoStarted.current = true
      void send(initialMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage])

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const noMessages = messages.length === 0

  return (
    // No card chrome of its own (border/rounded/bg) — this component is always
    // embedded directly beneath the page-level header inside that page's own
    // card, so adding a second border here would show as a visible seam.
    <div className={cn('flex flex-col overflow-hidden', className)}>
      {/* Message list — the page-level header above this component is the
          single source of the "Stacked Coach" title/Online status; this
          component intentionally has no header of its own. */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {banner && <div className="mb-1">{banner}</div>}

        {noMessages && !initialMessage && (
          <div className="space-y-3 py-4">
            <p className="text-center text-xs text-muted-foreground/50">
              Ask your AI coach anything about poker strategy
            </p>
            <div className="space-y-2">
              {STARTERS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className={cn(
                    'w-full text-left text-sm px-4 py-3 rounded-xl border',
                    'border-border/40 bg-secondary/30 text-muted-foreground/70',
                    'hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-foreground',
                    'transition-all duration-150'
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border/40 p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask your coach anything..."
            disabled={loading}
            className={cn(
              'flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm text-foreground',
              'bg-secondary/30 border border-border/50 outline-none',
              'placeholder:text-muted-foreground/35',
              'focus:border-violet-500/50 transition-colors',
              'min-h-[42px] max-h-[96px]',
              loading && 'opacity-50'
            )}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className={cn(
              'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl',
              'bg-gradient-to-r from-violet-600 to-blue-500 text-white',
              'disabled:opacity-35 hover:opacity-90 transition-opacity'
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/25 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
})
