import { authLogger, type Logger } from '@/observability/logging'
import { loggerWithMaybeContext } from '@/observability/utils/requestContext'
import { addToMailchimpAudience } from '@/modules/auth/services/mailchimp'
import { UserEvents } from '@/modules/core/domain/users/events'
import {
  getMailchimpNewsletterIds,
  getMailchimpOnboardingIds,
  getMailchimpStatus
} from '@/modules/shared/helpers/envHelper'
import type { EventBus, EventPayload } from '@/modules/shared/services/eventBus'

const onUserCreatedFactory =
  () =>
  async (payload: EventPayload<typeof UserEvents.Created>) => {
    const logger = loggerWithMaybeContext({ logger: authLogger })
    const { user, signUpCtx } = payload.payload

    try {
      // Set up mailchimp
      if (getMailchimpStatus()) {
        try {
          const newsletterConsent = signUpCtx?.newsletterConsent
          const { listId: onboardingListId } = getMailchimpOnboardingIds()
          await addToMailchimpAudience(user, onboardingListId)

          if (newsletterConsent) {
            const { listId: newsletterListId } = getMailchimpNewsletterIds()
            await addToMailchimpAudience(user, newsletterListId)
          }
        } catch (error) {
          logger.warn({ err: error }, 'Failed to sign up user to mailchimp lists')
        }
      }
    } catch (e) {
      logger.error(
        {
          err: e,
          userId: user.id
        },
        'Post sign up tracking failed'
      )
    }
  }

export const reportUserEventsFactory =
  (deps: { eventBus: EventBus; logger: Logger }) =>
  () => {
    const onUserCreated = onUserCreatedFactory()

    const cbs = [deps.eventBus.listen(UserEvents.Created, onUserCreated)]

    return () => cbs.forEach((cb) => cb())
  }
