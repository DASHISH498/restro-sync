import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  try {
    const { amount, planId, planName, outletMode, restaurantId, restaurantName } =
      await req.json();

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0 || !planId) {
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

    const safeRestaurantId =
      typeof restaurantId === 'string' && restaurantId.trim().length > 0
        ? restaurantId.trim()
        : 'pre_register';

    const resolvedOutletMode = outletMode === 'multiple' ? 'multiple' : 'single';

    const order = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100),
      currency: 'INR',
      receipt: `sub_${safeRestaurantId.slice(0, 8)}_${Date.now()}`,
      notes: {
        type: 'saas_subscription',
        outletMode: resolvedOutletMode,
        restaurantId: safeRestaurantId,
        restaurantName: restaurantName || 'Restaurant',
        planId,
        planName: planName || planId,
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