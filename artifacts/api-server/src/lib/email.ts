import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FROM = "CreatorHub <noreply@creatorhub.africa>";

function fmt(n: number) {
  return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.header{background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 40px;text-align:center}
.header h1{margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px}
.header p{margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px}
.body{padding:32px 40px}
.body h2{font-size:20px;font-weight:700;color:#111;margin:0 0 8px}
.body p{font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px}
.amount{font-size:32px;font-weight:800;color:#f97316;margin:0 0 24px}
.info-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 24px}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
.info-row:last-child{border-bottom:none;padding-bottom:0}
.info-label{color:#6b7280;font-weight:500}
.info-value{color:#111;font-weight:600;text-align:right;max-width:60%}
.btn{display:inline-block;background:#f97316;color:#fff!important;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;margin:0 0 24px}
.footer{padding:20px 40px;text-align:center;background:#f9fafb;border-top:1px solid #f3f4f6}
.footer p{font-size:12px;color:#9ca3af;margin:0}
</style></head>
<body><div class="wrap">${content}<div class="footer"><p>CreatorHub — Empowering African Creators · <a href="https://creatorhub.africa" style="color:#f97316">creatorhub.africa</a></p></div></div></body>
</html>`;
}

export async function sendCreatorSaleNotification(params: {
  creatorEmail: string;
  creatorName: string;
  productName: string;
  buyerName: string;
  buyerEmail?: string;
  amountNgn: number;
  creatorEarnings: number;
  reference: string;
}) {
  if (!resend) {
    console.log("[Email] RESEND_API_KEY not configured. Skipping creator sale email.");
    return;
  }
  const { creatorEmail, creatorName, productName, buyerName, buyerEmail, amountNgn, creatorEarnings, reference } = params;

  const html = baseHtml(`
    <div class="header">
      <h1>🎉 You made a sale!</h1>
      <p>Someone just purchased your product</p>
    </div>
    <div class="body">
      <h2>Congrats, ${creatorName}!</h2>
      <p>Your product <strong>${productName}</strong> just sold.</p>
      <div class="amount">+₦${fmt(creatorEarnings)}</div>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Product</span><span class="info-value">${productName}</span></div>
        <div class="info-row"><span class="info-label">Buyer</span><span class="info-value">${buyerName}${buyerEmail ? ` (${buyerEmail})` : ""}</span></div>
        <div class="info-row"><span class="info-label">Sale amount</span><span class="info-value">₦${fmt(amountNgn)}</span></div>
        <div class="info-row"><span class="info-label">Your earnings</span><span class="info-value">₦${fmt(creatorEarnings)}</span></div>
        <div class="info-row"><span class="info-label">Reference</span><span class="info-value">${reference}</span></div>
      </div>
      <p style="color:#6b7280;font-size:13px">Earnings have been added to your wallet. You can withdraw anytime from your CreatorHub dashboard.</p>
    </div>
  `);

  try {
    await resend.emails.send({ from: FROM, to: creatorEmail, subject: `🎉 New sale — ₦${fmt(creatorEarnings)} earned from "${productName}"`, html });
  } catch (err) {
    console.error("[Email] Creator sale notification failed:", err);
  }
}

export async function sendTipReceivedNotification(params: {
  creatorEmail: string;
  creatorName: string;
  tipperName: string;
  amountNgn: number;
  message: string | null;
}) {
  if (!resend) {
    console.log("[Email] RESEND_API_KEY not configured. Skipping tip email.");
    return;
  }
  const { creatorEmail, creatorName, tipperName, amountNgn, message } = params;

  const html = baseHtml(`
    <div class="header">
      <h1>💸 New tip received!</h1>
      <p>Someone just sent you a tip</p>
    </div>
    <div class="body">
      <h2>You received a tip, ${creatorName}!</h2>
      <div class="amount">+₦${fmt(amountNgn)}</div>
      <div class="info-box">
        <div class="info-row"><span class="info-label">From</span><span class="info-value">${tipperName}</span></div>
        <div class="info-row"><span class="info-label">Amount</span><span class="info-value">₦${fmt(amountNgn)}</span></div>
        ${message ? `<div class="info-row"><span class="info-label">Message</span><span class="info-value">"${message}"</span></div>` : ""}
      </div>
      <p style="color:#6b7280;font-size:13px">This tip has been added to your wallet. Keep creating great content!</p>
    </div>
  `);

  try {
    await resend.emails.send({ from: FROM, to: creatorEmail, subject: `💸 You received a ₦${fmt(amountNgn)} tip from ${tipperName}`, html });
  } catch (err) {
    console.error("[Email] Tip notification failed:", err);
  }
}

export async function sendMarketplaceOrderNotification(params: {
  sellerEmail: string;
  sellerName: string;
  listingTitle: string;
  buyerName: string;
  buyerEmail: string;
  amountNgn: number;
  requirements: string | null;
  reference: string;
}) {
  if (!resend) {
    console.log("[Email] RESEND_API_KEY not configured. Skipping marketplace order email.");
    return;
  }
  const { sellerEmail, sellerName, listingTitle, buyerName, buyerEmail, amountNgn, requirements, reference } = params;

  const html = baseHtml(`
    <div class="header">
      <h1>📦 New order received!</h1>
      <p>A client just hired you for a service</p>
    </div>
    <div class="body">
      <h2>Congrats, ${sellerName}!</h2>
      <p><strong>${buyerName}</strong> (${buyerEmail}) placed an order for your service.</p>
      <div class="amount">+₦${fmt(amountNgn)}</div>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Service</span><span class="info-value">${listingTitle}</span></div>
        <div class="info-row"><span class="info-label">Client</span><span class="info-value">${buyerName} (${buyerEmail})</span></div>
        <div class="info-row"><span class="info-label">Your earnings</span><span class="info-value">₦${fmt(amountNgn)}</span></div>
        <div class="info-row"><span class="info-label">Order ref</span><span class="info-value">${reference}</span></div>
        ${requirements ? `<div class="info-row"><span class="info-label">Requirements</span><span class="info-value">${requirements.slice(0, 200)}</span></div>` : ""}
      </div>
      <p style="color:#6b7280;font-size:13px">Log in to your dashboard to accept and start working on this order.</p>
    </div>
  `);

  try {
    await resend.emails.send({ from: FROM, to: sellerEmail, subject: `📦 New order — ₦${fmt(amountNgn)} from "${listingTitle}"`, html });
  } catch (err) {
    console.error("[Email] Marketplace order notification failed:", err);
  }
}

export async function sendRefundConfirmation(params: {
  buyerEmail: string;
  buyerName: string;
  amountNgn: number;
  reference: string;
}) {
  if (!resend) {
    console.log("[Email] RESEND_API_KEY not configured. Skipping refund email.");
    return;
  }
  const { buyerEmail, buyerName, amountNgn, reference } = params;

  const html = baseHtml(`
    <div class="header">
      <h1>Refund Processed ✓</h1>
      <p>Your refund has been approved</p>
    </div>
    <div class="body">
      <h2>Hi ${buyerName}, your refund is being processed.</h2>
      <p>We've processed a refund for your recent purchase.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Refund amount</span><span class="info-value">₦${fmt(amountNgn)}</span></div>
        <div class="info-row"><span class="info-label">Original order ref</span><span class="info-value">${reference}</span></div>
      </div>
      <p style="color:#6b7280;font-size:13px">Refunds typically appear in 3–5 business days depending on your bank. Contact support if you have any questions.</p>
    </div>
  `);

  try {
    await resend.emails.send({ from: FROM, to: buyerEmail, subject: `Refund confirmed — ₦${fmt(amountNgn)} refunded`, html });
  } catch (err) {
    console.error("[Email] Refund confirmation failed:", err);
  }
}

export async function sendBuyerConfirmation(params: {
  buyerEmail: string;
  buyerName: string;
  productName: string;
  creatorName: string;
  fileUrl?: string | null;
  amountNgn: number;
  reference: string;
}) {
  if (!resend) {
    console.log("[Email] RESEND_API_KEY not configured. Skipping buyer confirmation email.");
    return;
  }
  const { buyerEmail, buyerName, productName, creatorName, fileUrl, amountNgn, reference } = params;

  const downloadSection = fileUrl
    ? `<a href="${fileUrl}" class="btn">⬇ Download Your Product</a>
       <p style="color:#6b7280;font-size:13px;margin-top:-12px">This link will take you to your purchase. Save it for future access.</p>`
    : `<p>The creator will be in touch with delivery details. Check your inbox.</p>`;

  const html = baseHtml(`
    <div class="header">
      <h1>Purchase Confirmed ✓</h1>
      <p>Thanks for supporting an African creator</p>
    </div>
    <div class="body">
      <h2>Hi ${buyerName}, your order is confirmed!</h2>
      <p>You've successfully purchased <strong>${productName}</strong> by <strong>${creatorName}</strong>.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Product</span><span class="info-value">${productName}</span></div>
        <div class="info-row"><span class="info-label">Creator</span><span class="info-value">${creatorName}</span></div>
        <div class="info-row"><span class="info-label">Amount paid</span><span class="info-value">₦${fmt(amountNgn)}</span></div>
        <div class="info-row"><span class="info-label">Order ref</span><span class="info-value">${reference}</span></div>
      </div>
      ${downloadSection}
    </div>
  `);

  try {
    await resend.emails.send({ from: FROM, to: buyerEmail, subject: `Your purchase: ${productName} from ${creatorName}`, html });
  } catch (err) {
    console.error("[Email] Buyer confirmation failed:", err);
  }
}
