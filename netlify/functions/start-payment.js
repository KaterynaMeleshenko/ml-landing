const crypto = require("crypto");

function hmacMd5(secret, str) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function domainFromUrl(url) {
  // "https://ml-intensive.meleshenko.com" -> "ml-intensive.meleshenko.com"
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function makeOrderReference() {
  const ts = Math.floor(Date.now() / 1000);
  const rnd =
    (crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : crypto.randomBytes(16).toString("hex"));
  return `ml-${ts}-${rnd.slice(0, 16)}`; // коротко, але унікально
}

exports.handler = async () => {
  try {
    const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT; // Merchant login
    const secretKey = process.env.WFP_SECRET_KEY;            // Merchant secret key
    const siteUrl = process.env.SITE_URL || "https://ml-intensive.meleshenko.com";
    const amount = String(process.env.PRICE_UAH || "900");
    const currency = "UAH";

    if (!merchantAccount || !secretKey) {
      return { statusCode: 500, body: "Missing WFP_MERCHANT_ACCOUNT or WFP_SECRET_KEY" };
    }

    const merchantDomainName = process.env.WFP_DOMAIN || domainFromUrl(siteUrl);

    const orderReference = makeOrderReference();
    const orderDate = Math.floor(Date.now() / 1000);

    const productName = ["Інтенсив «Магія машинного навчання»"];
    const productCount = ["1"];
    const productPrice = [amount];

    // Підпис для /pay (purchase form)
    const signatureString = [
      merchantAccount,
      merchantDomainName,
      orderReference,
      orderDate,
      amount,
      currency,
      ...productName,
      ...productCount,
      ...productPrice,
    ].join(";");

    const merchantSignature = hmacMd5(secretKey, signatureString);

    const returnUrl = `${siteUrl}/thanks.html?orderReference=${encodeURIComponent(orderReference)}`;

    // Автосабміт форма на WayForPay
    const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Перехід до оплати…</title>
</head>
<body>
  <p>Перенаправляємо на оплату…</p>

  <form id="wfp" method="POST" action="https://secure.wayforpay.com/pay">
    <input type="hidden" name="merchantAccount" value="${escapeHtml(merchantAccount)}" />
    <input type="hidden" name="merchantDomainName" value="${escapeHtml(merchantDomainName)}" />
    <input type="hidden" name="orderReference" value="${escapeHtml(orderReference)}" />
    <input type="hidden" name="orderDate" value="${escapeHtml(orderDate)}" />
    <input type="hidden" name="amount" value="${escapeHtml(amount)}" />
    <input type="hidden" name="currency" value="${escapeHtml(currency)}" />

    <input type="hidden" name="productName[]" value="${escapeHtml(productName[0])}" />
    <input type="hidden" name="productCount[]" value="${escapeHtml(productCount[0])}" />
    <input type="hidden" name="productPrice[]" value="${escapeHtml(productPrice[0])}" />

    <input type="hidden" name="merchantSignature" value="${escapeHtml(merchantSignature)}" />
    <input type="hidden" name="returnUrl" value="${escapeHtml(returnUrl)}" />
    <input type="hidden" name="language" value="UA" />
  </form>

  <script>
    document.getElementById('wfp').submit();
  </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    };
  } catch (e) {
    console.error("start-payment error:", e);
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};