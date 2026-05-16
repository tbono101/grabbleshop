import { v4 as uuid } from 'uuid';
import db from '../models/db.js';
import * as easypost from '../services/easypost.js';
import { sendOrderConfirmation } from '../services/resend.js';
import { sendSms } from '../services/twilio.js';

const FROM_ADDRESS = {
  name: process.env.PLATFORM_NAME || 'GrabbleShop',
  street1: process.env.PLATFORM_STREET || '1 Disney Way',
  city: process.env.PLATFORM_CITY || 'Orlando',
  state: process.env.PLATFORM_STATE || 'FL',
  zip: process.env.PLATFORM_ZIP || '32830',
  country: 'US',
};

export async function getRates(req, res) {
  const { orderId } = req.params;

  const order = db.prepare(`
    SELECT o.*, a.line1, a.line2, a.city, a.state, a.zip, a.country,
           u.first_name, u.last_name
    FROM orders o
    JOIN addresses a ON a.id = o.shipping_address_id
    JOIN users u ON u.id = o.buyer_id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found or missing shipping address' });

  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(order.seller_id);
  if (req.user.sub !== seller.user_id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { weight, length, width, height } = req.body;

  const shipment = await easypost.createShipment({
    toAddress: {
      name: `${order.first_name} ${order.last_name}`,
      street1: order.line1,
      street2: order.line2,
      city: order.city,
      state: order.state,
      zip: order.zip,
      country: order.country,
    },
    fromAddress: FROM_ADDRESS,
    parcel: {
      weight: weight || 8,
      length: length || 6,
      width: width || 4,
      height: height || 2,
    },
  });

  // Store shipment id for later purchase
  const existingShipment = db.prepare('SELECT id FROM shipments WHERE order_id = ?').get(orderId);
  if (!existingShipment) {
    db.prepare('INSERT INTO shipments (id, order_id, easypost_shipment_id) VALUES (?, ?, ?)').run(
      uuid(), orderId, shipment.id
    );
  } else {
    db.prepare('UPDATE shipments SET easypost_shipment_id = ? WHERE order_id = ?').run(shipment.id, orderId);
  }

  res.json({ data: { shipmentId: shipment.id, rates: shipment.rates } });
}

export async function createLabel(req, res) {
  const { orderId } = req.params;
  const { rateId } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(order.seller_id);
  if (req.user.sub !== seller.user_id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const shipmentRecord = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
  if (!shipmentRecord?.easypost_shipment_id) {
    return res.status(400).json({ error: 'Get rates first before purchasing a label' });
  }

  const bought = await easypost.buyRate(shipmentRecord.easypost_shipment_id, rateId);

  const shippingAmount = Math.round(parseFloat(bought.selected_rate.rate) * 100);

  db.prepare(`
    UPDATE shipments SET
      carrier = ?, tracking_number = ?, label_url = ?,
      easypost_tracker_id = ?, status = 'label_created',
      updated_at = datetime('now')
    WHERE order_id = ?
  `).run(
    bought.selected_rate.carrier,
    bought.tracking_code,
    bought.postage_label?.label_url || null,
    bought.tracker?.id || null,
    orderId
  );

  db.prepare(`
    UPDATE orders SET
      shipping_amount = ?, total = subtotal + tax_amount + ?,
      status = 'processing', updated_at = datetime('now')
    WHERE id = ?
  `).run(shippingAmount, shippingAmount, orderId);

  // Notify buyer
  const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.buyer_id);
  try {
    await sendOrderConfirmation({
      to: buyer.email,
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      items: [],
      total: ((order.subtotal + order.tax_amount + shippingAmount) / 100).toFixed(2),
    });
    if (buyer.phone) {
      await sendSms(buyer.phone, `Your GrabbleShop order has shipped! Track it: ${bought.tracking_code}`);
    }
  } catch (err) {
    console.error('Notification failed:', err.message);
  }

  res.json({ data: db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId) });
}

export async function getTracking(req, res) {
  const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(req.params.orderId);
  if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

  if (!shipment.easypost_tracker_id) {
    return res.json({ data: { status: shipment.status, tracking_number: shipment.tracking_number } });
  }

  const tracker = await easypost.getTracker(shipment.easypost_tracker_id);

  db.prepare("UPDATE shipments SET status = ?, updated_at = datetime('now') WHERE order_id = ?").run(
    mapTrackerStatus(tracker.status), req.params.orderId
  );

  res.json({ data: tracker });
}

function mapTrackerStatus(epStatus) {
  const map = {
    pre_transit: 'label_created',
    in_transit: 'in_transit',
    out_for_delivery: 'in_transit',
    delivered: 'delivered',
    return_to_sender: 'exception',
    failure: 'exception',
    unknown: 'in_transit',
  };
  return map[epStatus] || 'in_transit';
}
