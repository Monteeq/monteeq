from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List
import datetime
import logging
import hashlib
import hmac
import json

from app.db.session import get_db
from app.schemas import schemas
from app.core.dependencies import get_current_user
from app.models.models import User, Wallet, Transaction, PayoutRequest
from app.crud.monetization import get_or_create_wallet, process_tip
from app.core.config import PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BASE_URL, FRONTEND_URL
import httpx
import stripe

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Paystack integration URLs ──────────────────────────────────────────────
# These are computed once at startup so they are always consistent.
# Copy the values printed in startup logs and paste them into Paystack Dashboard.
#
#   Webhook URL  → Paystack Dashboard → Settings → API Keys & Webhooks → Webhook URL
#   Callback URL → Paystack Dashboard → Settings → API Keys & Webhooks → Callback URL
#
WEBHOOK_URL  = f"{BASE_URL}/api/v1/monetization/webhook/paystack"
CALLBACK_URL = f"{BASE_URL}/api/v1/monetization/payment/callback"

import logging as _log
_log.getLogger(__name__).info(
    f"\n" \
    f"  ╔══════════════════════════════════════════════════════════╗\n" \
    f"  ║         Paystack Integration URLs (paste in dashboard)  ║\n" \
    f"  ╠══════════════════════════════════════════════════════════╣\n" \
    f"  ║  Webhook URL : {WEBHOOK_URL:<42} ║\n" \
    f"  ║  Callback URL: {CALLBACK_URL:<42} ║\n" \
    f"  ╚══════════════════════════════════════════════════════════╝"
)

@router.get("/wallet", response_model=schemas.Wallet)
def get_creator_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch the authenticated user's wallet and transaction history."""
    return get_or_create_wallet(db, current_user.id)

