import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  try {
    const { amount, planId, planName, restaurantId, restaurantName } = await req.json();

    if (!amount || amount <= 0 || !restaurantId || !planId) {
      return NextResponse.json(
        { error: 'Invalid subscription plan details' },
        { status: 400 }
      );
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Platform Razorpay keys missing in environment variables' },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: `sub_${restaurantId.slice(0, 8)}_${Date.now()}`,
      notes: {
        type: 'saas_subscription',
        restaurantId,
        restaurantName: restaurantName || 'Restaurant',
        planId,
        planName,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to create subscription order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}