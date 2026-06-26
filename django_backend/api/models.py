import uuid
from django.db import models
from django.contrib.auth.models import User
from django.db.models import Sum

def generate_biz_id():
    return f"biz_{uuid.uuid4().hex[:12]}"

def generate_cust_id():
    return f"cust_{uuid.uuid4().hex[:12]}"

def generate_prod_id():
    return f"prod_{uuid.uuid4().hex[:12]}"

def generate_notif_id():
    return f"notif_{uuid.uuid4().hex[:12]}"

def generate_inv_id():
    return f"inv_{uuid.uuid4().hex[:12]}"

def generate_invoice_id():
    return f"inv_{uuid.uuid4().hex[:12]}"

def generate_item_id():
    return f"item_{uuid.uuid4().hex[:12]}"

def generate_supp_id():
    return f"supp_{uuid.uuid4().hex[:12]}"

def generate_restock_id():
    return f"restock_{uuid.uuid4().hex[:12]}"

def generate_bkp_id():
    return f"bkp_{uuid.uuid4().hex[:12]}"

def generate_staff_id():
    return f"staff_{uuid.uuid4().hex[:12]}"

def generate_log_id():
    return f"log_{uuid.uuid4().hex[:12]}"

class BusinessProfile(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_biz_id)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='business_profile')
    business_name = models.CharField(max_length=255, default="My SME Business")
    business_type = models.CharField(max_length=50, choices=[('buy_and_sell', 'Buy and Sell'), ('service', 'Service')], default='buy_and_sell')
    phone_number = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    invoice_template_preference = models.CharField(max_length=50, default='classic')
    
    # Missing fields for unified backend auth parity
    owner_pin = models.CharField(max_length=10, blank=True, null=True)
    shop_slug = models.CharField(max_length=255, blank=True, null=True)
    full_name = models.CharField(max_length=255, blank=True, null=True)
    is_suspicious_locked = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    # Subscription status parity fields
    subscription_plan = models.CharField(max_length=50, default='starter')
    subscription_status = models.CharField(max_length=50, default='active')
    
    # Custom display settings
    business_logo = models.TextField(blank=True, null=True, help_text="Base64 representation or logo image URL")
    custom_accent_color = models.CharField(max_length=50, default="#00A6FF")
    custom_font_size = models.CharField(max_length=20, default="md")
    custom_font_family = models.CharField(max_length=30, default="sans")
    custom_show_logo = models.BooleanField(default=True)
    custom_header_title = models.CharField(max_length=255, blank=True, null=True)
    custom_footer_notes = models.TextField(blank=True, null=True)
    custom_shadow_style = models.CharField(max_length=30, default="sm")
    
    # Transformation sliders
    logo_width = models.IntegerField(default=80)
    logo_height = models.IntegerField(default=80)
    logo_rotation = models.IntegerField(default=0)
    header_rotation = models.IntegerField(default=0)
    
    # Custom Section Stylings (stored as JSON for flexibility, mapping directly to Front-End styles)
    header_styles_json = models.JSONField(blank=True, null=True, help_text="JSON mapping for header fonts and colors")
    customer_styles_json = models.JSONField(blank=True, null=True, help_text="JSON mapping for customer section styles")
    table_styles_json = models.JSONField(blank=True, null=True, help_text="JSON mapping for table display text")
    footer_styles_json = models.JSONField(blank=True, null=True, help_text="JSON mapping for bottom details")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.business_name


class Customer(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_cust_id)
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='customers')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    active_debt_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - Outstanding Debt: ₦{self.active_debt_balance}"

    def recalculate_debt(self):
        # Outstanding Balance = Sum of Invoices unpaid/debt amounts
        invoices = self.invoices.all()
        debt_total = sum(i.debt_balance for i in invoices)
        self.active_debt_balance = debt_total
        self.save()


