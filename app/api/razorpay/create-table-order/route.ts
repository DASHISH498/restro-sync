import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { amount, restaurantId, tableNumber } = await req.json();

    if (!amount || amount <= 0 || !restaurantId) {
      return NextResponse.json(
        { error: 'Invalid order amount or restaurant ID' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch specific Restaurant Owner's Razorpay Keys from DB
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('name, razorpay_key_id, razorpay_key_secret')
      .eq('id', restaurantId)
      .single();

    if (restError || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    if (!restaurant.razorpay_key_id || !restaurant.razorpay_key_secret) {
      return NextResponse.json(
        {
          error:
            'Restaurant ne abhi online payment setup nahi kiya hai. Kripya counter par pay karein.',
          notConfigured: true,
        },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: restaurant.razorpay_key_id.trim(),
      key_secret: restaurant.razorpay_key_secret.trim(),
    });

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100), // INR to Paise
      currency: 'INR',
      receipt: `tbl_${tableNumber}_${Date.now()}`,
      notes: {
        type: 'restaurant_food_bill',
        restaurantId,
        restaurantName: restaurant.name,
        tableNumber: String(tableNumber),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: restaurant.razorpay_key_id.trim(), // Owner ki public key frontend checkout ke liye
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to create restaurant payment order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}