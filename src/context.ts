import type * as tg from './deps/typegram.ts'
import * as tt from './telegram-types.ts'
import { Deunionize, PropOr, UnionKeys } from './deunionize.ts'
import { Guard, Guarded, MaybeArray } from './util.ts'
import Telegram from './telegram.ts'
import { FmtString } from './format.ts'

type Tail<T> = T extends [unknown, ...infer U] ? U : never

type Shorthand<FName extends keyof Telegram> = Telegram[FName] extends (
  ...args: infer Parameters
) => unknown
  ? Tail<Parameters>
  : never

/**
 * Narrows down `C['update']` (and derived getters)
 * to specific update type `U`.
 *
 * Used by [[`Composer`]],
 * possibly useful for splitting a bot into multiple files.
 */
export type NarrowedContext<C extends Context, U extends tg.Update> = C & {
  update: U
}

export type FilteredContext<
  Ctx extends Context,
  Filter extends tt.UpdateType | Guard<Ctx['update']>
> = Filter extends tt.UpdateType
  ? NarrowedContext<Ctx, Extract<tg.Update, Record<Filter, object>>>
  : NarrowedContext<Ctx, Guarded<Filter>>

// for types readability
export type Update = Deunionize<tg.Update>

export class Context<U extends Update = Update> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly state: Record<string | symbol, any> = {}

  constructor(
    readonly update: U,
    readonly telegram: Telegram,
    readonly botInfo: tg.UserFromGetMe
  ) {}

  get updateType() {
    for (const key in this.update) {
      if (typeof this.update[key] === 'object') return key as UpdateTypes<U>
    }

    throw new Error(
      `Cannot determine \`updateType\` of ${JSON.stringify(this.update)}`
    )
  }

  get me() {
    return this.botInfo?.username
  }

  get message(): U['message'] {
    return this.update.message
  }

  get editedMessage(): U['edited_message'] {
    return this.update.edited_message
  }

  get inlineQuery(): U['inline_query'] {
    return this.update.inline_query
  }

  get shippingQuery(): U['shipping_query'] {
    return this.update.shipping_query
  }

  get preCheckoutQuery(): U['pre_checkout_query'] {
    return this.update.pre_checkout_query
  }

  get chosenInlineResult(): U['chosen_inline_result'] {
    return this.update.chosen_inline_result
  }

  get channelPost(): U['channel_post'] {
    return this.update.channel_post
  }

  get editedChannelPost(): U['edited_channel_post'] {
    return this.update.edited_channel_post
  }

  get callbackQuery(): U['callback_query'] {
    return this.update.callback_query
  }

  get poll(): U['poll'] {
    return this.update.poll
  }

  get pollAnswer(): U['poll_answer'] {
    return this.update.poll_answer
  }

  get myChatMember(): U['my_chat_member'] {
    return this.update.my_chat_member
  }

  get chatMember(): U['chat_member'] {
    return this.update.chat_member
  }

  get chatJoinRequest(): U['chat_join_request'] {
    return this.update.chat_join_request
  }

  get chat(): Getter<U, 'chat'> {
    return (
      this.chatMember ??
      this.myChatMember ??
      this.chatJoinRequest ??
      getMessageFromAnySource(this)
    )?.chat as Getter<U, 'chat'>
  }

  get senderChat() {
    return getMessageFromAnySource(this)?.sender_chat as Getter<
      U,
      'sender_chat'
    >
  }

  get from() {
    return (
      this.callbackQuery ??
      this.inlineQuery ??
      this.shippingQuery ??
      this.preCheckoutQuery ??
      this.chosenInlineResult ??
      this.chatMember ??
      this.myChatMember ??
      this.chatJoinRequest ??
      getMessageFromAnySource(this)
    )?.from as Getter<U, 'from'>
  }

  get inlineMessageId() {
    return (this.callbackQuery ?? this.chosenInlineResult)?.inline_message_id
  }

  get passportData() {
    if (this.message == null) return undefined
    if (!('passport_data' in this.message)) return undefined
    return this.message?.passport_data
  }

  get webAppData() {
    if (
      !(
        'message' in this.update &&
        this.update.message &&
        'web_app_data' in this.update.message
      )
    )
      return undefined

    const { data, button_text } = this.update.message.web_app_data

    return {
      data: {
        json<T>() {
          return JSON.parse(data) as T
        },
        text() {
          return data
        },
      },
      button_text,
    }
  }

  /**
   * @internal
   */
  assert<T extends string | number | object>(
    value: T | undefined,
    method: string
  ): asserts value is T {
    if (value === undefined) {
      throw new TypeError(
        `Telegraf: "${method}" isn't available for "${this.updateType}"`
      )
    }
  }

  has<Ctx extends Context, Filter extends tt.UpdateType | Guard<Ctx['update']>>(
    this: Ctx,
    filters: MaybeArray<Filter>
  ): this is FilteredContext<Ctx, Filter> {
    if (!Array.isArray(filters)) filters = [filters]
    for (const filter of filters)
      if (
        typeof filter === 'function'
          ? // filter is a type guard
            filter(this.update)
          : // check if filter is the update type
            filter in this.update
      )
        return true

    return false
  }

  /**
   * @see https://core.telegram.org/bots/api#answerinlinequery
   */
  answerInlineQuery(...args: Shorthand<'answerInlineQuery'>) {
    this.assert(this.inlineQuery, 'answerInlineQuery')
    return this.telegram.answerInlineQuery(this.inlineQuery.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#answercallbackquery
   */
  answerCbQuery(...args: Shorthand<'answerCbQuery'>) {
    this.assert(this.callbackQuery, 'answerCbQuery')
    return this.telegram.answerCbQuery(this.callbackQuery.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#answercallbackquery
   */
  answerGameQuery(...args: Shorthand<'answerGameQuery'>) {
    this.assert(this.callbackQuery, 'answerGameQuery')
    return this.telegram.answerGameQuery(this.callbackQuery.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#answershippingquery
   */
  answerShippingQuery(...args: Shorthand<'answerShippingQuery'>) {
    this.assert(this.shippingQuery, 'answerShippingQuery')
    return this.telegram.answerShippingQuery(this.shippingQuery.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#answerprecheckoutquery
   */
  answerPreCheckoutQuery(...args: Shorthand<'answerPreCheckoutQuery'>) {
    this.assert(this.preCheckoutQuery, 'answerPreCheckoutQuery')
    return this.telegram.answerPreCheckoutQuery(
      this.preCheckoutQuery.id,
      ...args
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#editmessagetext
   */
  editMessageText(text: string, extra?: tt.ExtraEditMessageText) {
    this.assert(this.callbackQuery ?? this.inlineMessageId, 'editMessageText')
    return this.telegram.editMessageText(
      this.chat?.id,
      this.callbackQuery?.message?.message_id,
      this.inlineMessageId,
      text,
      extra
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#editmessagecaption
   */
  editMessageCaption(
    caption: string | undefined,
    extra?: tt.ExtraEditMessageCaption
  ) {
    this.assert(
      this.callbackQuery ?? this.inlineMessageId,
      'editMessageCaption'
    )
    return this.telegram.editMessageCaption(
      this.chat?.id,
      this.callbackQuery?.message?.message_id,
      this.inlineMessageId,
      caption,
      extra
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#editmessagemedia
   */
  editMessageMedia(media: tg.InputMedia, extra?: tt.ExtraEditMessageMedia) {
    this.assert(this.callbackQuery ?? this.inlineMessageId, 'editMessageMedia')
    return this.telegram.editMessageMedia(
      this.chat?.id,
      this.callbackQuery?.message?.message_id,
      this.inlineMessageId,
      media,
      extra
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#editmessagereplymarkup
   */
  editMessageReplyMarkup(markup: tg.InlineKeyboardMarkup | undefined) {
    this.assert(
      this.callbackQuery ?? this.inlineMessageId,
      'editMessageReplyMarkup'
    )
    return this.telegram.editMessageReplyMarkup(
      this.chat?.id,
      this.callbackQuery?.message?.message_id,
      this.inlineMessageId,
      markup
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#editmessagelivelocation
   */
  editMessageLiveLocation(
    latitude: number,
    longitude: number,
    extra?: tt.ExtraEditMessageLiveLocation
  ) {
    this.assert(
      this.callbackQuery ?? this.inlineMessageId,
      'editMessageLiveLocation'
    )
    return this.telegram.editMessageLiveLocation(
      this.chat?.id,
      this.callbackQuery?.message?.message_id,
      this.inlineMessageId,
      latitude,
      longitude,
      extra
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#stopmessagelivelocation
   */
  stopMessageLiveLocation(markup?: tg.InlineKeyboardMarkup) {
    this.assert(
      this.callbackQuery ?? this.inlineMessageId,
      'stopMessageLiveLocation'
    )
    return this.telegram.stopMessageLiveLocation(
      this.chat?.id,
      this.callbackQuery?.message?.message_id,
      this.inlineMessageId,
      markup
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#sendmessage
   */
  sendMessage(text: string | FmtString, extra?: tt.ExtraReplyMessage) {
    this.assert(this.chat, 'sendMessage')
    return this.telegram.sendMessage(this.chat.id, text, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendmessage
   */
  reply(text: string, extra?: tt.ExtraReplyMessage) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendMessage(text, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#getchat
   */
  getChat(...args: Shorthand<'getChat'>) {
    this.assert(this.chat, 'getChat')
    return this.telegram.getChat(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#exportchatinvitelink
   */
  exportChatInviteLink(...args: Shorthand<'exportChatInviteLink'>) {
    this.assert(this.chat, 'exportChatInviteLink')
    return this.telegram.exportChatInviteLink(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#createchatinvitelink
   */
  createChatInviteLink(...args: Shorthand<'createChatInviteLink'>) {
    this.assert(this.chat, 'createChatInviteLink')
    return this.telegram.createChatInviteLink(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#editchatinvitelink
   */
  editChatInviteLink(...args: Shorthand<'editChatInviteLink'>) {
    this.assert(this.chat, 'editChatInviteLink')
    return this.telegram.editChatInviteLink(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#revokechatinvitelink
   */
  revokeChatInviteLink(...args: Shorthand<'revokeChatInviteLink'>) {
    this.assert(this.chat, 'revokeChatInviteLink')
    return this.telegram.revokeChatInviteLink(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#banchatmember
   */
  banChatMember(...args: Shorthand<'banChatMember'>) {
    this.assert(this.chat, 'banChatMember')
    return this.telegram.banChatMember(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#unbanchatmember
   */
  unbanChatMember(...args: Shorthand<'unbanChatMember'>) {
    this.assert(this.chat, 'unbanChatMember')
    return this.telegram.unbanChatMember(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#restrictchatmember
   */
  restrictChatMember(...args: Shorthand<'restrictChatMember'>) {
    this.assert(this.chat, 'restrictChatMember')
    return this.telegram.restrictChatMember(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#promotechatmember
   */
  promoteChatMember(...args: Shorthand<'promoteChatMember'>) {
    this.assert(this.chat, 'promoteChatMember')
    return this.telegram.promoteChatMember(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#setchatadministratorcustomtitle
   */
  setChatAdministratorCustomTitle(
    ...args: Shorthand<'setChatAdministratorCustomTitle'>
  ) {
    this.assert(this.chat, 'setChatAdministratorCustomTitle')
    return this.telegram.setChatAdministratorCustomTitle(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#setchatphoto
   */
  setChatPhoto(...args: Shorthand<'setChatPhoto'>) {
    this.assert(this.chat, 'setChatPhoto')
    return this.telegram.setChatPhoto(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#deletechatphoto
   */
  deleteChatPhoto(...args: Shorthand<'deleteChatPhoto'>) {
    this.assert(this.chat, 'deleteChatPhoto')
    return this.telegram.deleteChatPhoto(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#setchattitle
   */
  setChatTitle(...args: Shorthand<'setChatTitle'>) {
    this.assert(this.chat, 'setChatTitle')
    return this.telegram.setChatTitle(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#setchatdescription
   */
  setChatDescription(...args: Shorthand<'setChatDescription'>) {
    this.assert(this.chat, 'setChatDescription')
    return this.telegram.setChatDescription(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#pinchatmessage
   */
  pinChatMessage(...args: Shorthand<'pinChatMessage'>) {
    this.assert(this.chat, 'pinChatMessage')
    return this.telegram.pinChatMessage(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#unpinchatmessage
   */
  unpinChatMessage(...args: Shorthand<'unpinChatMessage'>) {
    this.assert(this.chat, 'unpinChatMessage')
    return this.telegram.unpinChatMessage(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#unpinallchatmessages
   */
  unpinAllChatMessages(...args: Shorthand<'unpinAllChatMessages'>) {
    this.assert(this.chat, 'unpinAllChatMessages')
    return this.telegram.unpinAllChatMessages(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#leavechat
   */
  leaveChat(...args: Shorthand<'leaveChat'>) {
    this.assert(this.chat, 'leaveChat')
    return this.telegram.leaveChat(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#setchatpermissions
   */
  setChatPermissions(...args: Shorthand<'setChatPermissions'>) {
    this.assert(this.chat, 'setChatPermissions')
    return this.telegram.setChatPermissions(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#getchatadministrators
   */
  getChatAdministrators(...args: Shorthand<'getChatAdministrators'>) {
    this.assert(this.chat, 'getChatAdministrators')
    return this.telegram.getChatAdministrators(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#getchatmember
   */
  getChatMember(...args: Shorthand<'getChatMember'>) {
    this.assert(this.chat, 'getChatMember')
    return this.telegram.getChatMember(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#getchatmembercount
   */
  getChatMembersCount(...args: Shorthand<'getChatMembersCount'>) {
    this.assert(this.chat, 'getChatMembersCount')
    return this.telegram.getChatMembersCount(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#setpassportdataerrors
   */
  setPassportDataErrors(errors: readonly tg.PassportElementError[]) {
    this.assert(this.from, 'setPassportDataErrors')
    return this.telegram.setPassportDataErrors(this.from.id, errors)
  }

  /**
   * @see https://core.telegram.org/bots/api#sendphoto
   */
  sendPhoto(photo: string | tt.InputFile, extra?: tt.ExtraPhoto) {
    this.assert(this.chat, 'sendPhoto')
    return this.telegram.sendPhoto(this.chat.id, photo, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendphoto
   */
  replyWithPhoto(photo: string | tt.InputFile, extra?: tt.ExtraPhoto) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendPhoto(photo, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendmediagroup
   */
  sendMediaGroup(media: tt.MediaGroup, extra?: tt.ExtraMediaGroup) {
    this.assert(this.chat, 'sendMediaGroup')
    return this.telegram.sendMediaGroup(this.chat.id, media, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendmediagroup
   */
  replyWithMediaGroup(media: tt.MediaGroup, extra?: tt.ExtraMediaGroup) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendMediaGroup(media, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendaudio
   */
  sendAudio(audio: string | tt.InputFile, extra?: tt.ExtraAudio) {
    this.assert(this.chat, 'sendAudio')
    return this.telegram.sendAudio(this.chat.id, audio, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendaudio
   */
  replyWithAudio(audio: string | tt.InputFile, extra?: tt.ExtraAudio) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendAudio(audio, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#senddice
   */
  sendDice(extra?: tt.ExtraDice) {
    this.assert(this.chat, 'sendDice')
    return this.telegram.sendDice(this.chat.id, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#senddice
   */
  replyWithDice(extra?: tt.ExtraDice) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendDice({ reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#senddocument
   */
  sendDocument(document: string | tt.InputFile, extra?: tt.ExtraDocument) {
    this.assert(this.chat, 'sendDocument')
    return this.telegram.sendDocument(this.chat.id, document, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#senddocument
   */
  replyWithDocument(document: string | tt.InputFile, extra?: tt.ExtraDocument) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendDocument(document, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendsticker
   */
  sendSticker(sticker: string | tt.InputFile, extra?: tt.ExtraSticker) {
    this.assert(this.chat, 'sendSticker')
    return this.telegram.sendSticker(this.chat.id, sticker, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendsticker
   */
  replyWithSticker(sticker: string | tt.InputFile, extra?: tt.ExtraSticker) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendSticker(sticker, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvideo
   */
  sendVideo(video: string | tt.InputFile, extra?: tt.ExtraVideo) {
    this.assert(this.chat, 'sendVideo')
    return this.telegram.sendVideo(this.chat.id, video, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvideo
   */
  replyWithVideo(video: string | tt.InputFile, extra?: tt.ExtraVideo) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendVideo(video, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendanimation
   */
  sendAnimation(animation: string | tt.InputFile, extra?: tt.ExtraAnimation) {
    this.assert(this.chat, 'sendAnimation')
    return this.telegram.sendAnimation(this.chat.id, animation, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendanimation
   */
  replyWithAnimation(
    animation: string | tt.InputFile,
    extra?: tt.ExtraAnimation
  ) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendAnimation(animation, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvideonote
   */
  sendVideoNote(videoNote: string | tt.InputFile, extra?: tt.ExtraVideoNote) {
    this.assert(this.chat, 'sendVideoNote')
    return this.telegram.sendVideoNote(this.chat.id, videoNote, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvideonote
   */
  replyWithVideoNote(
    videoNote: string | tt.InputFile,
    extra?: tt.ExtraVideoNote
  ) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendVideoNote(videoNote, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendinvoice
   */
  sendInvoice(invoice: tt.NewInvoiceParameters, extra?: tt.ExtraInvoice) {
    this.assert(this.chat, 'sendInvoice')
    return this.telegram.sendInvoice(this.chat.id, invoice, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendinvoice
   */
  replyWithInvoice(invoice: tt.NewInvoiceParameters, extra?: tt.ExtraInvoice) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendInvoice(invoice, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendgame
   */
  sendGame(game: string, extra?: tt.ExtraGame) {
    this.assert(this.chat, 'sendGame')
    return this.telegram.sendGame(this.chat.id, game, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendgame
   */
  replyWithGame(gameName: string, extra?: tt.ExtraGame) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendGame(gameName, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvoice
   */
  sendVoice(voice: string | tt.InputFile, extra?: tt.ExtraVoice) {
    this.assert(this.chat, 'sendVoice')
    return this.telegram.sendVoice(this.chat.id, voice, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvoice
   */
  replyWithVoice(voice: string | tt.InputFile, extra?: tt.ExtraVoice) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendVoice(voice, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendpoll
   */
  sendPoll(poll: string, options: readonly string[], extra?: tt.ExtraPoll) {
    this.assert(this.chat, 'sendPoll')
    return this.telegram.sendPoll(this.chat.id, poll, options, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendpoll
   */
  replyWithPoll(
    question: string,
    options: readonly string[],
    extra?: tt.ExtraPoll
  ) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendPoll(question, options, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendpoll
   */
  sendQuiz(quiz: string, options: readonly string[], extra?: tt.ExtraPoll) {
    this.assert(this.chat, 'sendQuiz')
    return this.telegram.sendQuiz(this.chat.id, quiz, options, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendpoll
   */
  replyWithQuiz(
    question: string,
    options: readonly string[],
    extra: tt.ExtraPoll
  ) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendQuiz(question, options, { reply_to_message_id, ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#stoppoll
   */
  stopPoll(...args: Shorthand<'stopPoll'>) {
    this.assert(this.chat, 'stopPoll')
    return this.telegram.stopPoll(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#sendchataction
   */
  sendChatAction(...args: Shorthand<'sendChatAction'>) {
    this.assert(this.chat, 'sendChatAction')
    return this.telegram.sendChatAction(this.chat.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#sendlocation
   */
  sendLocation(latitude: number, longitude: number, extra?: tt.ExtraLocation) {
    this.assert(this.chat, 'sendLocation')
    return this.telegram.sendLocation(this.chat.id, latitude, longitude, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendlocation
   */
  replyWithLocation(
    latitude: number,
    longitude: number,
    extra?: tt.ExtraLocation
  ) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendLocation(latitude, longitude, {
      reply_to_message_id,
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvenue
   */
  sendVenue(
    latitude: number,
    longitude: number,
    title: string,
    address: string,
    extra?: tt.ExtraVenue
  ) {
    this.assert(this.chat, 'sendVenue')
    return this.telegram.sendVenue(
      this.chat.id,
      latitude,
      longitude,
      title,
      address,
      { message_thread_id: getThreadId(this.message), ...extra }
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#sendvenue
   */
  replyWithVenue(
    latitude: number,
    longitude: number,
    title: string,
    address: string,
    extra?: tt.ExtraVenue
  ) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendVenue(latitude, longitude, title, address, {
      reply_to_message_id,
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendcontact
   */
  sendContact(phoneNumber: string, firstName: string, extra?: tt.ExtraContact) {
    this.assert(this.chat, 'sendContact')
    return this.telegram.sendContact(this.chat.id, phoneNumber, firstName, {
      message_thread_id: getThreadId(this.message),
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendcontact
   */
  replyWithContact(
    phoneNumber: string,
    firstName: string,
    extra?: tt.ExtraContact
  ) {
    const reply_to_message_id = getMessageFromAnySource(this)?.message_id
    return this.sendContact(phoneNumber, firstName, {
      reply_to_message_id,
      ...extra,
    })
  }

  /**
   * @see https://core.telegram.org/bots/api#setchatstickerset
   */
  setChatStickerSet(setName: string) {
    this.assert(this.chat, 'setChatStickerSet')
    return this.telegram.setChatStickerSet(this.chat.id, setName)
  }

  /**
   * @see https://core.telegram.org/bots/api#deletechatstickerset
   */
  deleteChatStickerSet() {
    this.assert(this.chat, 'deleteChatStickerSet')
    return this.telegram.deleteChatStickerSet(this.chat.id)
  }

  /**
   * Use this method to create a topic in a forum supergroup chat. The bot must be an administrator in the chat for this
   * to work and must have the can_manage_topics administrator rights. Returns information about the created topic as a
   * ForumTopic object.
   *
   * @see https://core.telegram.org/bots/api#createforumtopic
   */
  createForumTopic(...args: Shorthand<'createForumTopic'>) {
    this.assert(this.chat, 'createForumTopic')
    return this.telegram.createForumTopic(this.chat.id, ...args)
  }

  /**
   * Use this method to edit name and icon of a topic in a forum supergroup chat. The bot must be an administrator in
   * the chat for this to work and must have can_manage_topics administrator rights, unless it is the creator of the
   * topic. Returns True on success.
   *
   * @see https://core.telegram.org/bots/api#editforumtopic
   */
  editForumTopic(extra: tt.ExtraEditForumTopic) {
    this.assert(this.chat, 'editForumTopic')
    this.assert(this.message?.message_thread_id, 'editForumTopic')
    return this.telegram.editForumTopic(
      this.chat.id,
      this.message.message_thread_id,
      extra
    )
  }

  /**
   * Use this method to close an open topic in a forum supergroup chat. The bot must be an administrator in the chat
   * for this to work and must have the can_manage_topics administrator rights, unless it is the creator of the topic.
   * Returns True on success.
   *
   * @see https://core.telegram.org/bots/api#closeforumtopic
   */
  closeForumTopic() {
    this.assert(this.chat, 'closeForumTopic')
    this.assert(this.message?.message_thread_id, 'closeForumTopic')

    return this.telegram.closeForumTopic(
      this.chat.id,
      this.message.message_thread_id
    )
  }

  /**
   * Use this method to reopen a closed topic in a forum supergroup chat. The bot must be an administrator in the chat
   * for this to work and must have the can_manage_topics administrator rights, unless it is the creator of the topic.
   * Returns True on success.
   *
   * @see https://core.telegram.org/bots/api#reopenforumtopic
   */
  reopenForumTopic() {
    this.assert(this.chat, 'reopenForumTopic')
    this.assert(this.message?.message_thread_id, 'reopenForumTopic')

    return this.telegram.reopenForumTopic(
      this.chat.id,
      this.message.message_thread_id
    )
  }

  /**
   * Use this method to delete a forum topic along with all its messages in a forum supergroup chat. The bot must be an
   * administrator in the chat for this to work and must have the can_delete_messages administrator rights.
   * Returns True on success.
   *
   * @see https://core.telegram.org/bots/api#deleteforumtopic
   */
  deleteForumTopic() {
    this.assert(this.chat, 'deleteForumTopic')
    this.assert(this.message?.message_thread_id, 'deleteForumTopic')

    return this.telegram.deleteForumTopic(
      this.chat.id,
      this.message.message_thread_id
    )
  }

  /**
   * Use this method to clear the list of pinned messages in a forum topic. The bot must be an administrator in the chat
   * for this to work and must have the can_pin_messages administrator right in the supergroup. Returns True on success.
   *
   * @see https://core.telegram.org/bots/api#unpinallforumtopicmessages
   */
  unpinAllForumTopicMessages() {
    this.assert(this.chat, 'unpinAllForumTopicMessages')
    this.assert(this.message?.message_thread_id, 'unpinAllForumTopicMessages')

    return this.telegram.unpinAllForumTopicMessages(
      this.chat.id,
      this.message.message_thread_id
    )
  }

  /**
   * @deprecated use {@link Telegram.setStickerPositionInSet}
   * @see https://core.telegram.org/bots/api#setstickerpositioninset
   */
  setStickerPositionInSet(sticker: string, position: number) {
    return this.telegram.setStickerPositionInSet(sticker, position)
  }

  /**
   * @deprecated use {@link Telegram.setStickerSetThumb}
   * @see https://core.telegram.org/bots/api#setstickersetthumb
   */
  setStickerSetThumb(...args: Parameters<Telegram['setStickerSetThumb']>) {
    return this.telegram.setStickerSetThumb(...args)
  }

  /**
   * @deprecated use {@link Telegram.deleteStickerFromSet}
   * @see https://core.telegram.org/bots/api#deletestickerfromset
   */
  deleteStickerFromSet(sticker: string) {
    return this.telegram.deleteStickerFromSet(sticker)
  }

  /**
   * @see https://core.telegram.org/bots/api#uploadstickerfile
   */
  uploadStickerFile(...args: Shorthand<'uploadStickerFile'>) {
    this.assert(this.from, 'uploadStickerFile')
    return this.telegram.uploadStickerFile(this.from.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#createnewstickerset
   */
  createNewStickerSet(...args: Shorthand<'createNewStickerSet'>) {
    this.assert(this.from, 'createNewStickerSet')
    return this.telegram.createNewStickerSet(this.from.id, ...args)
  }

  /**
   * @see https://core.telegram.org/bots/api#addstickertoset
   */
  addStickerToSet(...args: Shorthand<'addStickerToSet'>) {
    this.assert(this.from, 'addStickerToSet')
    return this.telegram.addStickerToSet(this.from.id, ...args)
  }

  /**
   * @deprecated use {@link Context.replyWithMarkdownV2}
   * @see https://core.telegram.org/bots/api#sendmessage
   */
  replyWithMarkdown(markdown: string, extra?: tt.ExtraReplyMessage) {
    return this.reply(markdown, { parse_mode: 'Markdown', ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendmessage
   */
  replyWithMarkdownV2(markdown: string, extra?: tt.ExtraReplyMessage) {
    return this.reply(markdown, { parse_mode: 'MarkdownV2', ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#sendmessage
   */
  replyWithHTML(html: string, extra?: tt.ExtraReplyMessage) {
    return this.reply(html, { parse_mode: 'HTML', ...extra })
  }

  /**
   * @see https://core.telegram.org/bots/api#deletemessage
   */
  deleteMessage(messageId?: number) {
    this.assert(this.chat, 'deleteMessage')
    if (typeof messageId !== 'undefined') {
      return this.telegram.deleteMessage(this.chat.id, messageId)
    }
    const message = getMessageFromAnySource(this)
    this.assert(message, 'deleteMessage')
    return this.telegram.deleteMessage(this.chat.id, message.message_id)
  }

  /**
   * @see https://core.telegram.org/bots/api#forwardmessage
   */
  forwardMessage(
    chatId: string | number,
    extra?: Shorthand<'forwardMessage'>[2]
  ) {
    const message = getMessageFromAnySource(this)
    this.assert(message, 'forwardMessage')
    return this.telegram.forwardMessage(
      chatId,
      message.chat.id,
      message.message_id,
      extra
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#copymessage
   */
  copyMessage(chatId: string | number, extra?: tt.ExtraCopyMessage) {
    const message = getMessageFromAnySource(this)
    this.assert(message, 'copyMessage')
    return this.telegram.copyMessage(
      chatId,
      message.chat.id,
      message.message_id,
      extra
    )
  }

  /**
   * @see https://core.telegram.org/bots/api#approvechatjoinrequest
   */
  approveChatJoinRequest(userId: number) {
    this.assert(this.chat, 'approveChatJoinRequest')
    return this.telegram.approveChatJoinRequest(this.chat.id, userId)
  }

  /**
   * @see https://core.telegram.org/bots/api#declinechatjoinrequest
   */
  declineChatJoinRequest(userId: number) {
    this.assert(this.chat, 'declineChatJoinRequest')
    return this.telegram.declineChatJoinRequest(this.chat.id, userId)
  }

  /**
   * @see https://core.telegram.org/bots/api#banchatsenderchat
   */
  banChatSenderChat(senderChatId: number) {
    this.assert(this.chat, 'banChatSenderChat')
    return this.telegram.banChatSenderChat(this.chat.id, senderChatId)
  }

  /**
   * @see https://core.telegram.org/bots/api#unbanchatsenderchat
   */
  unbanChatSenderChat(senderChatId: number) {
    this.assert(this.chat, 'unbanChatSenderChat')
    return this.telegram.unbanChatSenderChat(this.chat.id, senderChatId)
  }

  /**
   * Use this method to change the bot's menu button in the current private chat. Returns true on success.
   * @see https://core.telegram.org/bots/api#setchatmenubutton
   */
  setChatMenuButton(menuButton?: tg.MenuButton) {
    this.assert(this.chat, 'setChatMenuButton')
    return this.telegram.setChatMenuButton({ chatId: this.chat.id, menuButton })
  }

  /**
   * Use this method to get the current value of the bot's menu button in the current private chat. Returns MenuButton on success.
   * @see https://core.telegram.org/bots/api#getchatmenubutton
   */
  getChatMenuButton() {
    this.assert(this.chat, 'getChatMenuButton')
    return this.telegram.getChatMenuButton({ chatId: this.chat.id })
  }

  /**
   * @see https://core.telegram.org/bots/api#setmydefaultadministratorrights
   */
  setMyDefaultAdministratorRights(
    extra?: Parameters<Telegram['setMyDefaultAdministratorRights']>[0]
  ) {
    return this.telegram.setMyDefaultAdministratorRights(extra)
  }

  /**
   * @see https://core.telegram.org/bots/api#getmydefaultadministratorrights
   */
  getMyDefaultAdministratorRights(
    extra?: Parameters<Telegram['getMyDefaultAdministratorRights']>[0]
  ) {
    return this.telegram.getMyDefaultAdministratorRights(extra)
  }
}

export default Context

type UpdateTypes<U extends Deunionize<tg.Update>> = Extract<
  UnionKeys<U>,
  tt.UpdateType
>

export type GetUpdateContent<U extends tg.Update> =
  U extends tg.Update.CallbackQueryUpdate
    ? U['callback_query']['message']
    : U[UpdateTypes<U>]

type Getter<U extends Deunionize<tg.Update>, P extends string> = PropOr<
  GetUpdateContent<U>,
  P
>

function getMessageFromAnySource<U extends Deunionize<tg.Update>>(
  ctx: Context<U>
) {
  return (
    ctx.message ??
    ctx.editedMessage ??
    ctx.callbackQuery?.message ??
    ctx.channelPost ??
    ctx.editedChannelPost
  )
}

const getThreadId = (msg?: tg.Message) =>
  msg?.is_topic_message ? msg.message_thread_id : undefined
