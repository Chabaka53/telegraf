import { http, Buffer } from '../../platform/network.ts'
import { debug } from '../../deps/debug.ts'
import { type Update } from '../../deps/typegram.ts'
import { json } from '../../vendor/stream-consumers.ts'

const d = debug('telegraf:webhook')

export default function generateWebhook(
  filter: (req: http.IncomingMessage) => boolean,
  updateHandler: (update: Update) => Promise<void>
) {
  return async (
    req: http.IncomingMessage & { body?: Update },
    res: http.ServerResponse,
    next = (): void => {
      res.statusCode = 403
      d('Replying with status code', res.statusCode)
      res.end()
    }
  ): Promise<void> => {
    d('Incoming request', req.method, req.url)

    if (!filter(req)) {
      d('Webhook filter failed', req.method, req.url)
      return next()
    }

    let update: Update

    try {
      if (req.body != null) {
        /* If req.body is already set, we expect it to be the parsed
         request body (update object) received from Telegram
         However, some libraries such as `serverless-http` set req.body to the
         raw buffer, so we'll handle that additionally */

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let body: any = req.body
        // if body is Buffer, parse it into string
        if (body instanceof Buffer) body = String(req.body)
        // if body is string, parse it into object
        if (typeof body === 'string') body = JSON.parse(body)
        update = body
      } else {
        update = (await json(req)) as Update
      }
    } catch (error: unknown) {
      // if any of the parsing steps fails, give up and respond with error
      res.writeHead(415, {}).end()
      d('Failed to parse request body:', error)
      return
    }

    try {
      await updateHandler(update)
    } finally {
      if (!res.writableEnded) res.end()
    }
  }
}
