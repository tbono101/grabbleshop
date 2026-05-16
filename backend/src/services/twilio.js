import twilio from 'twilio';

let _client;
const getClient = () => (_client ??= twilio(
  process.env.TWILIO_ACCOUNT_SID || 'AC_placeholder',
  process.env.TWILIO_AUTH_TOKEN  || 'placeholder'
));

export async function sendSms(to, body) {
  return getClient().messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
    body,
  });
}

export default new Proxy({}, { get(_, p) { return getClient()[p]; } });
