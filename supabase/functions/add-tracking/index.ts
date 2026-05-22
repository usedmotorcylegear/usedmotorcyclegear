import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const AFTERSHIP_API_KEY = Deno.env.get('AFTERSHIP_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { orderId, trackingNumber, carrier } = await req.json();

    // Register tracking with AfterShip
    const aftershipRes = await fetch('https://api.aftership.com/v4/trackings', {
      method: 'POST',
      headers: {
        'aftership-api-key': AFTERSHIP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tracking: {
          tracking_number: trackingNumber,
          slug: carrier !== 'auto' ? carrier : undefined,
          custom_fields: { order_id: orderId },
        },
      }),
    });

    const aftershipData = await aftershipRes.json();
    const aftershipId = aftershipData?.data?.tracking?.id || null;

    // Update order in Supabase
    const { error } = await supabase.from('orders').update({
      tracking_number: trackingNumber,
      carrier,
      status: 'shipped',
      aftership_tracking_id: aftershipId,
    }).eq('id', orderId);

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
