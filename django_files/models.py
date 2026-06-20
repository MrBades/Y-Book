from django.db import models
from django.contrib.auth.models import User
from django.db.models import Sum, F

class BusinessProfile(models.Model):
    """
    Stores credentials, invoicing preferences, business designs, and template preferences.
    Each user gets a BusinessProfile upon login/onboarding.
    """
    TEMPLATE_CHOICES = [
        ('classic', 'Classic Ledger (B&W)'),
        ('modern_blue', 'Modern Sea Blue Accent'),
        ('kiosk_compact', 'Kiosk Compact Ticket'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, r_name='business_profile', related_name='business_profile')
    business_name = models.CharField(max_length=255, default="My SME Business")
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    
    # 1. Custom template selection preference
    invoice_template_preference = models.CharField(
        max_length=30,
        choices=TEMPLATE_CHOICES,
        default='classic',
        help_text="Select visual stylesheet template design for public-facing and PDF receipts."
    )
    
    # 2. Uploaded active store business logo
    business_logo = models.ImageField(
        upload_to='business_logos/',
        blank=True,
        null=True,
        help_text="Provide Business logo. Rendered globally on customer receipts."
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.business_name


class Customer(models.Model):
    """
    Represents buying contacts, clients, and traders.
    """
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='customers')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True, help_text="Customer's email address for digital delivery.")
    
    # 3. Active Debt Balance Tracking
    # We maintain a cached total, or dynamic database query to record active debt.
    # Storing a current outstanding base value allows fast reads and filters.
    active_debt_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Accumulated outstanding credit total currently owed by this customer."
    )

    def __str__(self):
        return f"{self.name} (Debt: ₦{self.active_debt_balance:,.2f})"

    def recalculate_debt(self):
        """
        Aggregates invoice numbers to recalculate debt from scratch if needed.
        Outstanding Balance = Sum of Invoices subtotals - Sum of payments/amount_paid.
        """
        totals = self.invoices.aggregate(
            total_owed=Sum('total_amount'),
            total_paid=Sum('amount_paid')
        )
        total_owed = totals.get('total_owed') or 0.00
        total_paid = totals.get('total_paid') or 0.00
        self.active_debt_balance = max(0.00, total_owed - total_paid)
        self.save()


class Product(models.Model):
    """
    SME inventories, stock items, or commodities (e.g. Garri bag).
    """
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.IntegerField(default=0)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Auto-generate a database notification record if stock levels dip low (<= 5 units)
        if self.stock_quantity <= 5:
            LowStockNotification.objects.get_or_create(
                business=self.business,
                product=self,
                is_read=False,
                defaults={"message": f"Low Stock Alert: {self.name} stock level is currently {self.stock_quantity}."}
            )


class LowStockNotification(models.Model):
    """
    Stores automated tracking alerts when a product runs low.
    """
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='warnings')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.business.business_name} - {self.message}"


class Invoice(models.Model):
    """
    Sales transactions & credit accounts representing the ledger's journal items.
    """
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='invoices')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='invoices')
    product_name = models.CharField(max_length=255, help_text="Flat product mapping key to prevent KeyErrors.")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']

    @property
    def is_debt(self):
        return self.total_amount > self.amount_paid

    @property
    def debt_amount(self):
        return max(0.00, self.total_amount - self.amount_paid)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_debt_diff = 0
        
        if not is_new:
            # Recalculate if totals adjusted
            old_self = Invoice.objects.get(pk=self.pk)
            old_debt_diff = (old_self.total_amount - old_self.amount_paid)
            
        super().save(*args, **kwargs)
        
        # Increment/re-update associated customer's outstanding balance
        new_debt = (self.total_amount - self.amount_paid)
        self.customer.active_debt_balance = (
            self.customer.active_debt_balance - old_debt_diff + new_debt
        )
        self.customer.save()


class InvoiceItem(models.Model):
    """
    Line items on the receipt
    """
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    item_description = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)
