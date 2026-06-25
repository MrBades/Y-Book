from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum, Q, F, ExpressionWrapper, DecimalField
from django.utils import timezone
from .models import Customer, Invoice, InvoiceItem, Product, BusinessProfile, LowStockNotification
from .utils import parse_multimodal_smart_input
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@login_required
def smart_input_processor(request):
    """
    Django API endpoint that accepts multimodal ledger information:
    - Text prompt (JSON or raw body request)
    - Audio recordings (recorded voice notes)
    - Images (receipts, handwritten lists, stock snapshots)
    Processes using multimodal Gemini AI or Regex fallback,
    and returns a clean JSON layout mapping both 'product_name' and line list 'items'.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST requests allowed"}, status=405)

    try:
        # 1. Retrieve inputs
        text_prompt = request.POST.get("text", "").strip()
        
        image_file = request.FILES.get("image")
        audio_file = request.FILES.get("audio")

        # Fallback check if request is formatted as JSON (e.g. from fetch client)
        if not text_prompt and not image_file and not audio_file:
            import json
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                text_prompt = body_data.get("text", "")
            except Exception:
                pass

        if not text_prompt and not image_file and not audio_file:
            return JsonResponse({"error": "No input provided. Please enter text, record voice, or pick a file."}, status=400)

        # 2. Call the hybrid parse utility
        parsed_data = parse_multimodal_smart_input(
            text=text_prompt,
            image_file=image_file,
            audio_file=audio_file
        )

        # Ensure that 'product_name' flat key is ALWAYS mapped to prevent crashing downstream (KeyError)
        # downstream code checks: Product.objects.filter(name__icontains=parsed_data['product_name'])
        if not parsed_data or 'product_name' not in parsed_data:
            parsed_data['product_name'] = parsed_data.get('product_name', 'General Goods') if parsed_data else 'General Goods'

        # 3. Simulate CRM query matching or item creations for user response
        # Retrieve the user's business profile
        business_profile = request.user.business_profile
        
        # Look up or create Customer seamlessly based on AI output
        customer_name = parsed_data.get("customer_name") or "Walk-in Customer"
        customer, created = Customer.objects.get_or_create(
            business=business_profile,
            name=customer_name
        )

        return JsonResponse({
            "status": "success",
            "parsed_data": parsed_data,
            "matched_customer": {
                "id": customer.id,
                "name": customer.name,
                "active_debt": float(customer.active_debt_balance)
            }
        })

    except Exception as e:
        logger.exception("Error processing smart input")
        # Ensure a clean fallback layout is returned rather than a 500 error
        return JsonResponse({
            "status": "fallback_error",
            "error": str(e),
            "parsed_data": {
                "product_name": "General Goods",
                "customer_name": "Walk-in Customer",
                "items": [],
                "total_amount": 0.0,
                "amount_paid": 0.0,
                "debt_balance": 0.0,
                "transaction_type": "sale"
            }
        })


@login_required
def debtor_list_view(request):
    """
    Debtors View: Displays all clients with outstanding debt balances (total_amount > amount_paid).
    Aggregates overall statistics: Total Debt, Invoiced Debt, Paid Debt, and Aging list details.
    """
    business_profile = request.user.business_profile
    
    # 1. Query customers with active outstanding debt
    # We can filter directly by historical invoice totals or the active_debt_balance cached field
    debtors = Customer.objects.filter(
        business=business_profile,
        active_debt_balance__gt=0
    ).order_by('-active_debt_balance')

    # 2. Compute aggregate totals
    aggregates = Invoice.objects.filter(
        business=business_profile
    ).aggregate(
        total_invoiced_amount=Sum('total_amount'),
        total_paid_amount=Sum('amount_paid')
    )

    total_invoiced = aggregates.get('total_invoiced_amount') or 0.00
    total_paid = aggregates.get('total_paid_amount') or 0.00
    total_outstanding_debt = sum(c.active_debt_balance for c in debtors)

    # 3. Handle specific debt aging ranges for insights (e.g. 0-30 days, 30+ days)
    now = timezone.now()
    thirty_days_ago = now - timezone.timedelta(days=30)
    
    recent_debt = Invoice.objects.filter(
        business=business_profile,
        created_at__gte=thirty_days_ago,
        total_amount__gt=F('amount_paid')
    ).annotate(
        unpaid=ExpressionWrapper(F('total_amount') - F('amount_paid'), output_field=DecimalField())
    ).aggregate(unpaid_sum=Sum('unpaid')).get('unpaid_sum') or 0.00

    aged_over_30_debt = max(0.00, float(total_outstanding_debt) - float(recent_debt))

    context = {
        "debtors": debtors,
        "total_outstanding_debt": total_outstanding_debt,
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "recent_debt": recent_debt,
        "aged_over_30_debt": aged_over_30_debt,
        "current_template": business_profile.invoice_template_preference,
        "business_logo": business_profile.business_logo.url if business_profile.business_logo else None,
    }

    return render(request, "core/debtor_list.html", context)


@login_required
def dashboard(request):
    """
    Core Dashboard view for 'Yeedem Books'.
    Aggregates SME operations, sales metrics, and fetches product low-stock notification alerts.
    """
    # Safeguard get or create business profile for user
    business_profile, _ = BusinessProfile.objects.get_or_create(
        user=request.user,
        defaults={"business_name": request.user.username + " Books"}
    )
    
    # Fetch all live unread notifications (low stock warning logs)
    unread_warnings = LowStockNotification.objects.filter(
        business=business_profile,
        is_read=False
    )
    unread_notifications_count = unread_warnings.count()
    
    # Financial KPI aggregates
    invoices = Invoice.objects.filter(business=business_profile)
    total_sales = invoices.aggregate(total=Sum('total_amount')).get('total') or 0.00
    total_paid = invoices.aggregate(paid=Sum('amount_paid')).get('paid') or 0.00
    
    # Calculate outstanding debt
    total_outstanding_debt = sum(c.active_debt_balance for c in Customer.objects.filter(business=business_profile))
    
    # Transaction logs feed
    recent_transactions = invoices.order_by('-created_at')[:10]
    
    # Low-stock Products Catalog reference for alerts
    low_stock_products = Product.objects.filter(
        business=business_profile,
        stock_quantity__lte=5
    )
    
    context = {
        "business_profile": business_profile,
        "total_sales": float(total_sales),
        "total_paid": float(total_paid),
        "total_outstanding_debt": float(total_outstanding_debt),
        "recent_transactions": recent_transactions,
        "low_stock_products": low_stock_products,
        "unread_warnings": unread_warnings,
        "unread_notifications_count": unread_notifications_count,
    }
    
    return render(request, "core/dashboard.html", context)


@csrf_exempt
@login_required
def update_customer_contact(request):
    """
    Submits an AJAX POST request to update a customer's phone or email seamlessly.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    from django.shortcuts import get_object_or_404
    import json
    
    try:
        # Load data from POST parameters or body JSON
        customer_id = request.POST.get("customer_id")
        phone = request.POST.get("phone")
        email = request.POST.get("email")
        
        if not customer_id and request.body:
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                customer_id = body_data.get("customer_id")
                phone = body_data.get("phone")
                email = body_data.get("email")
            except Exception:
                pass
                
        customer = get_object_or_404(Customer, id=customer_id, business=request.user.business_profile)
        
        if phone is not None:
            customer.phone = phone.strip()
        if email is not None:
            customer.email = email.strip()
            
        customer.save()
        
        return JsonResponse({
            "status": "success",
            "message": "Customer contact information updated successfully",
            "customer": {
                "id": customer.id,
                "name": customer.name,
                "phone": customer.phone,
                "email": customer.email,
            }
        })
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


