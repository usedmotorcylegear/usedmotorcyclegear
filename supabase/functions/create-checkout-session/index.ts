import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { listingId, buyerId, referralCode, offerAmount } = await req.json();

    // Always fetch price from DB — never trust the frontend amount
    const { data: listing } = await supabase
      .from('listings')
      .select('price, status, user_id, title, is_dummy')
      .eq('id', listingId)
      .single();

    if (!listing) throw new Error('Listing not found');
    if (listing.is_dummy) throw new Error('This is a sample listing and cannot be purchased');
    if (listing.status !== 'active') throw new Error('This item is no longer available');
    if (listing.user_id === buyerId) throw new Error('You cannot purchase your own listing');

    // Determine final amount: validate offer if one was provided
    let amount = Number(listing.price);
    if (offerAmount) {
      const { data: offer } = await supabase
        .from('offers')
        .select('amount, counter_amount, status')
        .eq('listing_id', listingId)
        .eq('buyer_id', buyerId)
        .in('status', ['accepted', 'countered'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (offer?.status === 'accepted') amount = Number(offer.amount);
      else if (offer?.status === 'countered') amount = Number(offer.counter_amount);
    }

    const referralPayout = referralCode ? +(amount * 0.05).toFixed(2) : 0;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: listing.title || 'Used Motorcycle Gear' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'],
      },
      success_url: `https://usedmotorcyclegear.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://usedmotorcyclegear.com/listing.html?id=${listingId}`,
      metadata: {
        listing_id: listingId,
        seller_id: listing.user_id,
        buyer_id: buyerId,
        referral_code: referralCode || '',
        referral_payout: String(referralPayout),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
