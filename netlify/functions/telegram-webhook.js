exports.handler = async (event) => {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      return { statusCode: 500, body: "BOT_TOKEN is not set" };
    }

    const update = JSON.parse(event.body || "{}");
    const message = update.message || update.edited_message;

    if (!message || !message.text) {
      return { statusCode: 200, body: "ok" };
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // /start або /start order_id
    let startPayload = null;
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) startPayload = parts.slice(1).join(" ").trim();
    }

    const reply =
      "Вітаю 👋\n\n" +
      "Цей бот допоможе вам отримати доступ до інтенсиву «Машинне навчання без коду».\n\n" +
      (startPayload
        ? `Я бачу ваш код замовлення: ${startPayload}\n\n`
        : "") +
      "Якщо ви щойно завершили оплату — доступ буде надано автоматично протягом кількох хвилин.\n\n" +
      "Якщо у вас виникли питання або щось не спрацювало, напишіть на\n" +
      "📩 yekaterynamel@gmail.com або 📱 @katemeleshenko";

    // Відповідь користувачу
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply
      })
    });

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      return { statusCode: 500, body: `Telegram error: ${errText}` };
    }

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};