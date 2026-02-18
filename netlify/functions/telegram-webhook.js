const { getStore } = require("@netlify/blobs");

function buildText(...parts) {
  return parts.filter(Boolean).join("\n");
}

exports.handler = async (event) => {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHANNEL_ID = process.env.CHANNEL_ID;
    const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "yekaterynamel@gmail.com";

    if (!BOT_TOKEN || !CHANNEL_ID) {
      return { statusCode: 500, body: "Missing BOT_TOKEN or CHANNEL_ID env vars" };
    }

    const update = JSON.parse(event.body || "{}");
    const message = update.message || update.edited_message;

    if (!message || !message.text) {
      return { statusCode: 200, body: "ok" };
    }

    const chatId = message.chat.id;
    const text = String(message.text).trim();

    // Команди
    const isStart = text.startsWith("/start");
    const isHelp = text === "/help" || text.startsWith("/help");

    // Витягуємо payload з /start <payload>
    let payload = null;
    if (isStart) {
      const parts = text.split(" ");
      if (parts.length > 1) payload = parts.slice(1).join(" ").trim();
    }

    // Валідація payload (orderReference)
    if (payload && payload.length > 128) payload = null; // дуже довге — ігноруємо

    // Простий /help
    if (isHelp) {
      const helpText = buildText(
        "ℹ️ Як отримати доступ:",
        "",
        "1) Оплатіть інтенсив на сайті.",
        "2) Після оплати натисніть кнопку на сторінці «Дякую» — вона відкриє цей бот з вашим кодом.",
        "3) Я перевірю оплату і надішлю посилання для входу в канал.",
        "",
        `Підтримка: ${SUPPORT_EMAIL}`
      );

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: helpText }),
      });

      return { statusCode: 200, body: "ok" };
    }

    // Якщо /start без payload — інструкція
    if (isStart && !payload) {
      const infoText = buildText(
        "Вітаю 👋",
        "",
        "Цей бот видає доступ до закритого Telegram-каналу інтенсиву після успішної оплати.",
        "",
        "Якщо ви вже оплатили — поверніться на сторінку «Дякую» після оплати і натисніть кнопку «Отримати доступ у Telegram».",
        "",
        `Питання: ${SUPPORT_EMAIL}`
      );

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: infoText }),
      });

      return { statusCode: 200, body: "ok" };
    }

    // Якщо є payload — це orderReference, перевіряємо оплату
    if (isStart && payload) {
      const payments = getStore("payments");
      const claims = getStore("claims");

      // 1) чи є підтвердження оплати від WayForPay webhook?
      const paidRecord = await payments.get(payload);

      if (!paidRecord) {
        const notFoundText = buildText(
          "Оплату не знайдено або вона ще не підтверджена ⏳",
          "",
          "Якщо ви щойно оплатили — зачекайте 1–2 хвилини і натисніть кнопку ще раз.",
          "",
          `Якщо не спрацювало — напишіть: ${SUPPORT_EMAIL}`
        );

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: notFoundText }),
        });

        return { statusCode: 200, body: "not_paid" };
      }

      // 2) захист від повторної видачі по одному orderReference
      const alreadyClaimed = await claims.get(payload);
      if (alreadyClaimed) {
        const alreadyText = buildText(
          "✅ Цей доступ уже був виданий раніше.",
          "",
          "Якщо ви не змогли зайти в канал — напишіть мені, і я допоможу:",
          SUPPORT_EMAIL
        );

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: alreadyText }),
        });

        return { statusCode: 200, body: "already_claimed" };
      }

      // 3) створюємо одноразове інвайт-посилання
      const expireDate = Math.floor(Date.now() / 1000) + 60 * 60; // 1 година
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
        // Якщо Telegram повернув помилку — повідомимо користувача
        const errText = buildText(
          "Сталася технічна помилка при створенні посилання 😕",
          "",
          `Напишіть мені, будь ласка: ${SUPPORT_EMAIL}`,
          "",
          `Код: ${payload}`
        );

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: errText }),
        });

        return { statusCode: 500, body: JSON.stringify(inviteData) };
      }

      const inviteLink = inviteData.result.invite_link;

      // 4) відмічаємо, що видали доступ (перед відправкою теж можна, але так безпечніше для UX)
      await claims.set(payload, JSON.stringify({ claimed_at: Date.now(), chat_id: chatId }));

      // 5) надсилаємо посилання
      const successText = buildText(
        "✅ Оплату підтверджено!",
        "",
        "Ось ваше одноразове посилання для входу в закритий канал:",
        inviteLink,
        "",
        "⚠️ Посилання працює для 1 входу і діє 1 годину.",
        "",
        `Питання: ${SUPPORT_EMAIL}`
      );

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: successText }),
      });

      return { statusCode: 200, body: "ok" };
    }

    // Якщо це не /start і не /help — можна мовчати або підказати
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Напишіть /start або /help 🙂",
      }),
    });

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};