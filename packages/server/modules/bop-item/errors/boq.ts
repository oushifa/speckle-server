import { BaseError } from '@/modules/shared/errors'

export class BoqItemNotFoundError extends BaseError {
  static defaultMessage = 'BOQ item not found'
  static code = 'BOQ_ITEM_NOT_FOUND'
  static statusCode = 404
}

export class BoqItemValidationError extends BaseError {
  static defaultMessage = 'Invalid BOQ item data'
  static code = 'BOQ_ITEM_VALIDATION_ERROR'
  static statusCode = 400
}
