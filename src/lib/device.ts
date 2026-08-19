import { useEffect, useState } from 'react'

export type DeviceType = 'phone' | 'tablet' | 'desktop'

export const DEVICE_LABELS: Record<DeviceType, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  desktop: 'Desktop',
}

export function isDeviceType(value: unknown): value is DeviceType {
  return value === 'phone' || value === 'tablet' || value === 'desktop'
}

export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const maxTouch = navigator.maxTouchPoints || 0

  if (/iPhone|iPod/i.test(ua)) return 'phone'
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) return 'tablet'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet'

  const cssPhone =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(max-width: 639px)').matches)
  if (cssPhone) return 'phone'

  const coarse =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(pointer: coarse)').matches)
  if (!coarse && maxTouch < 2) return 'desktop'

  const shortest = Math.min(
    window.screen?.width || Number.POSITIVE_INFINITY,
    window.screen?.height || Number.POSITIVE_INFINITY,
    window.innerWidth || Number.POSITIVE_INFINITY,
    window.innerHeight || Number.POSITIVE_INFINITY,
  )
  if (Number.isFinite(shortest) && shortest < 600) return 'phone'
  if (coarse) return 'tablet'
  return 'desktop'
}

export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(() => detectDeviceType())

  useEffect(() => {
    const sync = () => setDevice(detectDeviceType())
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return device
}

export function formatDeviceList(devices: DeviceType[]): string {
  const labels = devices.map((d) => DEVICE_LABELS[d].toLowerCase())
  if (labels.length <= 1) return labels[0] ?? 'this device'
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}
