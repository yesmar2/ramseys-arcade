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

function isNarrowPhoneViewport() {
  if (typeof window === 'undefined') return false
  return Boolean(window.matchMedia?.('(max-width: 767px)').matches)
}

export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const maxTouch = navigator.maxTouchPoints || 0
  const narrow = isNarrowPhoneViewport()

  if (/iPhone|iPod/i.test(ua)) return 'phone'
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) return 'tablet'
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua) || narrow) return 'phone'
    return 'tablet'
  }

  if (narrow) return 'phone'

  const coarse =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(pointer: coarse)').matches)
  // Windows / desktop often report many touch points — fine pointer still means desktop
  if (!coarse) return 'desktop'

  const shortest = Math.min(
    window.screen?.width || Number.POSITIVE_INFINITY,
    window.screen?.height || Number.POSITIVE_INFINITY,
    window.innerWidth || Number.POSITIVE_INFINITY,
    window.innerHeight || Number.POSITIVE_INFINITY,
  )
  if (Number.isFinite(shortest) && shortest < 600) return 'phone'
  return 'tablet'
}

export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(() => detectDeviceType())

  useEffect(() => {
    const sync = () => setDevice(detectDeviceType())
    const narrowMq = window.matchMedia('(max-width: 767px)')
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    narrowMq.addEventListener('change', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      narrowMq.removeEventListener('change', sync)
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
