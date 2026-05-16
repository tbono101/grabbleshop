import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderConfirmation({ to, orderNumber, items, total }) {
  return resend.emails.send({
    from: 'GrabbleShop <orders@grabbleshop.com>',
    to,
    subject: `Order #${orderNumber} confirmed — GrabbleShop`,
    html: `<h2>Your order is confirmed!</h2><p>Order #${orderNumber} | Total: $${total}</p>`,
  });
}

export default resend;
