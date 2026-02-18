const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const {
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
      merchantSignature
    } = body;

    const secretKey = process.env.WFP_SECRET;

    // Формуємо підпис так, як вимагає WayForPay
    const signatureString = [
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode
    ].join(';');

    const expectedSignature = crypto
      .createHmac('md5', secretKey)
      .update(signatureString)
      .digest('hex');

    if (expectedSignature !== merchantSignature) {
      return { statusCode: 400, body: 'Invalid signature' };
    }

    if (transactionStatus === 'Approved') {
      const store = getStore('payments');
      await store.set(orderReference, 'paid');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ orderReference, status: 'accepted' })
    };

  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};