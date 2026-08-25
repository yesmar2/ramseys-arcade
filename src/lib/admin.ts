import { useAuth } from '../hooks/useAuth'

const ADMIN_EMAILS = new Set(
  String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
)

/** True for allowlisted emails, or anyone in local Vite DEV. */
export function isAdminAccount(account: { email?: string } | null | undefined) {
  if (import.meta.env.DEV) return true
  const email = account?.email?.trim().toLowerCase()
  return Boolean(email && ADMIN_EMAILS.has(email))
}

export function useIsAdmin() {
  const { account } = useAuth()
  return isAdminAccount(account)
}
