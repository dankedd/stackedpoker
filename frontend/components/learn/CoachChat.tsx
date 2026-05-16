'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Bot, User, BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoachMessage } from '@/lib/learn/types'
import { sendCoachMessage } from '@/lib/learn/api'

// ── Props ──────────────────────────────────────────────────────────────────────

interface CoachChatProps {
  token: string
  context?: Record<string, unknown>
  sessionId?: string | null
  className?: string
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

export function CoachChat({
  token,
  context = {},
  sessionId: initSessionId = null,
  className,
}: CoachChatProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initSessionId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      setMessages(prev => [...prev, reply])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'coach',
          content: "Sorry, I couldn't connect right now. Please try again in a moment.",
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const noMessages = messages.length === 0

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-border/50 bg-card/60 overflow-hidden',
        className
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card/80 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500">
          <BrainCircuit className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-none">AI Coach</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">GTO-aware poker tutor</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400/70 font-medium">Online</span>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {noMessages && (
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
}
