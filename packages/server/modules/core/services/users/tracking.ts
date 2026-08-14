import type { updateMailchimpMemberTags } from '@/modules/auth/services/mailchimp'
import type { GetUser } from '@/modules/core/domain/users/operations'
import type {
  getMailchimpOnboardingIds,
  getMailchimpStatus
} from '@/modules/shared/helpers/envHelper'
import type { SetUserOnboardingChoices } from '@/modules/core/domain/users/operations'

export const setUserOnboardingChoicesFactory =
  (deps: {
    getUser: GetUser
    updateMailchimpMemberTags: typeof updateMailchimpMemberTags
    getMailchimpStatus: typeof getMailchimpStatus
    getMailchimpOnboardingIds: typeof getMailchimpOnboardingIds
  }): SetUserOnboardingChoices =>
  async ({ userId, choices }) => {
    const isMailchimpEnabled = deps.getMailchimpStatus()
    if (!isMailchimpEnabled) return

    const user = await deps.getUser(userId, { withRole: true })
    if (!user) return

    const { listId } = deps.getMailchimpOnboardingIds()
    await deps.updateMailchimpMemberTags(user, listId, choices)
  }
