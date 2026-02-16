exports.handler = async (event) => {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHANNEL_ID = process.env.CHANNEL_ID;

    if (!BOT_TOKEN || !CHANNEL_ID) {
      return { statusCode: 500, body: "Missing BOT_TOKEN or CHANNEL_ID" };
    }

    const update = JSON.parse(event.body || "{}");
    const message = update.message || update.edited_message;

    if (!message || !message.text) {
      return { statusCode: 200, body: "ok" };
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // /start або /start PAYLOAD
    let payload = null;
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) payload = parts.slice(1).join(" ").trim();
    }

    // Якщо людина просто натиснула Start без payload — даємо інструкцію
    if (!payload) {
      const reply =
        "Вітаю 👋\n\n" +
        "Цей бот видає доступ до інтенсиву після оплати.\n\n" +
        "Якщо ви вже оплатили — поверніться сюди через кнопку/посилання після оплати.\n\n" +
        "Питання: 📩 yekaterynamel@gmail.com або 📱 katemeleshenko";

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: reply }),
      });

      return { statusCode: 200, body: "ok" };
    }

    // Створюємо одноразове інвайт-посилання (member_limit: 1)
    const inviteRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          member_limit: 1,
        }),
      }
    );

    const inviteData = await inviteRes.json();

    if (!inviteData.ok) {
      return { statusCode: 500, body: `Invite error: ${JSON.stringify(inviteData)}` };
    }

    const inviteLink = inviteData.result.invite_link;

    const successMsg =
      "✅ Доступ готовий!\n\n" +
      "Ось одноразове посилання для входу в закритий канал інтенсиву:\n" +
      inviteLink +
      "\n\n" +
      "⚠️ Посилання працює для 1 входу.\n" +
      `Ваш код: ${payload}`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: successMsg }),
    });

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};