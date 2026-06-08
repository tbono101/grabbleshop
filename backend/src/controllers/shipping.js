import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../models/db.js';
import * as easypost from '../services/easypost.js';
import { sendOrderConfirmation } from '../services/resend.js';
import { sendSms } from '../services/twilio.js';

const FROM_ADDRESS = {
  name:    process.env.PLATFORM_NAME   || 'GrabbleShop',
  street1: process.env.PLATFORM_STREET || '1 Disney Way',
  city:    process.env.PLATFORM_CITY   || 'Orlando',
  state:   process.env.PLATFORM_STATE  || 'FL',
  zip:     process.env.PLATFORM_ZIP    || '32830',
  country: 'US',
};

export async function getRates(req, res) {
  const { orderId } = req.params;

  const order = await queryOne(
    `SELECT o.*, a.line1, a.line2, a.city, a.state, a.zip, a.country,
            u.first_name, u.last_name
     FROM orders o
     JOIN addresses a ON a.id = o.shipping_address_id
     JOIN users u ON u.id = o.buyer_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!order) return res.status(404).json({ error: 'Order not found or missing shipping address' });

  const seller = await queryOne('SELECT * FROM sellers WHERE id = $1', [order.seller_id]);
  if (req.user.sub !== seller.user_id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { weight, length, width, height } = req.body;

  const shipment = await easypost.createShipment({
    toAddress: {
      name:    `${order.first_name} ${order.last_name}`,
      street1: order.line1,
      street2: order.line2,
      city:    order.city,
      state:   order.state,
      zip:     order.zip,
      country: order.country,
    },
    fromAddress: FROM_ADDRESS,
    parcel: {
      weight: weight || 8,
      length: length || 6,
      width:  width  || 4,
      height: height || 2,
    },
  });

  const existingShipment = await queryOne('SELECT id FROM shipments WHERE order_id = $1', [orderId]);
  if (!existingShipment) {
    await query(
      'INSERT INTO shipments (id, order_id, easypost_shipment_id) VALUES ($1, $2, $3)',
      [uuid(), orderId, shipment.id]
    );
  } else {
    await query(
      'UPDATE shipments SET easypost_shipment_id = $1 WHERE order_id = $2',
      [shipment.id, orderId]
    );
  }

  res.json({ data: { shipmentId: shipment.id, rates: shipment.rates } });
}

export async function createLabel(req, res) {
  const { orderId } = req.params;
  const { rateId }  = req.body;

  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const seller = await queryOne('SELECT * FROM sellers WHERE id = $1', [order.seller_id]);
  if (req.user.sub !== seller.user_id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const shipmentRecord = await queryOne('SELECT * FROM shipments WHERE order_id = $1', [orderId]);
  if (!shipmentRecord?.easypost_shipment_id) {
    return res.status(400).json({ error: 'Get rates first before purchasing a label' });
  }

  const bought = await easypost.buyRate(shipmentRecord.easypost_shipment_id, rateId);
  const shippingAmount = Math.round(parseFloat(bought.selected_rate.rate) * 100);

  await query(
    `UPDATE shipments SET
       carrier = $1, tracking_number = $2, label_url = $3,
       easypost_tracker_id = $4, status = 'label_created', updated_at = NOW()
     WHERE order_id = $5`,
    [
      bought.selected_rate.carrier,
      bought.tracking_code,
      bought.postage_label?.label_url || null,
      bought.tracker?.id || null,
      orderId,
    ]
  );

  await query(
    `UPDATE orders SET
       shipping_amount = $1, total = subtotal + tax_amount + $2,
       status = 'processing', updated_at = NOW()
     WHERE id = $3`,
    [shippingAmount, shippingAmount, orderId]
  );

  const buyer = await queryOne('SELECT * FROM users WHERE id = $1', [order.buyer_id]);
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

  const updated = await queryOne('SELECT * FROM shipments WHERE order_id = $1', [orderId]);
  res.json({ data: updated });
}

export async function getTracking(req, res) {
  const shipment = await queryOne('SELECT * FROM shipments WHERE order_id = $1', [req.params.orderId]);
  if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

  if (!shipment.easypost_tracker_id) {
    return res.json({ data: { status: shipment.status, tracking_number: shipment.tracking_number } });
  }

  const tracker = await easypost.getTracker(shipment.easypost_tracker_id);

  await query(
    "UPDATE shipments SET status = $1, updated_at = NOW() WHERE order_id = $2",
    [mapTrackerStatus(tracker.status), req.params.orderId]
  );

  res.json({ data: tracker });
}

function mapTrackerStatus(epStatus) {
  const map = {
    pre_transit:        'label_created',
    in_transit:         'in_transit',
    out_for_delivery:   'in_transit',
    delivered:          'delivered',
    return_to_sender:   'exception',
    failure:            'exception',
    unknown:            'in_transit',
  };
  return map[epStatus] || 'in_transit';
}
