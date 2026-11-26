import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

function extractRazorpayErrorMessage(err: unknown): string {
  if (!err) return 'Failed to create subscription order';
  if (typeof err === 'string') return err;

  if (typeof err === 'object') {
    const anyErr = err as {
      message?: string;
      description?: string;
      error?: { description?: string; message?: string; code?: string };
    };
    return (
      anyErr.error?.description ||
      anyErr.error?.message ||
      anyErr.description ||
      anyErr.message ||
      'Failed to create subscription order'
    );
  }

  return 'Failed to create subscription order';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, planId, planName, outletMode, restaurantId, restaurantName } =
      body || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !planId) {
      return NextResponse.json(
        { error: 'Invalid subscription plan details' },
        { status: 400 }
      );
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

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
        ? restaurantId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
        : 'prereg';

    const resolvedOutletMode = outletMode === 'multiple' ? 'multiple' : 'single';
    const shortReceipt = `sub_${safeRestaurantId.slice(0, 8)}_${Date.now().toString().slice(-8)}`.slice(
      0,
      40
    );

    const order = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100),
      currency: 'INR',
      receipt: shortReceipt,
      notes: {
        type: 'saas_subscription',
        outletMode: resolvedOutletMode,
        restaurantId: safeRestaurantId || 'pre_register',
        restaurantName:
          typeof restaurantName === 'string' && restaurantName.trim()
            ? restaurantName.trim()
            : 'Restaurant',
        planId: String(planId),
        planName:
          typeof planName === 'string' && planName.trim()
            ? planName.trim()
            : String(planId),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: unknown) {
    const message = extractRazorpayErrorMessage(error);
    console.error('Razorpay create-subscription-order error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}