@login_required
def clear_invoice_firs(request, invoice_id):
    """
    Simulates clearing the invoice with Nigeria's Federal Inland Revenue Service (FIRS)
    and flagging it as approved/cleared.
    """
    from django.shortcuts import get_object_or_404
    invoice = get_object_or_404(Invoice, id=invoice_id, business=request.user.business_profile)
    # Mock clear logic (e.g., save in custom state or log)
    logger.info(f"Invoice {invoice.id} successfully cleared with FIRS")
    return JsonResponse({
        "status": "success",
        "message": f"Invoice YB-2026-{invoice.id[:4]} cleared with FIRS successfully",
        "firs_clearance_code": f"FIRS-CLR-2026-{invoice.id[:8].upper()}"
    })


def public_invoice_detail(request, token):
    """
    Renders public readable copy of invoice via token link.
    """
    from django.shortcuts import get_object_or_404
    # In real models, token can be matched. Here we pull invoice based on matching id/sub-id or mock.
    # We will search invoices
    invoice = Invoice.objects.first() # safe fallback or dummy for demonstration
    context = {
        "invoice": invoice,
        "token": token,
        "business": invoice.business if invoice else None
    }
    return render(request, "core/public_invoice.html", context)


def invoice_pdf(request, pk):
    """
    Returns PDF stream of rendered invoice or redirects.
    """
    from django.shortcuts import get_object_or_404
    invoice = get_object_or_404(Invoice, pk=pk)
    # Real view returns rendered PDF. Here we return json metadata to mimic successful backend response.
    return JsonResponse({
        "status": "success",
        "message": "PDF Download streaming placeholder",
        "download_url": f"/media/pdfs/invoice_{pk}.pdf"
    })


@login_required
def unread_notifications_count(request):
    """
    Returns counts of currently active warning alarms.
    """
    count = LowStockNotification.objects.filter(
        business=request.user.business_profile,
        is_read=False
    ).count()
    return JsonResponse({
        "status": "success",
        "unread_count": count
    })


@csrf_exempt
@login_required
def mark_notifications_read(request):
    """
    Marks all notifications for this business profile as read.
    """
    LowStockNotification.objects.filter(
        business=request.user.business_profile,
        is_read=False
    ).update(is_read=True)
    return JsonResponse({
        "status": "success",
        "message": "All database notifications successfully synced."
    })


@csrf_exempt
@login_required
def product_edit(request):
    """
    Increments catalog stock level via AJAX POST or edits product details.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    
    import json
    try:
        product_id = request.POST.get("product_id") or request.POST.get("id")
        increment = request.POST.get("increment")
        
        if not product_id and request.body:
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                product_id = body_data.get("product_id") or body_data.get("id")
                increment = body_data.get("increment")
            except:
                pass
                
        from django.shortcuts import get_object_or_454, get_object_or_404
        # Gracefully load product
        product = get_object_or_404(Product, id=product_id, business=request.user.business_profile)
        
        qty = int(increment) if increment else 10
        product.stock_quantity = product.stock_quantity + qty
        product.save()
        
        # If stock quantity is restored above the low stock threshold (e.g., 5), resolve the notification
        if product.stock_quantity > 5:
            LowStockNotification.objects.filter(
                business=request.user.business_profile,
                product=product,
                is_read=False
            ).update(is_read=True)
            
        return JsonResponse({
            "status": "success",
            "message": f"Successfully incremented stock for {product.name} by {qty} units.",
            "new_stock": product.stock_quantity
        })
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


