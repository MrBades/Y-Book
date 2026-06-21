from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum
from .models import (
    BusinessProfile,
    Customer,
    Product,
    LowStockNotification,
    Invoice,
    InvoiceItem,
    SupplierRecord,
    InventoryIntakeLog
)

# Customizing general Django Admin site properties
admin.site.site_header = "🐉 YEEDEM BOOKS | Enterprise Control Portal"
admin.site.site_title = "Yeedem Books Administration"
admin.site.index_title = "Master Bookkeeping Operations & Telemetry Ledger"


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1
    fields = ('name', 'quantity', 'price', 'total')
    readonly_fields = ('total',)


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = (
        'business_name', 
        'business_type', 
        'phone_number', 
        'custom_accent_color_badge', 
        'invoice_template_preference', 
        'created_at'
    )
    list_filter = ('business_type', 'invoice_template_preference', 'created_at')
    search_fields = ('business_name', 'phone_number', 'user__username', 'user__email')
    
    fieldsets = (
        ("Core Identity", {
            'fields': ('user', 'business_name', 'business_type', 'phone_number', 'address')
        }),
        ("Visual Stylesheet & Preferences", {
            'fields': (
                'invoice_template_preference',
                'business_logo',
                'custom_accent_color',
                'custom_font_size',
                'custom_font_family',
                'custom_show_logo'
            ),
            'classes': ('collapse',),
        }),
        ("Header & Footer Custom Assets", {
            'fields': ('custom_header_title', 'custom_footer_notes', 'custom_shadow_style'),
            'classes': ('collapse',),
        }),
        ("Logo Transformers", {
            'fields': ('logo_width', 'logo_height', 'logo_rotation', 'header_rotation'),
            'classes': ('collapse',),
        }),
    )

    def custom_accent_color_badge(self, obj):
        return format_html(
            '<span style="background-color: {}; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-family: monospace;">{}</span>',
            obj.custom_accent_color,
            obj.custom_accent_color
        )
    custom_accent_color_badge.short_description = "Theme Color"


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'business', 'phone', 'email', 'formatted_debt_balance', 'created_date')
    list_filter = ('business', 'created_date')
    search_fields = ('name', 'phone', 'email', 'business__business_name')
    actions = ['recalculate_all_debts']

    def formatted_debt_balance(self, obj):
        if obj.active_debt_balance > 0:
            return format_html(
                '<strong style="color: #d32f2f;">₦{:,.2f}</strong>', 
                obj.active_debt_balance
            )
        return format_html('<span style="color: #2e7d32;">₦0.00 (Settled)</span>')
    formatted_debt_balance.short_description = "Outstanding Debt"

    @admin.action(description="Recalculate customer active outstanding debt balances")
    def recalculate_all_debts(self, request, queryset):
        for customer in queryset:
            customer.recalculate_debt()
        self.message_user(request, f"Successfully recalculated and synchronized balances for {queryset.count()} customers.")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'business', 'sku', 'price_badge', 'stock_status_badge', 'min_quantity_count')
    list_filter = ('business', 'stock')
    search_fields = ('name', 'sku', 'business__business_name')
    actions = ['restock_units_to_hundred']

    def price_badge(self, obj):
        return format_html('<strong>₦{:,.2f}</strong>', obj.price)
    price_badge.short_description = "Unit Price"

    def stock_status_badge(self, obj):
        if obj.stock <= obj.min_quantity_count:
            return format_html(
                '<span style="background-color: #ffebee; color: #c62828; padding: 3px 8px; border-radius: 4px; font-weight: bold; border: 1px solid #ffcdd2;">🚨 Low stock ({} units)</span>', 
                obj.stock
            )
        return format_html(
            '<span style="background-color: #e8f5e9; color: #2e7d32; padding: 3px 8px; border-radius: 4px; font-weight: 500;">📦 {} units</span>', 
            obj.stock
        )
    stock_status_badge.short_description = "Inventory Levels"

    @admin.action(description="Bulk restock selected items to 100 units")
    def restock_units_to_hundred(self, request, queryset):
        updated_count = queryset.update(stock=100)
        self.message_user(request, f"Successfully restocked {updated_count} product assets to standard 100 units stock.")


