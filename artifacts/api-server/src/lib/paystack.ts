import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";
const BASE_URL = "https://api.paystack.co";

if (!PAYSTACK_SECRET_KEY) {
  console.warn(
    "[Paystack] PAYSTACK_SECRET_KEY is not set — all payment operations will fail. " +
    "Add it as a secret in the Replit Secrets panel.",
  );
}

async function paystackRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.message ?? "Paystack request failed");
  return data;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

export async function initializeTransaction(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: object;
}) {
  const data = await paystackRequest("POST", "/transaction/initialize", {
    email: opts.email,
    amount: opts.amountKobo,
    reference: opts.reference,
    callback_url: opts.callbackUrl,
    metadata: opts.metadata,
  });
  return data.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(reference: string) {
  const data = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
  return data.data as {
    status: string;
    reference: string;
    amount: number;
    metadata?: any;
    customer?: { email: string; customer_code: string };
  };
}

export async function createOrFetchCustomer(email: string, name?: string) {
  try {
    const data = await paystackRequest("POST", "/customer", { email, first_name: name });
    return data.data as { customer_code: string; id: number };
  } catch {
    const data = await paystackRequest("GET", `/customer/${encodeURIComponent(email)}`);
    return data.data as { customer_code: string; id: number };
  }
}

export async function createSubscription(opts: {
  customerCode: string;
  planCode: string;
  startDate?: string;
}) {
  const data = await paystackRequest("POST", "/subscription", {
    customer: opts.customerCode,
    plan: opts.planCode,
    start_date: opts.startDate,
  });
  return data.data as { subscription_code: string; email_token: string };
}

export async function createPlan(opts: {
  name: string;
  amountKobo: number;
  interval: "monthly" | "annually";
  description?: string;
}) {
  const data = await paystackRequest("POST", "/plan", {
    name: opts.name,
    amount: opts.amountKobo,
    interval: opts.interval,
    description: opts.description,
  });
  return data.data as { plan_code: string; id: number };
}

export async function listPlans() {
  const data = await paystackRequest("GET", "/plan");
  return data.data as Array<{ plan_code: string; name: string; amount: number; interval: string }>;
}
