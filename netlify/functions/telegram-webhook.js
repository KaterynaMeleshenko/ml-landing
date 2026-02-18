exports.handler = async (event) => {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHANNEL_ID = process.env.CHANNEL_ID;

    if (!BOT_TOKEN || !CHANNEL_ID) {
      return {
        statusCode: 200,
        body: "Missing env variables",
      };
    }

    const body = JSON.parse(event.body);

    // Якщо це не повідомлення — просто ок
    if (!body.message) {
      return { statusCode: 200, body: "ok" };
    }

    const chatId = body.message.chat.id;
    const text = body.message.text;

    // Реагуємо тільки на /start
    if (text !== "/start") {
      return { statusCode: 200, body: "ok" };
    }

    // Створюємо одноразове інвайт-посилання
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
      console.error(inviteData);
      return { statusCode: 200, body: "invite error" };
    }

    const inviteLink = inviteData.result.invite_link;

    // Надсилаємо посилання користувачу
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            "Дякую за оплату 🙌\n\nОсь ваше персональне посилання для входу:\n" +
            inviteLink,
        }),
      }
    );

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("Webhook error:", err);
    return { statusCode: 200, body: "error handled" };
  }
}; 