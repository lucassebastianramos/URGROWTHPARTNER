import { ENV } from '../config/env.js';

export interface TelegramCallAlertOptions {
  chatIds?: (string | null | undefined)[] | string | null;
  doorbellName: string;
  doorbellSlug: string;
  unitLabel: string;
  callId: string;
  residentCallUrl: string;
  visitorIp: string;
  startedAt: Date;
}

/**
 * Dispatches instant Telegram notifications with inline button to answer the call
 */
export async function sendTelegramCallAlert(options: TelegramCallAlertOptions): Promise<boolean> {
  let targetChatIds: string[] = [];

  if (Array.isArray(options.chatIds)) {
    targetChatIds = options.chatIds.filter((id): id is string => Boolean(id));
  } else if (typeof options.chatIds === 'string' && options.chatIds.trim()) {
    targetChatIds = [options.chatIds.trim()];
  }

  // Fallback to default chat ID if none provided
  if (targetChatIds.length === 0 && ENV.TELEGRAM_DEFAULT_CHAT_ID) {
    targetChatIds = [ENV.TELEGRAM_DEFAULT_CHAT_ID];
  }

  if (!ENV.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ [Telegram] TELEGRAM_BOT_TOKEN is not configured in .env.');
    console.info(`🔔 [DEV FALLBACK] Resident Call URL: ${options.residentCallUrl}`);
    return false;
  }

  if (targetChatIds.length === 0) {
    console.warn(`⚠️ [Telegram] No telegramChatId provided for unit "${options.unitLabel}" in "${options.doorbellName}" and TELEGRAM_DEFAULT_CHAT_ID is empty.`);
    console.info(`🔔 [DEV FALLBACK] Resident Call URL: ${options.residentCallUrl}`);
    return false;
  }

  const formattedTime = options.startedAt.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const messageText = `🔔 *¡ALERTA DE TIMBRE INTELIGENTE!*

📍 *Propiedad:* ${escapeMarkdown(options.doorbellName)}
🚪 *Unidad / Depto:* *${escapeMarkdown(options.unitLabel)}*
🏷️ *Slug:* \`${options.doorbellSlug}\`
🕒 *Hora:* ${formattedTime}
🌐 *IP:* \`${options.visitorIp}\`

_Un visitante está llamando a la puerta con videovisor. Toca el botón para ver y responder en tiempo real:_`;

  const telegramApiUrl = `https://api.telegram.org/bot${ENV.TELEGRAM_BOT_TOKEN}/sendMessage`;

  let anySuccess = false;

  for (const chatId of targetChatIds) {
    const payload = {
      chat_id: chatId,
      text: messageText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📹 ATENDER VIDEO-LLAMADA',
              url: options.residentCallUrl,
            },
          ],
        ],
      },
    };

    try {
      const response = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { ok: boolean; description?: string };

      if (!data.ok) {
        console.error(`❌ [Telegram] Failed to send alert to ${chatId}:`, data.description);
      } else {
        console.log(`✅ [Telegram] Alert dispatched successfully to chat ID ${chatId}`);
        anySuccess = true;
      }
    } catch (error) {
      console.error(`❌ [Telegram] Network error while contacting Telegram API for ${chatId}:`, error);
    }
  }

  console.info(`🔔 [Resident Call URL]: ${options.residentCallUrl}`);
  return anySuccess;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