@router.post("/tip/{user_id}", response_model=schemas.Transaction)
def send_tip(
    user_id: int,
    amount: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a direct tip to a creator."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Tip amount must be positive.")
    creator = db.query(User).filter(User.id == user_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    if creator.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot tip yourself")

    result = process_tip(db, from_user_id=current_user.id, to_user_id=creator.id, amount=amount)
    if not result:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance. Please top up your wallet.")
    return result

# ------------------------------------------------------------------ #
#  PAYOUT REQUEST ENDPOINTS
# ------------------------------------------------------------------ #

@router.post("/payout/request", response_model=schemas.PayoutRequestSchema)
def request_payout(
    payload: schemas.PayoutRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creator requests a payout from their wallet.
    Minimum payout: ₦1,000. Funds stay frozen until admin marks as completed.
    """
    wallet = get_or_create_wallet(db, current_user.id)
    balance = float(wallet.balance)

    MIN_PAYOUT = 1000.0
    if payload.amount < MIN_PAYOUT:
        raise HTTPException(status_code=400, detail=f"Minimum payout is ₦{MIN_PAYOUT:,.2f}")
    if payload.amount > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Your balance is ₦{balance:,.2f}")

    # Block duplicate pending requests
    existing_pending = db.query(PayoutRequest).filter(
        PayoutRequest.user_id == current_user.id,
        PayoutRequest.status == "pending"
    ).first()
    if existing_pending:
        raise HTTPException(status_code=400, detail="You already have a pending payout request. Please wait for it to be processed.")

    payout = PayoutRequest(
        user_id=current_user.id,
        wallet_id=wallet.id,
        amount=payload.amount,
        bank_details=payload.bank_details,
        status="pending"
    )

    # Deduct from wallet immediately (held in escrow until approved)
    from decimal import Decimal
    wallet.balance -= Decimal(str(payload.amount))

    db.add(payout)
    db.commit()
    db.refresh(payout)
    return payout

@router.get("/payout/my-requests", response_model=List[schemas.PayoutRequestSchema])
def get_my_payout_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List the authenticated user's payout history."""
    return db.query(PayoutRequest).filter(
        PayoutRequest.user_id == current_user.id
    ).order_by(PayoutRequest.requested_at.desc()).all()

# ------------------------------------------------------------------ #
#  ADMIN-ONLY PAYOUT MANAGEMENT
# ------------------------------------------------------------------ #

def _require_admin(current_user: User):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

@router.get("/admin/payouts", response_model=List[schemas.PayoutRequestSchema])
def admin_list_payouts(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: list all payout requests, optionally filtered by status."""
    _require_admin(current_user)
    q = db.query(PayoutRequest)
    if status:
        q = q.filter(PayoutRequest.status == status)
    return q.order_by(PayoutRequest.requested_at.desc()).all()

@router.get("/admin/transactions")
def admin_list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: view all transactions including pending and failed."""
    _require_admin(current_user)
    return db.query(Transaction).order_by(Transaction.created_at.desc()).all()

@router.put("/admin/payouts/{payout_id}", response_model=schemas.PayoutRequestSchema)
def admin_update_payout(
    payout_id: int,
    status: str,
    admin_note: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: approve, reject, or mark a payout as completed."""
    _require_admin(current_user)
    payout = db.query(PayoutRequest).filter(PayoutRequest.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")

    valid_statuses = {"pending", "processing", "completed", "rejected"}
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")

    # If rejected, refund the escrowed amount back to wallet
    if status == "rejected" and payout.status != "rejected":
        wallet = db.query(Wallet).filter(Wallet.id == payout.wallet_id).first()
        if wallet:
            from decimal import Decimal
            wallet.balance += Decimal(str(payout.amount))

    payout.status = status
    payout.admin_note = admin_note
    payout.processed_at = datetime.datetime.now()
    db.commit()
    db.refresh(payout)
    return payout

def get_or_create_stripe_price(price_amount: float, is_yearly: bool) -> str:
    """Helper to dynamically find or create a Price ID in Stripe for the subscription."""
    stripe.api_key = STRIPE_SECRET_KEY
    price_cents = int(price_amount * 100)
    interval = "year" if is_yearly else "month"
    product_name = f"Monteeq Pro {'Yearly' if is_yearly else 'Monthly'}"
    
    try:
        prices = stripe.Price.list(active=True, limit=100)
        for p in prices.auto_paging_iter():
            if p.unit_amount == price_cents and p.recurring and p.recurring.interval == interval:
                try:
                    prod = stripe.Product.retrieve(p.product)
                    if "Monteeq Pro" in prod.name:
                        return p.id
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"Error listing Stripe prices: {str(e)}")
        
    try:
        product = stripe.Product.create(
            name=product_name,
            description="Access to premium creator features including ad-free, 4K rendering, gold challenges.",
        )
        price = stripe.Price.create(
            unit_amount=price_cents,
            currency="usd",
            recurring={"interval": interval},
            product=product.id,
        )
        return price.id
    except Exception as e:
        logger.error(f"Error creating Stripe product/price: {str(e)}")
        raise e

@router.get("/pro/pricing", response_model=schemas.ProPricingResponse)
def get_pro_pricing():
    """Returns the current pricing for Monteeq Pro."""
    return {"monthly_price": 4.99, "yearly_price": 53.89}

@router.post("/subscriptions/create", response_model=schemas.SubscriptionCreateResponse)
def create_subscription(
    payload: schemas.SubscriptionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates or retrieves a Stripe Customer, creates a subscription,
    and returns the client secret of the payment intent to complete verification on the frontend.
    """
    if current_user.subscription_tier == "pro" and current_user.subscription_status == "active":
        raise HTTPException(status_code=400, detail="You already have an active subscription")

    stripe.api_key = STRIPE_SECRET_KEY
    
    customer_id = current_user.stripe_customer_id
    if not customer_id:
        try:
            customer = stripe.Customer.create(
                email=payload.billing_email,
                name=payload.full_name,
                metadata={
                    "user_id": str(current_user.id),
                    "billing_country": payload.billing_country,
                    "billing_zip": payload.billing_zip
                }
            )
            customer_id = customer.id
            current_user.stripe_customer_id = customer_id
            db.commit()
        except Exception as e:
            logger.error(f"Failed to create Stripe customer: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to configure customer profile: {str(e)}")
    else:
        try:
            stripe.Customer.modify(
                customer_id,
                email=payload.billing_email,
                name=payload.full_name,
                metadata={
                    "user_id": str(current_user.id),
                    "billing_country": payload.billing_country,
                    "billing_zip": payload.billing_zip
                }
            )
        except Exception as e:
            logger.warning(f"Failed to update Stripe customer: {str(e)}")

    price_amount = 53.89 if payload.is_yearly else 4.99
    try:
        price_id = get_or_create_stripe_price(price_amount, payload.is_yearly)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve subscription plan price: {str(e)}")

    try:
        if current_user.subscription_id:
            try:
                existing_sub = stripe.Subscription.retrieve(current_user.subscription_id)
                if existing_sub.status in ["incomplete", "incomplete_expired"]:
                    stripe.Subscription.cancel(current_user.subscription_id)
            except Exception:
                pass

        # Support both new Basil API version (2025-03-31+) and legacy versions dynamically
        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": price_id}],
                payment_behavior="default_incomplete",
                payment_settings={"save_default_payment_method": "on_subscription"},
                expand=["latest_invoice.confirmation_secret"],
                metadata={
                    "user_id": str(current_user.id),
                    "payment_type": "pro_subscription",
                    "is_yearly": str(payload.is_yearly)
                }
            )
            client_secret = subscription.latest_invoice.confirmation_secret.client_secret
        except Exception as e:
            # If the Stripe API version is legacy, confirmation_secret expansion will fail.
            # We then fall back to the legacy payment_intent expansion.
            if "confirmation_secret" in str(e) or "Invalid expand" in str(e) or "attribute" in str(e):
                logger.info("Falling back to legacy Stripe payment_intent expansion...")
                subscription = stripe.Subscription.create(
                    customer=customer_id,
                    items=[{"price": price_id}],
                    payment_behavior="default_incomplete",
                    payment_settings={"save_default_payment_method": "on_subscription"},
                    expand=["latest_invoice.payment_intent"],
                    metadata={
                        "user_id": str(current_user.id),
                        "payment_type": "pro_subscription",
                        "is_yearly": str(payload.is_yearly)
                    }
                )
                client_secret = subscription.latest_invoice.payment_intent.client_secret
            else:
                raise e
        
        subscription_id = subscription.id
        
        current_user.subscription_id = subscription_id
        current_user.subscription_status = "incomplete"
        current_user.subscription_tier = "pro"
        db.commit()
        
    except Exception as e:
        logger.error(f"Failed to create Stripe subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize subscription: {str(e)}")
        
    return {
        "status": "success",
        "subscriptionId": subscription_id,
        "clientSecret": client_secret
    }

@router.post("/subscriptions/verify")
def verify_subscription(
    payload: schemas.SubscriptionVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Direct client-side verification endpoint.
    Retrieves the subscription state from Stripe and upgrades the user tier immediately in the DB.
    Useful as a fallback or immediate confirmation path before the webhook arrives.
    """
    stripe.api_key = STRIPE_SECRET_KEY
    try:
        subscription = stripe.Subscription.retrieve(payload.subscription_id)
    except Exception as e:
        logger.error(f"Failed to retrieve subscription from Stripe: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid subscription ID")

    # Check if the subscription belongs to this user or customer
    customer_id = subscription.get("customer")
    if customer_id != current_user.stripe_customer_id:
        raise HTTPException(status_code=403, detail="Subscription does not belong to this user")

    status = subscription.get("status")
    if status in ["active", "trialing"]:
        from datetime import datetime as dt, timezone as tz
        subscription_id = subscription.get("id")
        current_user.subscription_id = subscription_id
        current_user.subscription_status = status
        current_user.subscription_tier = "pro"
        current_user.is_premium = True
        
        current_period_end = subscription.get("current_period_end")
        if current_period_end:
            current_user.current_period_end = dt.fromtimestamp(current_period_end, tz.utc)
        
        # Check if transaction already logged
        wallet = get_or_create_wallet(db, current_user.id)
        existing_tx = db.query(Transaction).filter(
            Transaction.wallet_id == wallet.id,
            Transaction.reference_id == subscription_id,
            Transaction.status == "success"
        ).first()
        
        if not existing_tx:
            amount = 4.99 # Fallback amount
            # Try to get price from first item
            try:
                price = subscription["items"]["data"][0]["price"]
                amount = (price["unit_amount"] or 0) / 100
            except Exception:
                pass
                
            db.add(Transaction(
                wallet_id=wallet.id,
                amount=amount,
                transaction_type="pro_subscription",
                status="success",
                reference_id=subscription_id,
                description=f"Monteeq Pro Subscription Verified (Immediate fallback, USD {amount:.2f})"
            ))
            
        db.commit()
        logger.info(f"Stripe verified Pro Upgrade via client verify. User: {current_user.id}")
        return {"status": "success", "message": "Subscription verified and upgraded successfully!", "is_premium": True}
    else:
        logger.warning(f"Subscription status is not active: {status}")
        return {"status": "incomplete", "message": f"Subscription status is {status}", "is_premium": False}

@router.get("/subscription/status", response_model=schemas.SubscriptionStatusResponse)
def get_subscription_status(
    current_user: User = Depends(get_current_user)
):
    """
    Returns the subscription tier, status, current period end date, and stripe customer id for the user.
    """
    cancel_at_period_end = False
    if current_user.subscription_id:
        try:
            stripe.api_key = STRIPE_SECRET_KEY
            sub = stripe.Subscription.retrieve(current_user.subscription_id)
            cancel_at_period_end = sub.get("cancel_at_period_end", False)
        except Exception:
            pass

    return {
        "status": current_user.subscription_status or "inactive",
        "tier": current_user.subscription_tier or "free",
        "current_period_end": current_user.current_period_end,
        "stripe_customer_id": current_user.stripe_customer_id,
        "cancel_at_period_end": cancel_at_period_end
    }

@router.post("/subscriptions/auto-renew")
def toggle_subscription_auto_renew(
    payload: schemas.SubscriptionAutoRenewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggles the cancel_at_period_end flag on Stripe to enable/disable auto-renew.
    """
    if not current_user.subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    stripe.api_key = STRIPE_SECRET_KEY
    try:
        sub = stripe.Subscription.modify(
            current_user.subscription_id,
            cancel_at_period_end=not payload.auto_renew
        )
        return {
            "status": "success",
            "auto_renew": payload.auto_renew,
            "message": "Auto-renewal status updated successfully"
        }
    except Exception as e:
        logger.error(f"Failed to toggle auto-renew: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update auto-renewal: {str(e)}")

@router.post("/subscriptions/cancel")
def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancels the user's subscription immediately in Stripe and updates database.
    """
    if not current_user.subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    stripe.api_key = STRIPE_SECRET_KEY
    try:
        stripe.Subscription.cancel(current_user.subscription_id)
        
        # Downgrade user in DB
        current_user.subscription_status = "canceled"
        current_user.subscription_tier = "free"
        current_user.is_premium = False
        db.commit()
        
        return {
            "status": "success",
            "message": "Subscription canceled successfully."
        }
    except Exception as e:
        logger.error(f"Failed to cancel subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")

@router.post("/customer-portal", response_model=schemas.CustomerPortalResponse)
def create_customer_portal(
    current_user: User = Depends(get_current_user)
):
    """
    Generates a Stripe Billing Customer Portal link and returns it.
    """
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="You do not have a billing history or active customer profile yet")
        
    stripe.api_key = STRIPE_SECRET_KEY
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/pro"
        )
        return {"url": portal_session.url}
    except Exception as e:
        logger.error(f"Failed to create Stripe Billing Portal session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to open billing settings: {str(e)}")

import uuid
@router.post("/pro/initialize", response_model=schemas.PaymentInitializeResponse)
def initialize_pro_subscription(
    payload: schemas.PaymentInitialize,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initializes a Stripe checkout session for Pro Subscription
    and saves the pending transaction in the database.
    """
    if current_user.is_premium:
        raise HTTPException(status_code=400, detail="You are already a Pro member")
    
    wallet = get_or_create_wallet(db, current_user.id)
    
    amount = 26400.0 if payload.is_yearly else 2500.0
    stripe_amount_cents = int(amount * 100)
    
    try:
        stripe.api_key = STRIPE_SECRET_KEY
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'ngn',
                    'product_data': {
                        'name': f"Monteeq Pro {'Yearly' if payload.is_yearly else 'Monthly'}",
                        'description': "Access to premium video rendering (4K), Gold Challenges, and 0% commission.",
                    },
                    'unit_amount': stripe_amount_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{FRONTEND_URL}/payment?status=success&reference={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/payment?status=cancelled&reference={{CHECKOUT_SESSION_ID}}",
            metadata={
                "user_id": str(current_user.id),
                "payment_type": "pro_subscription",
                "is_yearly": str(payload.is_yearly)
            }
        )
        reference = checkout_session.id
        checkout_url = checkout_session.url
    except Exception as e:
        logger.error(f"Failed to create Stripe Checkout Session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize payment gateway: {str(e)}")
    
    transaction = Transaction(
        wallet_id=wallet.id,
        amount=amount,
        transaction_type='pro_subscription',
        status='pending',
        reference_id=reference,
        description=f"Monteeq Pro {'Yearly' if payload.is_yearly else 'Monthly'} Subscription Upgrade (Pending - Stripe)"
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return {"reference": reference, "status": "success", "checkout_url": checkout_url}

@router.post("/verify-pro", response_model=schemas.ProUpgradeResponse)
async def verify_pro_subscription(
    payload: schemas.PaymentVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify a payment transaction reference (Stripe or Paystack) and upgrade user to Pro.
    """
    if current_user.is_premium:
        return {"status": "success", "message": "You are already a Pro member!", "is_premium": True}

    is_stripe = payload.reference.startswith("cs_")

    if is_stripe:
        try:
            stripe.api_key = STRIPE_SECRET_KEY
            session = stripe.checkout.Session.retrieve(payload.reference)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Stripe verification failed: {str(e)}")

        if session.payment_status != "paid":
            logger.error(f"Stripe verification failed: {session}")
            existing = db.query(Transaction).filter(Transaction.reference_id == payload.reference).first()
            if existing and existing.status == "pending":
                existing.status = "failed"
                db.commit()
            raise HTTPException(status_code=400, detail="Payment verification failed: Session is unpaid")

        logger.info(f"Stripe verification success for reference: {payload.reference}")
        amount = (session.amount_total or 0) / 100
        is_yearly = session.metadata.get("is_yearly") == "True"
    else:
        # Verify with Paystack
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://api.paystack.co/transaction/verify/{payload.reference}",
                    headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
                    timeout=10.0
                )
                data = response.json()
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Paystack verification failed: {str(e)}")

        if not data.get("status") or data.get("data", {}).get("status") != "success":
            logger.error(f"Paystack verification failed: {data}")
            existing = db.query(Transaction).filter(Transaction.reference_id == payload.reference).first()
            if existing and existing.status == "pending":
                existing.status = "failed"
                db.commit()
            error_msg = data.get("data", {}).get("gateway_response") or data.get("message", "Unknown error")
            raise HTTPException(status_code=400, detail=f"Payment verification failed: {error_msg}")

        logger.info(f"Paystack verification success for reference: {payload.reference}")
        try:
            amount = data["data"]["amount"] / 100
        except (KeyError, TypeError):
            amount = 0.0
            logger.error(f"Could not extract amount for pro verify ref={payload.reference}")
        is_yearly = amount >= 20000

    # 3. Upgrade User
    from datetime import datetime, timedelta, timezone
    current_user.is_premium = True
    if is_yearly:
        current_user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=365)
    else:
        current_user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    
    # 4. Record Transaction (Idempotency)
    existing = db.query(Transaction).filter(Transaction.reference_id == payload.reference).first()
    if existing:
        if existing.status != "success":
            existing.status = "success"
            existing.amount = amount
    else:
        wallet = get_or_create_wallet(db, current_user.id)
        transaction = Transaction(
            wallet_id=wallet.id,
            amount=amount,
            transaction_type='pro_subscription',
            status='success',
            reference_id=payload.reference,
            description="Monteeq Pro Subscription Upgrade"
        )
        db.add(transaction)
        
    db.commit()
    db.refresh(current_user)

    logger.info(f"User {current_user.id} upgraded to premium. is_premium: {current_user.is_premium}")

    return {
        "status": "success",
        "message": "Welcome to Monteeq Pro! Your account has been upgraded.",
        "is_premium": True
    }


@router.post("/deposit/verify", response_model=schemas.Transaction)
async def verify_deposit_and_fund(
    payload: schemas.PaymentVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify a transaction reference (Stripe or Paystack) and fund the user's wallet or upgrade to Pro.
    """
    is_stripe = payload.reference.startswith("cs_")

    if is_stripe:
        try:
            stripe.api_key = STRIPE_SECRET_KEY
            session = stripe.checkout.Session.retrieve(payload.reference)
        except Exception as e:
            logger.error(f"Stripe API error for ref {payload.reference}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Stripe verification failed: {str(e)}")

        if session.payment_status != "paid":
            logger.warning(f"Stripe verification failed for ref {payload.reference}: session unpaid")
            raise HTTPException(status_code=400, detail="Payment verification failed: Session is unpaid")

        amount = (session.amount_total or 0) / 100
        payment_type = session.metadata.get("payment_type", "deposit")

        wallet = get_or_create_wallet(db, current_user.id)

        if payment_type == "pro_subscription":
            # Upgrade user to Pro
            is_yearly = session.metadata.get("is_yearly") == "True"
            from datetime import datetime, timedelta, timezone
            current_user.is_premium = True
            if is_yearly:
                current_user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=365)
            else:
                current_user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=30)

            # Record / update transaction
            existing = db.query(Transaction).filter(Transaction.reference_id == payload.reference).first()
            if existing:
                if existing.status != "success":
                    existing.status = "success"
                    existing.amount = amount
                transaction = existing
            else:
                transaction = Transaction(
                    wallet_id=wallet.id,
                    amount=amount,
                    transaction_type='pro_subscription',
                    status='success',
                    reference_id=payload.reference,
                    description="Monteeq Pro Subscription Upgrade"
                )
                db.add(transaction)
            db.commit()
            db.refresh(transaction)
            logger.info(f"Stripe verified Pro Upgrade via deposit verify. User: {current_user.id}")
            return transaction
        else:
            # Wallet deposit
            existing = db.query(Transaction).filter(Transaction.reference_id == payload.reference).first()
            if existing:
                return existing
            from decimal import Decimal
            wallet.balance += Decimal(str(amount))
            transaction = Transaction(
                wallet_id=wallet.id,
                amount=amount,
                transaction_type='deposit',
                reference_id=payload.reference,
                description="Wallet Top-up via Stripe"
            )
            db.add(transaction)
            db.add(wallet)
            db.commit()
            db.refresh(transaction)
            logger.info(f"Stripe verified Wallet Deposit via deposit verify. User: {current_user.id}, amount: {amount}")
            return transaction

    else:
        # Paystack verification flow
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://api.paystack.co/transaction/verify/{payload.reference}",
                    headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
                    timeout=10.0
                )
                data = response.json()
                logger.info(f"Paystack verification response for ref {payload.reference}: {data}")
            except Exception as e:
                logger.error(f"Paystack API error for ref {payload.reference}: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Paystack verification failed: {str(e)}")

        if not data.get("status") or data.get("data", {}).get("status") != "success":
            logger.warning(f"Paystack verification failed for ref {payload.reference}: {data}")
            error_msg = data.get('data', {}).get('gateway_response') or data.get('message', 'Unknown error')
            raise HTTPException(status_code=400, detail=f"Payment verification failed: {error_msg}")

        try:
            amount = data["data"]["amount"] / 100  # Convert kobo to NGN
        except (KeyError, TypeError):
            logger.error(f"Failed to extract amount from Paystack response for ref {payload.reference}: {data}")
            raise HTTPException(status_code=500, detail="Invalid data received from Paystack")
        
        # Check if Paystack metadata says pro_subscription
        meta = data.get("data", {}).get("metadata") or {}
        payment_type = meta.get("payment_type", "deposit")

        if payment_type == "pro_subscription":
            wallet = get_or_create_wallet(db, current_user.id)
            is_yearly = meta.get("billing_cycle") == "yearly" or amount >= 20000
            from datetime import datetime, timedelta, timezone
            current_user.is_premium = True
            if is_yearly:
                current_user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=365)
            else:
                current_user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            
            existing = db.query(Transaction).filter(Transaction.reference_id == payload.reference).first()
            if existing:
                if existing.status != "success":
                    existing.status = "success"
                    existing.amount = amount
                transaction = existing
            else:
                transaction = Transaction(
                    wallet_id=wallet.id,
                    amount=amount,
                    transaction_type='pro_subscription',
                    status='success',
                    reference_id=payload.reference,
                    description="Monteeq Pro Subscription Upgrade"
                )
                db.add(transaction)
            db.commit()
            db.refresh(transaction)
            return transaction
        else:
            from app.crud.monetization import verify_deposit
            transaction = verify_deposit(db, user_id=current_user.id, amount=amount, reference=payload.reference)
            logger.info(f"Deposit verified OK. Transaction ID: {transaction.id}")
            return transaction



# ================================================================== #
#  PAYSTACK WEBHOOK                                                    #
#  POST /api/v1/monetization/webhook/paystack                         #
#                                                                      #
#  Register in Paystack Dashboard:                                     #
#    Settings → API Keys & Webhooks → Webhook URL                      #
# ================================================================== #

@router.post("/webhook/paystack", status_code=200)
async def paystack_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Server-side Paystack event receiver (HMAC-SHA512 verified).

    Supported events:
      - charge.success → pro_subscription upgrade OR wallet deposit

    The frontend must pass these fields in Paystack's metadata when
    initialising a transaction so the webhook can route correctly:
      metadata: { user_id: <int>, payment_type: "pro_subscription" | "deposit" }
    """
    # ── 1. Read raw body BEFORE any parsing (required for valid HMAC) ──
    raw_body = await request.body()

    # ── 2. Verify Paystack HMAC-SHA512 signature ────────────────────────
    paystack_sig = request.headers.get("x-paystack-signature", "")
    expected_sig = hmac.new(
        PAYSTACK_SECRET_KEY.encode("utf-8"),
        raw_body,
        hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(paystack_sig, expected_sig):
        logger.warning("Paystack webhook: invalid HMAC signature — request rejected")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # ── 3. Parse event payload ───────────────────────────────────────────
    try:
        event = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = event.get("event")
    data       = event.get("data", {})
    reference  = data.get("reference")
    meta       = data.get("metadata") or {}
    logger.info(f"Paystack webhook received: event={event_type}, ref={reference}")

    # ── 4. Handle charge.success ─────────────────────────────────────────
    if event_type == "charge.success" and data.get("status") == "success":

        # Idempotency guard — skip if already processed
        existing = db.query(Transaction).filter(
            Transaction.reference_id == reference
        ).first()
        if existing:
            logger.info(f"Paystack webhook: ref {reference} already processed, skipping")
            return {"status": "ok", "message": "already_processed"}

        amount_ngn   = data.get("amount", 0) / 100  # kobo → NGN
        payment_type = meta.get("payment_type", "deposit")
        user_id      = meta.get("user_id")

        # Fallback: resolve user by customer email if metadata missing user_id
        if not user_id:
            customer_email = data.get("customer", {}).get("email")
            if customer_email:
                u = db.query(User).filter(User.email == customer_email).first()
                user_id = u.id if u else None

        if not user_id:
            logger.error(f"Paystack webhook: cannot determine user for ref={reference}")
            # Return 200 so Paystack stops retrying — nothing we can do without a user
            return {"status": "ok", "message": "user_not_found"}

        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            logger.error(f"Paystack webhook: user_id={user_id} not in DB for ref={reference}")
            return {"status": "ok", "message": "user_not_found"}

        wallet = get_or_create_wallet(db, user.id)

        if payment_type == "pro_subscription":
            from datetime import datetime, timedelta, timezone
            if not user.is_premium:
                user.is_premium = True
            
            if amount_ngn >= 20000:
                user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=365)
            else:
                user.premium_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            
            existing_tx = db.query(Transaction).filter(Transaction.reference_id == reference).first()
            if existing_tx:
                if existing_tx.status != "success":
                    existing_tx.status = "success"
                    existing_tx.amount = amount_ngn
            else:
                db.add(Transaction(
                    wallet_id=wallet.id,
                    amount=amount_ngn,
                    transaction_type="pro_subscription",
                    status="success",
                    reference_id=reference,
                    description="Monteeq Pro Subscription (Paystack webhook)"
                ))
            db.commit()
            logger.info(f"Paystack webhook: user {user.id} upgraded to Pro via ref={reference}")

        else:  # wallet deposit (default)
            from decimal import Decimal
            wallet.balance += Decimal(str(amount_ngn))
            db.add(Transaction(
                wallet_id=wallet.id,
                amount=amount_ngn,
                transaction_type="deposit",
                reference_id=reference,
                description=f"Wallet top-up via Paystack (₦{amount_ngn:,.2f})"
            ))
            db.commit()
            logger.info(f"Paystack webhook: ₦{amount_ngn:,.2f} credited to user {user.id} wallet, ref={reference}")

    else:
        logger.info(f"Paystack webhook: unhandled event type '{event_type}' — ignored")

    # Always return 200 to stop Paystack from retrying
    return {"status": "ok"}


# ================================================================== #
#  PAYSTACK CALLBACK / FALLBACK URL                                    #
#  GET /api/v1/monetization/payment/callback                          #
#                                                                      #
#  Register in Paystack Dashboard:                                     #
#    Settings → API Keys & Webhooks → Callback URL                     #
# ================================================================== #

@router.get("/payment/callback")
async def paystack_callback(
    reference: str = None,
    trxref: str = None,
):
    """
    Browser redirect fallback after Paystack hosted-page checkout.

    Paystack appends ?reference=xxx&trxref=xxx to this URL after the
    user completes or cancels payment on the hosted checkout page.
    We redirect them to the frontend /payment page with the reference
    so the UI can call /deposit/verify or /verify-pro to confirm.
    """
    ref = reference or trxref
    frontend = FRONTEND_URL.rstrip("/")

    if not ref:
        redirect_target = f"{frontend}/payment?status=cancelled"
    else:
        redirect_target = f"{frontend}/payment?status=pending&reference={ref}"

    logger.info(f"Paystack callback: ref={ref} → {redirect_target}")
    return RedirectResponse(url=redirect_target, status_code=302)


# ================================================================== #
#  STRIPE WEBHOOK                                                      #
#  POST /api/v1/monetization/webhook/stripe                           #
# ================================================================== #

@router.post("/webhook/stripe", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Server-side Stripe event receiver (verified using signature).
    """
    from datetime import datetime as dt, timezone as tz, timedelta
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        logger.warning("Stripe webhook: missing stripe-signature header")
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
        
    try:
        stripe.api_key = STRIPE_SECRET_KEY
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.warning(f"Stripe webhook: invalid payload: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.signature.SignatureVerificationError as e:
        logger.warning(f"Stripe webhook: signature verification failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type")
    logger.info(f"Stripe webhook received: event={event_type}")

    # Handle subscription events
    if event_type in ["customer.subscription.created", "customer.subscription.updated"]:
        subscription = event.get("data", {}).get("object", {})
        subscription_id = subscription.get("id")
        customer_id = subscription.get("customer")
        status = subscription.get("status")
        current_period_end_timestamp = subscription.get("current_period_end")
        
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.subscription_id = subscription_id
            user.subscription_status = status
            if current_period_end_timestamp:
                user.current_period_end = dt.fromtimestamp(current_period_end_timestamp, tz.utc)
            
            if status == "active":
                user.subscription_tier = "pro"
                user.is_premium = True
            elif status in ["unpaid", "canceled", "incomplete_expired"]:
                user.is_premium = False
            db.commit()
            logger.info(f"Stripe webhook: updated subscription {subscription_id} for user {user.id} to status={status}")

    elif event_type == "customer.subscription.deleted":
        subscription = event.get("data", {}).get("object", {})
        subscription_id = subscription.get("id")
        user = db.query(User).filter(User.subscription_id == subscription_id).first()
        if user:
            user.subscription_status = "canceled"
            user.is_premium = False
            db.commit()
            logger.info(f"Stripe webhook: deleted subscription {subscription_id} for user {user.id}")

    elif event_type == "invoice.paid":
        invoice = event.get("data", {}).get("object", {})
        subscription_id = invoice.get("subscription")
        if subscription_id:
            user = db.query(User).filter(User.subscription_id == subscription_id).first()
            if user:
                user.subscription_status = "active"
                user.subscription_tier = "pro"
                user.is_premium = True
                
                amount = (invoice.get("amount_paid") or 0) / 100
                wallet = get_or_create_wallet(db, user.id)
                db.add(Transaction(
                    wallet_id=wallet.id,
                    amount=amount,
                    transaction_type="pro_subscription",
                    status="success",
                    reference_id=invoice.get("charge") or subscription_id,
                    description=f"Monteeq Pro Subscription Invoice Paid (Stripe webhook, USD {amount:.2f})"
                ))
                db.commit()
                logger.info(f"Stripe webhook: paid invoice for subscription {subscription_id}, user {user.id}")

    elif event_type == "invoice.payment_failed":
        invoice = event.get("data", {}).get("object", {})
        subscription_id = invoice.get("subscription")
        if subscription_id:
            user = db.query(User).filter(User.subscription_id == subscription_id).first()
            if user:
                user.subscription_status = "past_due"
                user.is_premium = False
                
                amount = (invoice.get("amount_due") or 0) / 100
                wallet = get_or_create_wallet(db, user.id)
                db.add(Transaction(
                    wallet_id=wallet.id,
                    amount=amount,
                    transaction_type="pro_subscription",
                    status="failed",
                    reference_id=invoice.get("id") or subscription_id,
                    description=f"Monteeq Pro Subscription Invoice Payment Failed (Stripe webhook, USD {amount:.2f})"
                ))
                db.commit()
                logger.warning(f"Stripe webhook: payment failed invoice for subscription {subscription_id}, user {user.id}")

    elif event_type == "checkout.session.completed":
        session = event.get("data", {}).get("object", {})
        reference = session.get("id") # Stripe Checkout Session ID
        metadata = session.get("metadata", {})
        
        # Idempotency guard
        existing = db.query(Transaction).filter(Transaction.reference_id == reference).first()
        if existing and existing.status == "success":
            logger.info(f"Stripe webhook: ref {reference} already processed, skipping")
            return {"status": "ok"}
            
        user_id = metadata.get("user_id")
        payment_type = metadata.get("payment_type", "deposit")
        is_yearly = metadata.get("is_yearly") == "True"
        amount = (session.get("amount_total") or 0) / 100
        
        if not user_id:
            logger.error(f"Stripe webhook: missing user_id in metadata for session={reference}")
            return {"status": "ok", "message": "user_id_missing"}
            
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            logger.error(f"Stripe webhook: user {user_id} not found in DB")
            return {"status": "ok", "message": "user_not_found"}
            
        wallet = get_or_create_wallet(db, user.id)
        
        if payment_type == "pro_subscription":
            user.is_premium = True
            user.subscription_tier = "pro"
            user.subscription_status = "active"
            if is_yearly:
                user.premium_expires_at = dt.now(tz.utc) + timedelta(days=365)
                user.current_period_end = dt.now(tz.utc) + timedelta(days=365)
            else:
                user.premium_expires_at = dt.now(tz.utc) + timedelta(days=30)
                user.current_period_end = dt.now(tz.utc) + timedelta(days=30)
                
            existing_tx = db.query(Transaction).filter(Transaction.reference_id == reference).first()
            if existing_tx:
                if existing_tx.status != "success":
                    existing_tx.status = "success"
                    existing_tx.amount = amount
            else:
                db.add(Transaction(
                    wallet_id=wallet.id,
                    amount=amount,
                    transaction_type="pro_subscription",
                    status="success",
                    reference_id=reference,
                    description="Monteeq Pro Subscription (Stripe Checkout webhook)"
                ))
            db.commit()
            logger.info(f"Stripe webhook: user {user.id} upgraded to Pro via reference={reference}")
        else:
            # Wallet deposit
            from decimal import Decimal
            existing_tx = db.query(Transaction).filter(Transaction.reference_id == reference).first()
            if existing_tx:
                if existing_tx.status != "success":
                    existing_tx.status = "success"
                    wallet.balance += Decimal(str(amount))
            else:
                wallet.balance += Decimal(str(amount))
                db.add(Transaction(
                    wallet_id=wallet.id,
                    amount=amount,
                    transaction_type="deposit",
                    status="success",
                    reference_id=reference,
                    description=f"Wallet top-up via Stripe (₦{amount:,.2f})"
                ))
            db.commit()
            logger.info(f"Stripe webhook: credited ₦{amount:,.2f} to user {user.id} wallet, reference={reference}")
            
    return {"status": "ok"}
