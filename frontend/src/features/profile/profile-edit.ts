import type { ProfileUpdate } from '../auth/auth-context'

export type ProfileEditValues = {
  fullName: string
  bio: string
  organization: string
}

export function buildProfileUpdate(
  initial: ProfileEditValues,
  current: ProfileEditValues,
): ProfileUpdate {
  const update: ProfileUpdate = {}
  const fullName = current.fullName.trim()
  const bio = current.bio.trim()
  const organization = current.organization.trim()

  if (fullName !== initial.fullName.trim()) update.fullName = fullName || null
  if (bio !== initial.bio.trim()) update.bio = bio || null
  if (organization !== initial.organization.trim()) update.organization = organization || null

  return update
}
