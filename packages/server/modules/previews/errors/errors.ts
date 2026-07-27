import { BaseError } from '@/modules/shared/errors'

export class PreviewProjectOwnerNotFoundError extends BaseError {
  static code = 'PREVIEW_PROJECT_OWNER_NOT_FOUND'
  static defaultMessage =
    'Unable to find a valid execution user for the preview generation request.'
}
