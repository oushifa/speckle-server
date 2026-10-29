export const isAssignedApprover = (
  approverIds: string[],
  userId: string,
  verifiedEmail?: string | null,
  userName?: string | null
): boolean => {
  if (!approverIds || approverIds.length === 0) return true
  const normEmail = verifiedEmail ? String(verifiedEmail).trim().toLowerCase() : null
  const normName = userName ? String(userName).trim().toLowerCase() : null
  const normUserId = userId ? String(userId).trim() : ''
  return approverIds.some((id) => {
    if (!id) return false
    const trimmed = String(id).trim()
    if (normUserId && trimmed === normUserId) return true
    if (normEmail && trimmed.toLowerCase() === normEmail) return true
    if (normName && trimmed.toLowerCase() === normName) return true
    return false
  })
}
