exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const orderReference = qs.orderReference || "";

  const loc = orderReference
    ? `/thanks/?orderReference=${encodeURIComponent(orderReference)}`
    : `/thanks/`;

  return { statusCode: 302, headers: { Location: loc }, body: "" };
};