@admin.register(LowStockNotification)
class LowStockNotificationAdmin(admin.ModelAdmin):
    list_display = ('message', 'business', 'is_read_badge', 'created_at')
    list_filter = ('is_read', 'business', 'created_at')
    actions = ['mark_notifications_as_read']

    def is_read_badge(self, obj):
        if obj.is_read:
            return format_html('<span style="color: #757575;">✔️ Read</span>')
        return format_html('<span style="color: #d32f2f; font-weight: bold; animation: pulse 2s infinite;">🔥 Unread</span>')
    is_read_badge.short_description = "Notification Status"

    @admin.action(description="Mark selected warning alerts as read")
    def mark_notifications_as_read(self, request, queryset):
        queryset.update(is_read=True)
        self.message_user(request, "Selected low stock warning alarms marked as read.")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'business', 'transaction_type', 'total_amount_display', 'amount_paid_display', 'debt_balance_display', 'status_badge', 'created_at')
    list_filter = ('status', 'transaction_type', 'business', 'created_at')
    search_fields = ('id', 'customerName', 'customer__name', 'productName')
    inlines = [InvoiceItemInline]
    actions = ['mark_invoices_settled']

    def total_amount_display(self, obj):
        return f"₦{obj.total_amount:,.2f}"
    total_amount_display.short_description = "Grand Total"

    def amount_paid_display(self, obj):
        return f"₦{obj.amount_paid:,.2f}"
    amount_paid_display.short_description = "Amount Settled"

    def debt_balance_display(self, obj):
        return format_html('<strong>₦{:,.2f}</strong>', obj.debt_balance)
    debt_balance_display.short_description = "Remaining Debt"

    def status_badge(self, obj):
        colors = {
            'DRAFT': ('#f5f5f5', '#616161', 'Draft'),
            'PAID': ('#e8f5e9', '#2e7d32', 'Settled & Paid'),
            'OVERDUE': ('#ffebee', '#c62828', 'Outstanding Overdue')
        }
        background, text, label = colors.get(obj.status, ('#ffffff', '#000000', obj.status))
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-family: sans-serif; font-size: 11px; text-transform: uppercase;">{}</span>',
            background, text, label
        )
    status_badge.short_description = "Status badge"

    @admin.action(description="Settle selected invoice outstanding balances in full")
    def mark_invoices_settled(self, request, queryset):
        for invoice in queryset:
            invoice.amount_paid = invoice.total_amount
            invoice.save()
        self.message_user(request, f"Successfully settled outstanding balances in full for {queryset.count()} selected invoices.")


@admin.register(SupplierRecord)
class SupplierRecordAdmin(admin.ModelAdmin):
    list_display = ('supplier_name', 'business', 'phone_number', 'credit_owed_badge', 'timestamp')
    list_filter = ('business', 'timestamp')
    search_fields = ('supplier_name', 'phone_number')

    def credit_owed_badge(self, obj):
        return format_html('<strong>₦{:,.2f}</strong>', obj.outstanding_balance_owed)
    credit_owed_badge.short_description = "Store Credit Owed"


@admin.register(InventoryIntakeLog)
class InventoryIntakeLogAdmin(admin.ModelAdmin):
    list_display = ('product', 'supplier', 'amount_added_badge', 'unit_cost_price_badge', 'date')
    list_filter = ('product__business', 'date')

    def amount_added_badge(self, obj):
        return format_html('🦺 +{} stock units', obj.amount)
    amount_added_badge.short_description = "Restocked Amount"

    def unit_cost_price_badge(self, obj):
        if obj.unit_cost_price:
            return f"₦{obj.unit_cost_price:,.2f}"
        return "-"
    unit_cost_price_badge.short_description = "Cost Per Unit"
