const BASE = 'https://api.easypost.com/v2';

function headers() {
  const creds = Buffer.from(`${process.env.EASYPOST_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' };
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error?.message || 'EasyPost error'), { status: res.status });
  return json;
}

export async function createShipment({ toAddress, fromAddress, parcel }) {
  return req('POST', '/shipments', {
    shipment: { to_address: toAddress, from_address: fromAddress, parcel },
  });
}

export async function buyRate(shipmentId, rateId) {
  return req('POST', `/shipments/${shipmentId}/buy`, { rate: { id: rateId } });
}

export async function getTracker(trackerId) {
  return req('GET', `/trackers/${trackerId}`);
}

export async function createTracker(carrier, trackingCode) {
  return req('POST', '/trackers', { tracker: { carrier, tracking_code: trackingCode } });
}
