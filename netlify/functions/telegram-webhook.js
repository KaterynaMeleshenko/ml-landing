const crypto = require("crypto");

function hmacMd5(secret, str) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex");
}

async function tgSend(BOT_TOKEN, chat_id, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text }),
  });
}

exports.handler = async (event) => {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHANNEL_ID = process.env.CHANNEL_ID;

    const WFP_MERCHANT_ACCOUNT = process.env.WFP_MERCHANT_ACCOUNT;
    const WFP_SECRET_KEY = process.env.WFP_SECRET_KEY;

    const PRICE_UAH = String(process.env.PRICE_UAH || "900");
    const CURRENCY = "UAH";
    const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "yekaterynamel@gmail.com";
    const SUPPORT_TG = process.env.SUPPORT_TG || "@katemeleshenko";

    if (!BOT_TOKEN || !CHANNEL_ID) {
      return { statusCode: 200, body: "Missing BOT_TOKEN/CHANNEL_ID" };
    }
    if (!WFP_MERCHANT_ACCOUNT || !WFP_SECRET_KEY) {
      // бот працює, але перевіряти оплату не може
      return { statusCode: 200, body: "Missing WFP creds" };
    }

    const update = JSON.parse(event.body || "{}");
    const message = update.message || update.edited_message;

    if (!message || !message.text) return { statusCode: 200, body: "ok" };

    const chatId = message.chat.id;
    const text = String(message.text).trim();

    // payload з /start <orderReference>
    let payload = null;
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) payload = parts.slice(1).join(" ").trim();
    }

    // Якщо /start без payload — інструкція
    if (text === "/start" || !payload) {
      await tgSend(
        BOT_TOKEN,
        chatId,
        "Вітаю 👋\n\n" +
          "Щоб отримати доступ, відкрийте сторінку після успішної оплати і натисніть кнопку «Перейти в Telegram».\n\n" +
          `Якщо щось не спрацювало — ${SUPPORT_EMAIL} або ${SUPPORT_TG}`
      );
      return { statusCode: 200, body: "ok" };
    }

    // 1) Перевіряємо оплату через WayForPay CHECK_STATUS API
    // merchantSignature для запиту: merchantAccount;orderReference (HMAC_MD5)  [oai_citation:1‡wiki.wayforpay.com](https://wiki.wayforpay.com/en/view/852117)
    const requestSignature = hmacMd5(
      WFP_SECRET_KEY,
      `${WFP_MERCHANT_ACCOUNT};${payload}`
    );

    const wfpReq = {
      transactionType: "CHECK_STATUS",
      merchantAccount: WFP_MERCHANT_ACCOUNT,
      orderReference: payload,
      merchantSignature: requestSignature,
      apiVersion: 1,
    };

    const wfpRes = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wfpReq),
    });

    const wfpData = await wfpRes.json();

    // 2) Валідація підпису відповіді
    // signature line: merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode  [oai_citation:2‡wiki.wayforpay.com](https://wiki.wayforpay.com/en/view/852117)
    const respLine = [
      wfpData.merchantAccount,
      wfpData.orderReference,
      wfpData.amount,
      wfpData.currency,
      wfpData.authCode,
      wfpData.cardPan,
      wfpData.transactionStatus,
      wfpData.reasonCode,
    ].join(";");

    const expectedRespSig = hmacMd5(WFP_SECRET_KEY, respLine);

    if (!wfpData.merchantSignature || expectedRespSig !== wfpData.merchantSignature) {
      await tgSend(
        BOT_TOKEN,
        chatId,
        "Не вдалося підтвердити оплату (помилка підпису).\n" +
          `Напишіть, будь ласка, у підтримку: ${SUPPORT_EMAIL} або ${SUPPORT_TG}`
      );
      return { statusCode: 200, body: "bad_signature" };
    }

    // 3) Перевірка статусу + суми
    if (
      wfpData.transactionStatus !== "Approved" ||
      String(wfpData.currency) !== CURRENCY ||
      String(wfpData.amount) !== PRICE_UAH
    ) {
      await tgSend(
        BOT_TOKEN,
        chatId,
        "Оплату не знайдено або вона ще не підтверджена ⏳\n\n" +
          "Якщо ви щойно оплатили — зачекайте 1–2 хвилини і натисніть кнопку ще раз.\n\n" +
          `Підтримка: ${SUPPORT_EMAIL} або ${SUPPORT_TG}`
      );
      return { statusCode: 200, body: "not_paid" };
    }

    // 4) Оплата підтверджена → видаємо одноразовий інвайт (і обмежимо час на 10 хв)
    const expireDate = Math.floor(Date.now() / 1000) + 10 * 60;

    const inviteRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          member_limit: 1,
          expire_date: expireDate,
        }),
      }
    );

    const inviteData = await inviteRes.json();

    if (!inviteData.ok) {
      await tgSend(
        BOT_TOKEN,
        chatId,
        "Оплату підтверджено ✅ але не вдалося створити інвайт.\n" +
          `Напишіть, будь ласка: ${SUPPORT_EMAIL} або ${SUPPORT_TG}`
      );
      return { statusCode: 200, body: "invite_error" };
    }

    await tgSend(
      BOT_TOKEN,
      chatId,
      "✅ Оплату підтверджено!\n\n" +
        "Ось ваше одноразове посилання для входу в канал:\n" +
        inviteData.result.invite_link +
        "\n\n⚠️ Посилання діє 10 хв і працює для 1 входу."
    );

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("telegram-webhook error:", err);
    return { statusCode: 200, body: "error handled" };
  }
};