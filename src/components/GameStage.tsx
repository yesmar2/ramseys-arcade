import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { fitStage } from '../lib/stage'

type GameStageProps = {
  aspectWidth: number
  aspectHeight: number
  className?: string
  children: ReactNode
}

/** Centers a fixed-aspect playfield inside the available area (letterbox bars outside). */
export function GameStage({
  aspectWidth,
  aspectHeight,
  className,
  children,
}: GameStageProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const sync = () => {
      const { width, height } = shell.getBoundingClientRect()
      setSize(fitStage(width, height, aspectWidth, aspectHeight))
    }

    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(shell)
    window.addEventListener('orientationchange', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', sync)
    }
  }, [aspectWidth, aspectHeight])

  const stageStyle = {
    width: size.w > 0 ? `${size.w}px` : undefined,
    height: size.h > 0 ? `${size.h}px` : undefined,
    aspectRatio: `${aspectWidth} / ${aspectHeight}`,
  } as CSSProperties

  return (
    <div className="game-shell" ref={shellRef}>
      <div className={`game-stage${className ? ` ${className}` : ''}`} style={stageStyle}>
        {children}
      </div>
    </div>
  )
}