class Product(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_prod_id)
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, blank=True, null=True)
    stock = models.IntegerField(default=0)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    min_quantity_count = models.IntegerField(default=5)

    def __str__(self):
        return f"{self.name} ({self.stock} units)"

    def check_low_stock(self):
        if self.stock <= self.min_quantity_count:
            LowStockNotification.objects.get_or_create(
                business=self.business,
                product=self,
                is_read=False,
                defaults={"message": f"Low Stock Alarm: {self.name} stock level is down to {self.stock} units."}
            )


class LowStockNotification(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_notif_id)
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='warnings')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.message


class Invoice(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_inv_id)
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='invoices')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='invoices')
    customerName = models.CharField(max_length=255, help_text="Flat name mapping of client")
    productName = models.CharField(max_length=255, help_text="Flat product list snapshot descriptor")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    debt_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    transaction_type = models.CharField(
        max_length=50,
        choices=[('sale', 'Sale Transaction'), ('expense', 'Expense Ledger'), ('payment_on_account', 'Advance Payment')],
        default='sale'
    )
    status = models.CharField(
        max_length=20,
        choices=[('DRAFT', 'Draft Phase'), ('PAID', 'Settled & Paid'), ('OVERDUE', 'Aged Balance Overdue')],
        default='OVERDUE'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice {self.id} (₦{self.total_amount})"

    def save(self, *args, **kwargs):
        # Enforce mathematical state alignment
        self.debt_balance = max(0, self.total_amount - self.amount_paid)
        
        # Override overdue status automatically if debt balance is zeroed
        if self.debt_balance == 0:
            self.status = 'PAID'
            
        super().save(*args, **kwargs)
        
        # Trigger parent customer recalculations
        self.customer.recalculate_debt()


class InvoiceItem(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_item_id)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def save(self, *args, **kwargs):
        self.total = self.quantity * self.price
        super().save(*args, **kwargs)


class SupplierRecord(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_supp_id)
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name='suppliers')
    supplier_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=50, blank=True, null=True)
    outstanding_balance_owed = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.supplier_name


class InventoryIntakeLog(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_restock_id)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='restocks')
    supplier = models.ForeignKey(SupplierRecord, on_delete=models.SET_NULL, blank=True, null=True, related_name='stock_inputs')
    amount = models.IntegerField(default=0)
    unit_cost_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            # Dynamically increment matching product inventory levels
            self.product.stock += self.amount
            self.product.save()
            self.product.check_low_stock()


class MerchantSession(models.Model):
    session_id = models.CharField(max_length=100, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='merchant_sessions')
    device_fingerprint = models.CharField(max_length=255, default='unknown_fp')
    last_active_ip = models.CharField(max_length=100, default='127.0.0.1')
    last_active_region = models.CharField(max_length=100, default='NG-Lagos')
    is_suspicious_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Session {self.session_id} for user {self.user.username}"


class LedgerBackup(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_bkp_id)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ledgers_backups')
    filename = models.CharField(max_length=255)
    backup_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.filename


class Staff(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_staff_id)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='staff_members')
    name_slug = models.CharField(max_length=100)
    real_name = models.CharField(max_length=255)
    owner_generated_pin = models.CharField(max_length=10)
    is_active = models.BooleanField(default=True)
    shop_id = models.CharField(max_length=100, default='default_shop')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.real_name} (Slug: {self.name_slug})"


class StaffActivityLog(models.Model):
    id = models.CharField(max_length=100, primary_key=True, default=generate_log_id)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='staff_logs')
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, blank=True, null=True, related_name='logs')
    action_taken = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_flagged = models.BooleanField(default=False)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Log {self.id} for action {self.action_taken}"


class WhatsAppVerification(models.Model):
    phone = models.CharField(max_length=50) # The user's phone number
    code = models.CharField(max_length=6)
    status = models.CharField(max_length=20, default='pending') # 'pending', 'verified'
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def __str__(self):
        return f"{self.phone} - {self.status}"

