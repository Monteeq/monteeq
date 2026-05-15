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
from app.core.config import PAYSTACK_SECRET_KEY, BASE_URL, FRONTEND_URL
import httpx

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

@router.post("/verify-pro", response_model=schemas.ProUpgradeResponse)
async def verify_pro_subscription(
    payload: schemas.PaymentVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify a Paystack transaction reference and upgrade user to Pro.
    """
    if current_user.is_premium:
        return {"status": "success", "message": "You are already a Pro member!", "is_premium": True}

    # 1. Verify with Paystack
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
        error_msg = data.get("data", {}).get("gateway_response") or data.get("message", "Unknown error")
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {error_msg}")

    logger.info(f"Paystack verification success for reference: {payload.reference}")

    try:
        amount = data["data"]["amount"] / 100
    except (KeyError, TypeError):
        amount = 0.0
        logger.error(f"Could not extract amount for pro verify ref={payload.reference}")

    # 3. Upgrade User
    current_user.is_premium = True
    
    # 4. Record Transaction (Idempotency)
    existing = db.query(Transaction).filter(Transaction.reference_id == payload.reference).first()
    if not existing:
        wallet = get_or_create_wallet(db, current_user.id)
        transaction = Transaction(
            wallet_id=wallet.id,
            amount=amount,
            transaction_type='pro_subscription',
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
    Verify a Paystack transaction reference and fund the user's wallet.
    """
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
            if not user.is_premium:
                user.is_premium = True
            db.add(Transaction(
                wallet_id=wallet.id,
                amount=amount_ngn,
                transaction_type="pro_subscription",
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
