const BASE = 'https://api.taxjar.com/v2';

function headers() {
  return {
    Authorization: `Token token="${process.env.TAXJAR_API_KEY}"`,
    'Content-Type': 'application/json',
  };
}

export async function calculateTax({ fromZip, fromState, toZip, toState, amount, shipping = 0 }) {
  const res = await fetch(`${BASE}/taxes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      from_country: 'US',
      from_zip: fromZip,
      from_state: fromState,
      to_country: 'US',
      to_zip: toZip,
      to_state: toState,
      amount,
      shipping,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'TaxJar error');
  return json.tax;
}
