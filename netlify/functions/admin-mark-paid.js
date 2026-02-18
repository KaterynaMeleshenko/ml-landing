const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const ADMIN_KEY = process.env.ADMIN_KEY;
    const key = event.headers["x-admin-key"];

    if (!ADMIN_KEY || key !== ADMIN_KEY) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const params = new URLSearchParams(event.queryStringParameters || {});
    const orderRef = (event.queryStringParameters && event.queryStringParameters.orderReference) || "";

    if (!orderRef) {
      return { statusCode: 400, body: "orderReference required" };
    }

    const payments = getStore("payments");
    await payments.set(orderRef, JSON.stringify({ status: "paid", amount: "900", currency: "UAH", test: true }));

    return { statusCode: 200, body: `OK: marked paid ${orderRef}` };
  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};