import { DEVICE_LABELS, isDeviceType, type DeviceType } from '../lib/leaderboard'

type DeviceIconProps = {
  device?: DeviceType | string
  className?: string
}

export function DeviceIcon({ device, className }: DeviceIconProps) {
  const kind: DeviceType = isDeviceType(device) ? device : 'desktop'
  const label = DEVICE_LABELS[kind]
  return (
    <span className={className ?? 'lb-row__device'} title={label} aria-label={label}>
      {kind === 'phone' ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11 18.2h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : kind === 'tablet' ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11 17.4h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M8.5 20h7M12 16.5V20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}
