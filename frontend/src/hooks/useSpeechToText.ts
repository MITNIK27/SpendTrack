import { useCallback, useEffect, useRef, useState } from "react"

// Minimal shape of the Web Speech API we actually use — TypeScript's DOM lib
// doesn't ship types for it since it was never standardized past a draft.
interface SpeechRecognitionResultLike {
  transcript: string
}
interface SpeechRecognitionEventLike extends Event {
  results: { [index: number]: { [index: number]: SpeechRecognitionResultLike } }
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Wraps the browser's native Web Speech API for a single "record a short
 * remark" interaction — not continuous dictation. Chrome/Edge only; callers
 * must check `isSupported` and hide their mic UI entirely when false rather
 * than rendering a button that silently does nothing (Firefox/Safari). */
export function useSpeechToText(onResult: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const Ctor = getSpeechRecognitionCtor()
  const isSupported = Ctor !== null

  // Latest transcript seen so far *this recording* — despite interimResults
  // being false, Chrome still fires onresult repeatedly mid-utterance with a
  // growing (not incremental) transcript, so each event's text must REPLACE
  // this, never append to it. The actual caller callback fires once, from
  // onend, with whatever this settled on — that's the one point a single
  // recording is truly finished.
  const latestTranscriptRef = useRef("")

  useEffect(() => {
    if (!Ctor) return
    const recognition = new Ctor()
    // en-US, not en-IN — Chrome's speech engine is most heavily trained on
    // this locale and recognizes general English (including Indian-accented
    // speech) more reliably with it than with en-IN in practice.
    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) latestTranscriptRef.current = transcript
    }
    // Whether it finished normally or errored out, always drop back to the
    // idle state — otherwise a denied mic permission leaves the button
    // stuck showing "recording" forever.
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => {
      setIsListening(false)
      if (latestTranscriptRef.current) onResultRef.current(latestTranscriptRef.current)
      latestTranscriptRef.current = ""
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(() => {
    if (!recognitionRef.current) return
    setIsListening(true)
    recognitionRef.current.start()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { isSupported, isListening, start, stop }
}
