const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

function hmacMd5(secret, str) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex");
}

exports.handler = async (event) => {
  try {
    const secretKey = process.env.WFP_SECRET_KEY;
    const store = getStore("payments");

    const body = JSON.parse(event.body || "{}");

    const {
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
      merchantSignature,
    } = body;

    // 1) перевірка підпису
    const signatureString = [
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
    ].join(";");

    const expected = hmacMd5(secretKey, signatureString);
    if (expected !== merchantSignature) {
      return { statusCode: 400, body: "Invalid signature" };
    }

    // 2) зберігаємо тільки Approved
    if (transactionStatus === "Approved") {
      await store.set(orderReference, JSON.stringify({ status: "paid", amount, currency }));
    }

    // 3) WayForPay очікує “accept” (можна віддати 200, але краще по докам)
    const time = Math.floor(Date.now() / 1000);
    const status = "accept";
    const responseSignature = hmacMd5(secretKey, `${orderReference};${status};${time}`); //  [oai_citation:3‡wiki.wayforpay.com](https://wiki.wayforpay.com/view/852102?utm_source=chatgpt.com)

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderReference, status, time, signature: responseSignature }),
    };
  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};