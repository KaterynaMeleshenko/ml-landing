exports.handler = async (event) => {
  try {
    let orderReference = "";

    const method = event.httpMethod;

    if (method === "GET") {
      orderReference = event.queryStringParameters?.orderReference || "";
    } else if (method === "POST") {
      const contentType = (event.headers["content-type"] || "").toLowerCase();

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(event.body);
        orderReference = params.get("orderReference") || "";
      } else if (contentType.includes("application/json")) {
        const data = JSON.parse(event.body || "{}");
        orderReference = data.orderReference || "";
      }
    }

    const redirectUrl = orderReference
      ? `/thanks/?orderReference=${encodeURIComponent(orderReference)}`
      : `/thanks/`;

    return {
      statusCode: 302,
      headers: { Location: redirectUrl },
      body: "",
    };

  } catch (error) {
    return {
      statusCode: 302,
      headers: { Location: "/thanks/" },
      body: "",
    };
  }
};