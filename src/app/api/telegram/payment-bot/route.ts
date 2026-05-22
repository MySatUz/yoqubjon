import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  activateManualSubscription,
  formatManualPaymentAmount,
  getTelegramAdminBaseUrl,
  rejectManualPaymentRequestById,
} from '@/lib/manual-payments';

export const runtime = 'nodejs';

type TelegramUser = {
  id: number;
  first_name?: string;
  username?: string;
};

type TelegramCallbackQuery = {
  id: string;
  from?: TelegramUser;
  data?: string;
  message?: {
    message_id: number;
    chat: { id: number | string };
  };
};

type TelegramMessage = {
  text?: string;
  chat: { id: number | string };
  from?: TelegramUser;
};

class TelegramWebhookError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'TelegramWebhookError';
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function optionalEnv(name: string) {
  return process.env[name]?.trim() || '';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getWebhookSecret() {
  return optionalEnv('TELEGRAM_WEBHOOK_SECRET') || sha256Hex(requiredEnv('TELEGRAM_BOT_TOKEN'));
}

function assertTelegramSecret(req: Request) {
  const actual = req.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!actual || actual !== getWebhookSecret()) {
    throw new TelegramWebhookError(401, 'Invalid Telegram webhook secret');
  }
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal error';
}

function getAdminIds() {
  return new Set(
    optionalEnv('TELEGRAM_ADMIN_IDS')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

function isPaymentChat(chatId: number | string | undefined) {
  const paymentChatId = optionalEnv('TELEGRAM_PAYMENT_CHAT_ID');
  return Boolean(paymentChatId && chatId !== undefined && String(chatId) === paymentChatId);
}

function assertAdmin(user: TelegramUser | undefined, chatId?: number | string) {
  if (!user) {
    throw new TelegramWebhookError(403, 'Telegram user is missing');
  }

  const admins = getAdminIds();
  if (admins.size) {
    if (!admins.has(String(user.id))) {
      throw new TelegramWebhookError(403, 'This Telegram user cannot manage payments');
    }
    return;
  }

  if (isPaymentChat(chatId)) return;
  throw new TelegramWebhookError(403, 'Set TELEGRAM_ADMIN_IDS or use the configured payment chat');
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = requiredEnv('TELEGRAM_BOT_TOKEN');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram ${method} failed`);
  }
  return payload.result;
}

async function answerCallbackQuery(callbackQueryId: string, text: string, alert = false) {
  await telegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: alert,
  }).catch((error) => console.warn('answerCallbackQuery failed:', error));
}

async function sendMessage(chatId: number | string, text: string) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

async function editActions(chatId: number | string, messageId: number) {
  const adminBaseUrl = getTelegramAdminBaseUrl();
  await telegramApi('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: adminBaseUrl
        ? [[{ text: 'Open admin', url: `${adminBaseUrl}/admin` }]]
        : [],
    },
  }).catch((error) => console.warn('editMessageReplyMarkup failed:', error));
}

function parseCallbackData(data: string | undefined) {
  const match = String(data || '').match(/^mysat:(approve|reject):([0-9a-f-]{36})$/i);
  if (!match) throw new TelegramWebhookError(400, 'Unsupported callback action');
  return { action: match[1].toLowerCase(), requestId: match[2] };
}

function parseCommand(text: string | undefined) {
  const match = String(text || '').trim().match(/^\/(approve|reject|id)(?:@\w+)?(?:\s+([0-9a-f-]{36}))?(?:\s+(.+))?$/i);
  if (!match) return null;
  return { command: match[1].toLowerCase(), requestId: match[2] || '', reason: match[3] || '' };
}

function reviewerLabel(user: TelegramUser) {
  return user.username ? `@${user.username}` : user.first_name || String(user.id);
}

async function getManualRequest(requestId: string) {
  const request = await prisma.manualPaymentRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: { email: true, name: true },
      },
    },
  });

  if (!request) {
    throw new TelegramWebhookError(404, 'Payment request was not found');
  }

  return request;
}

function formatAccessUntil(date: Date) {
  return date.toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function buildResultText(
  action: 'approved' | 'rejected',
  request: Awaited<ReturnType<typeof getManualRequest>>,
  expiresAt?: Date
) {
  const lines = [
    `<b>${action === 'approved' ? 'Subscription activated' : 'Payment request rejected'}</b>`,
    '',
    `<b>Request:</b> <code>${escapeHtml(request.id)}</code>`,
    `<b>User:</b> ${escapeHtml(request.payerName || request.user.name || 'User')}`,
    `<b>Email:</b> ${escapeHtml(request.user.email)}`,
    `<b>Amount:</b> ${escapeHtml(formatManualPaymentAmount(request.amount))}`,
  ];

  if (action === 'approved' && expiresAt) {
    lines.push(`<b>Access until:</b> ${escapeHtml(formatAccessUntil(expiresAt))}`);
  }

  return lines.join('\n');
}

async function approveRequest(requestId: string, reviewer: TelegramUser) {
  const adminNote = `Approved in Telegram by ${reviewerLabel(reviewer)} (${reviewer.id}).`;
  const result = await activateManualSubscription({
    requestId,
    adminUserId: `telegram:${reviewer.id}`,
    adminNote,
  });
  return {
    request: await getManualRequest(requestId),
    expiresAt: result.expiresAt,
  };
}

async function rejectRequest(requestId: string, reviewer: TelegramUser, reason = 'Rejected in Telegram.') {
  const adminNote = `${reason} By ${reviewerLabel(reviewer)} (${reviewer.id}).`;
  await rejectManualPaymentRequestById({
    requestId,
    reviewerId: `telegram:${reviewer.id}`,
    adminNote,
  });
  return getManualRequest(requestId);
}

async function handleCallback(callback: TelegramCallbackQuery) {
  assertAdmin(callback.from, callback.message?.chat.id);
  const { action, requestId } = parseCallbackData(callback.data);

  try {
    if (action === 'approve') {
      const result = await approveRequest(requestId, callback.from!);
      await answerCallbackQuery(callback.id, 'Subscription activated');
      if (callback.message) await editActions(callback.message.chat.id, callback.message.message_id);
      if (callback.message) {
        await sendMessage(callback.message.chat.id, buildResultText('approved', result.request, result.expiresAt));
      }
      return { ok: true };
    }

    const request = await rejectRequest(requestId, callback.from!);
    await answerCallbackQuery(callback.id, 'Payment request rejected');
    if (callback.message) await editActions(callback.message.chat.id, callback.message.message_id);
    if (callback.message) await sendMessage(callback.message.chat.id, buildResultText('rejected', request));
    return { ok: true };
  } catch (error) {
    await answerCallbackQuery(callback.id, safeErrorMessage(error), true);
    throw error;
  }
}

async function handleMessage(message: TelegramMessage) {
  const command = parseCommand(message.text);
  if (!command) return { ok: true, ignored: true };

  if (command.command === 'id') {
    await sendMessage(message.chat.id, `Your Telegram ID: <code>${escapeHtml(message.from?.id || '-')}</code>`);
    return { ok: true };
  }

  assertAdmin(message.from, message.chat.id);
  if (!command.requestId) {
    await sendMessage(
      message.chat.id,
      `Request ID is required. Example: <code>/${command.command} 00000000-0000-0000-0000-000000000000</code>`
    );
    return { ok: true };
  }

  if (command.command === 'approve') {
    const result = await approveRequest(command.requestId, message.from!);
    await sendMessage(message.chat.id, buildResultText('approved', result.request, result.expiresAt));
    return { ok: true };
  }

  const request = await rejectRequest(command.requestId, message.from!, command.reason || 'Rejected in Telegram.');
  await sendMessage(message.chat.id, buildResultText('rejected', request));
  return { ok: true };
}

export async function POST(req: Request) {
  try {
    assertTelegramSecret(req);
    const update: unknown = await req.json().catch(() => ({}));

    if (update && typeof update === 'object' && 'callback_query' in update) {
      return NextResponse.json(await handleCallback((update as { callback_query: TelegramCallbackQuery }).callback_query));
    }

    if (update && typeof update === 'object' && 'message' in update) {
      return NextResponse.json(await handleMessage((update as { message: TelegramMessage }).message));
    }

    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    console.error('Telegram payment bot failed:', error);
    const status = error instanceof TelegramWebhookError ? error.status : 500;
    return NextResponse.json({ ok: false, error: safeErrorMessage(error) }, { status });
  }
}
