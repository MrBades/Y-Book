from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    BusinessProfile, Customer, Product, LowStockNotification,
    Invoice, InvoiceItem, SupplierRecord, InventoryIntakeLog
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class BusinessProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessProfile
        fields = '__all__'


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['id', 'name', 'quantity', 'price', 'cost_price', 'total']


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = [
            'id', 'customer', 'customerName', 'productName', 'items',
            'total_amount', 'amount_paid', 'debt_balance', 'transaction_type', 
            'status', 'created_at'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        invoice = Invoice.objects.create(**validated_data)
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        # Recount and keep customer ledger balance state correct
        invoice.customer.recalculate_debt()
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        # Update existing items if provided
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            # Simple policy: overwrite items inside nested update
            instance.items.all().delete()
            for item_data in items_data:
                InvoiceItem.objects.create(invoice=instance, **item_data)
        
        # Trigger customer update
        instance.customer.recalculate_debt()
        return instance


class CustomerSerializer(serializers.ModelSerializer):
    invoices = InvoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'active_debt_balance', 'created_date', 'invoices']


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'sku', 'stock', 'price', 'cost_price', 'min_quantity_count']


class SupplierRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierRecord
        fields = '__all__'


class InventoryIntakeLogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.supplier_name', read_only=True)

    class Meta:
        model = InventoryIntakeLog
        fields = ['id', 'product', 'product_name', 'supplier', 'supplier_name', 'amount', 'unit_cost_price', 'date']


class LowStockNotificationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = LowStockNotification
        fields = ['id', 'product', 'product_name', 'message', 'is_read', 'created_at']
