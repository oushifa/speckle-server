import type { AuthContext } from '@/modules/shared/authz'

declare module 'express' {
  interface Request {
    context: AuthContext
  }
}

declare module 'http' {
  interface IncomingMessage {
    context?: AuthContext
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    context: AuthContext
  }
}

export {}
