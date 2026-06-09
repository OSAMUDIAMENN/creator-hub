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
