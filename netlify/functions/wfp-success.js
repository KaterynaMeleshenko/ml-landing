exports.handler = async (event) => {
  try {
    let orderReference = "";

    // GET
    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};
      orderReference = qs.orderReference || "";
    } else {
      // POST (часто x-www-form-urlencoded)
      const ct = (event.headers["content-type"] || "").toLowerCase();
      if (ct.includes("application/x-www-form-urlencoded")) {
        const p = new URLSearchParams(event.body || "");
        orderReference = p.get("orderReference") || "";
      } else if (ct.includes("application/json")) {
        const data = JSON.parse(event.body || "{}");
        orderReference = data.orderReference || "";
      } else {
        const p = new URLSearchParams(event.body || "");
        orderReference = p.get("orderReference") || "";
      }
    }

    const loc = orderReference
      ? `/thanks/?orderReference=${encodeURIComponent(orderReference)}`
      : `/thanks/`;

    return { statusCode: 302, headers: { Location: loc }, body: "" };
  } catch {
    return { statusCode: 302, headers: { Location: "/thanks/" }, body: "" };
  }
};