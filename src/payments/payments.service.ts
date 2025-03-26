import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      // Colocamos el id de nuestra orden
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: `http://localhost:3003/payments/success`,
      cancel_url: `http://localhost:3003/payments/cancel`,
    });

    return session;
  }

  async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;
    // test const endpointSecret ='whsec_a6b901845764d737b522ae32f8401120975384e0e53d7a48e384f96421ba0b08';
    const endpointSecret = 'whsec_lTfc6nXfce07KxLxf9LsHcwEXS0wu9ZK';
    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        sig as string,
        endpointSecret,
      );
    } catch (error) {
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }


    const chargeSucceeded = event.data.object as Stripe.Charge;
    switch (event.type) {
      case 'charge.succeeded':
        console.log({
          metadata: chargeSucceeded.metadata,
          orderId: chargeSucceeded.metadata.orderId,
        });
        break;
      default:
        console.log(`Envent ${event.type} not handled`);
    }

    return res.status(200).json({ sig });
  }
}
