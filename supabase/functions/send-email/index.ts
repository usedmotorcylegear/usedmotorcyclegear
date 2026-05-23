import { Resend } from 'npm:resend';
import { createClient } from 'npm:@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const FROM = 'UsedMotorcycleGear <noreply@usedmotorcyclegear.com>';
const ADMIN_EMAIL = 'support@usedmotorcyclegear.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function wrap(content: string) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f3f0;margin:0;padding:2rem;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2ddd8;padding:2.5rem;">
      <div style="font-size:1.1rem;font-weight:900;color:#1a1814;margin-bottom:2rem;letter-spacing:-0.5px;">
        used<span style="color:#d95f00;">motorcyclegear</span>.com
      </div>
      ${content}
      <div style="margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid #e2ddd8;font-size:0.78rem;color:#7a7068;">
        usedmotorcyclegear.com &mdash; Ride safe.<br/>
        <a href="https://usedmotorcyclegear.com/terms.html" style="color:#7a7068;">Terms</a> &nbsp;&middot;&nbsp;
        <a href="https://usedmotorcyclegear.com/privacy.html" style="color:#7a7068;">Privacy</a>
      </div>
    </div>
  </body></html>`;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  return user?.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { type, orderId } = await req.json();

    // Load order + listing
    const { data: order } = await supabase
      .from('orders')
      .select('*, listings(title)')
      .eq('id', orderId)
      .single();

    if (!order) throw new Error('Order not found');

    const itemTitle = order.listings?.title || 'your item';
    const amount = `$${Number(order.amount).toLocaleString()}`;
    const payout = `$${Number(order.seller_payout).toLocaleString()}`;
    const ordersUrl = 'https://usedmotorcyclegear.com/orders.html';

    const [buyerEmail, sellerEmail] = await Promise.all([
      getUserEmail(order.buyer_id),
      getUserEmail(order.seller_id),
    ]);

    const emails: { to: string; subject: string; html: string }[] = [];

    if (type === 'order_placed') {
      if (buyerEmail) emails.push({
        to: buyerEmail,
        subject: `Order confirmed — ${itemTitle}`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#1a1814;margin:0 0 1rem;">You're all set!</h2>
          <p style="color:#1a1814;line-height:1.7;">Your payment of <strong>${amount}</strong> for <strong>${itemTitle}</strong> went through. The seller has been notified and will ship it soon.</p>
          <p style="color:#1a1814;line-height:1.7;">Once it ships you'll see the tracking number in your Orders page. When it arrives, click <strong>"I received this order"</strong> to release the seller's payment.</p>
          <a href="${ordersUrl}" style="display:inline-block;margin-top:1.25rem;background:#d95f00;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">View Your Order</a>
        `),
      });

      if (sellerEmail) emails.push({
        to: sellerEmail,
        subject: `You made a sale — ${itemTitle}`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#1a1814;margin:0 0 1rem;">You have a sale! 🎉</h2>
          <p style="color:#1a1814;line-height:1.7;"><strong>${itemTitle}</strong> just sold for <strong>${amount}</strong>. Your payout after fees is <strong>${payout}</strong>.</p>
          <p style="color:#1a1814;line-height:1.7;">Pack it up and ship it as soon as you can. Then enter the tracking number in your Orders page to start the payout countdown.</p>
          <a href="${ordersUrl}" style="display:inline-block;margin-top:1.25rem;background:#d95f00;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">Go to Orders</a>
        `),
      });
    }

    else if (type === 'item_shipped') {
      const tracking = order.tracking_number ? `<p style="color:#1a1814;line-height:1.7;">Tracking number: <strong>${order.carrier?.toUpperCase() || ''} ${order.tracking_number}</strong></p>` : '';
      if (buyerEmail) emails.push({
        to: buyerEmail,
        subject: `Your order shipped — ${itemTitle}`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#1a1814;margin:0 0 1rem;">Your order is on the way!</h2>
          <p style="color:#1a1814;line-height:1.7;"><strong>${itemTitle}</strong> has been shipped.</p>
          ${tracking}
          <p style="color:#1a1814;line-height:1.7;">When it arrives, click <strong>"I received this order"</strong> in your Orders page to confirm delivery and release the seller's payment.</p>
          <a href="${ordersUrl}" style="display:inline-block;margin-top:1.25rem;background:#d95f00;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">Track Your Order</a>
        `),
      });
    }

    else if (type === 'delivery_confirmed') {
      if (sellerEmail) emails.push({
        to: sellerEmail,
        subject: `Buyer confirmed delivery — payout in 3 days`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#1a1814;margin:0 0 1rem;">Delivery confirmed!</h2>
          <p style="color:#1a1814;line-height:1.7;">The buyer confirmed they received <strong>${itemTitle}</strong>. Your payout of <strong>${payout}</strong> will be released in 3 days.</p>
          <p style="color:#1a1814;line-height:1.7;">If there are no disputes within that window, the money will be sent to your connected bank account automatically.</p>
          <a href="${ordersUrl}" style="display:inline-block;margin-top:1.25rem;background:#d95f00;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">View Sale</a>
        `),
      });
    }

    else if (type === 'payout_released') {
      if (sellerEmail) emails.push({
        to: sellerEmail,
        subject: `Your payout is on the way — ${payout}`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#1a1814;margin:0 0 1rem;">Payout sent!</h2>
          <p style="color:#1a1814;line-height:1.7;">Your payout of <strong>${payout}</strong> for <strong>${itemTitle}</strong> has been sent to your bank account via Stripe.</p>
          <p style="color:#1a1814;line-height:1.7;">It typically arrives within 1–2 business days depending on your bank.</p>
          <a href="${ordersUrl}" style="display:inline-block;margin-top:1.25rem;background:#d95f00;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">View Order</a>
        `),
      });
    }

    else if (type === 'dispute_filed') {
      const reason = order.dispute_reason || 'No reason given';
      const disputedBy = order.disputed_by || 'unknown';

      if (buyerEmail) emails.push({
        to: buyerEmail,
        subject: `Dispute filed on your order — ${itemTitle}`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#c0392b;margin:0 0 1rem;">A dispute has been filed</h2>
          <p style="color:#1a1814;line-height:1.7;">A dispute was filed on the order for <strong>${itemTitle}</strong>.</p>
          <p style="color:#1a1814;line-height:1.7;"><strong>Reason:</strong> ${reason}</p>
          <p style="color:#1a1814;line-height:1.7;">Our team will review this within 1 business day. Funds are frozen until the dispute is resolved.</p>
          <a href="${ordersUrl}" style="display:inline-block;margin-top:1.25rem;background:#c0392b;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">View Order</a>
        `),
      });

      if (sellerEmail) emails.push({
        to: sellerEmail,
        subject: `Dispute filed on your sale — ${itemTitle}`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#c0392b;margin:0 0 1rem;">A dispute has been filed</h2>
          <p style="color:#1a1814;line-height:1.7;">A dispute was filed on your sale of <strong>${itemTitle}</strong>.</p>
          <p style="color:#1a1814;line-height:1.7;"><strong>Reason:</strong> ${reason}</p>
          <p style="color:#1a1814;line-height:1.7;">Our team will review this within 1 business day. Your payout is on hold until the dispute is resolved.</p>
          <a href="${ordersUrl}" style="display:inline-block;margin-top:1.25rem;background:#c0392b;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">View Sale</a>
        `),
      });

      // Notify admin
      emails.push({
        to: ADMIN_EMAIL,
        subject: `[DISPUTE] ${itemTitle} — filed by ${disputedBy}`,
        html: wrap(`
          <h2 style="font-size:1.3rem;font-weight:900;color:#c0392b;margin:0 0 1rem;">New dispute</h2>
          <p><strong>Item:</strong> ${itemTitle}</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Filed by:</strong> ${disputedBy}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Amount:</strong> ${amount} (seller payout: ${payout})</p>
          <a href="https://usedmotorcyclegear.com/admin.html" style="display:inline-block;margin-top:1.25rem;background:#1a1814;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.9rem;">Open Admin</a>
        `),
      });
    }

    // Send all emails
    await Promise.all(emails.map(e => resend.emails.send({ from: FROM, ...e })));

    return new Response(JSON.stringify({ sent: emails.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-email error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
