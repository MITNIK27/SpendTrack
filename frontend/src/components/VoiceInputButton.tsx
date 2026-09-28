import { Mic } from "lucide-react"
import { cn } from "cn"
import { useSpeechToText } from "@/hooks/useSpeechToText"

interface Props {
  onTranscript: (text: string) => void
  ariaLabel: string
  className?: string
}

/** "Speak to fill" mic button for a decision remark field — sits next to an
 * <Input>, not a replacement for it. Renders nothing when the browser has no
 * Web Speech API support (Firefox/Safari) rather than a button that silently
 * fails. Recording state is a single press/press-again toggle, matching the
 * familiar mic-button convention in Claude/ChatGPT/Gemini's own prompt box. */
export function VoiceInputButton({ onTranscript, ariaLabel, className }: Props) {
  const { isSupported, isListening, start, stop } = useSpeechToText(onTranscript)

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={isListening ? stop : start}
      aria-label={isListening ? `Stop recording — ${ariaLabel}` : ariaLabel}
      aria-pressed={isListening}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full transition-colors",
        isListening
          ? "animate-pulse bg-destructive/10 text-destructive"
          : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        className
      )}
    >
      <Mic className="size-3.5" />
    </button>
  )
}
