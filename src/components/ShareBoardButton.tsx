import { useEffect, useRef, useState } from 'react'

type ShareBoardButtonProps = {
  /** Short brag line, e.g. "#12 on Asteroids · All time" */
  label: string
  className?: string
}

export function ShareBoardButton({ label, className = '' }: ShareBoardButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  const share = async () => {
    const url = window.location.href
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: label, text: label, url })
        return
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${label}\n${url}`)
      setCopied(true)
      if (timer.current != null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`lb-share${className ? ` ${className}` : ''}`}
      onClick={() => void share()}
    >
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
