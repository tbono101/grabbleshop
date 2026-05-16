import { Resend } from 'resend';

let _client;
const getResend = () => (_client ??= new Resend(process.env.RESEND_API_KEY || 're_placeholder'));

export async function sendOrderConfirmation({ to, orderNumber, items, total }) {
  return getResend().emails.send({
    from: 'GrabbleShop <orders@grabbleshop.com>',
    to,
    subject: `Order #${orderNumber} confirmed — GrabbleShop`,
    html: `<h2>Your order is confirmed!</h2><p>Order #${orderNumber} | Total: $${total}</p>`,
  });
}

export default new Proxy({}, { get(_, p) { return getResend()[p]; } });
