from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BusinessProfileViewSet, CustomerViewSet, ProductViewSet,
    InvoiceViewSet, SupplierRecordViewSet, InventoryIntakeLogViewSet,
    LowStockNotificationViewSet, SmartInputProcessorAPIView,
    DashboardMetricsAPIView,
    ProbeAuthView, VerifyOtpView, RegisterOnboardingView,
    SetPinView, PinLoginView, ResetForgottenPinView,
    ValidateSessionView, VerifySuspiciousOtpView, LogoutView,
    UnlockAllView, AdminMigrateView, BusinessSettingsView, BackupSaveView,

    BackupListView, BackupDownloadView, BackupDeleteView,
    GuestInvoiceGenerateView, TerminalPinVerifyView,
    StaffListView, StaffLogView,
    ProcessPaymentView, VerifyPaymentView, WhatsAppWebhookView
)

router = DefaultRouter()
router.register(r'business-profiles', BusinessProfileViewSet, basename='business-profile')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'suppliers', SupplierRecordViewSet, basename='supplier')
router.register(r'inventory-intakes', InventoryIntakeLogViewSet, basename='inventory-intake')
router.register(r'notifications', LowStockNotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
    
    # Smart inputs & analytics
    path('smart-input', SmartInputProcessorAPIView.as_view(), name='smart-input'),
    path('smart-input/', SmartInputProcessorAPIView.as_view(), name='smart-input-slash'),
    path('dashboard-metrics/', DashboardMetricsAPIView.as_view(), name='dashboard-metrics'),
    path('dashboard-metrics', DashboardMetricsAPIView.as_view(), name='dashboard-metrics-no-slash'),
    
    # Auth endpoints
    path('auth/probe', ProbeAuthView.as_view(), name='auth-probe'),
    path('auth/probe/', ProbeAuthView.as_view()),
    path('auth/verify-otp', VerifyOtpView.as_view(), name='auth-verify-otp'),
    path('auth/verify-otp/', VerifyOtpView.as_view()),
    path('auth/register-onboarding', RegisterOnboardingView.as_view(), name='auth-register-onboarding'),
    path('auth/register-onboarding/', RegisterOnboardingView.as_view()),
    path('auth/set-pin', SetPinView.as_view(), name='auth-set-pin'),
    path('auth/set-pin/', SetPinView.as_view()),
    path('auth/pin-login', PinLoginView.as_view(), name='auth-pin-login'),
    path('auth/pin-login/', PinLoginView.as_view()),
    path('auth/reset-forgotten-pin', ResetForgottenPinView.as_view(), name='auth-reset-forgotten-pin'),
    path('auth/reset-forgotten-pin/', ResetForgottenPinView.as_view()),
    path('auth/validate-session', ValidateSessionView.as_view(), name='auth-validate-session'),
    path('auth/validate-session/', ValidateSessionView.as_view()),
    path('auth/verify-suspicious-otp', VerifySuspiciousOtpView.as_view(), name='auth-verify-suspicious-otp'),
    path('auth/verify-suspicious-otp/', VerifySuspiciousOtpView.as_view()),
    path('auth/logout', LogoutView.as_view(), name='auth-logout'),
    path('auth/logout/', LogoutView.as_view()),
    
    # Admin unlock all
    path('admin/unlock-all', UnlockAllView.as_view(), name='admin-unlock-all'),
    path('admin/unlock-all/', UnlockAllView.as_view()),
    path('admin/migrate', AdminMigrateView.as_view(), name='admin-migrate'),
    path('admin/migrate/', AdminMigrateView.as_view()),
    
    # Settings & preferences
    path('business/settings', BusinessSettingsView.as_view(), name='business-settings'),
    path('business/settings/', BusinessSettingsView.as_view()),
    
    # Backups
    path('backup/save', BackupSaveView.as_view(), name='backup-save'),
    path('backup/save/', BackupSaveView.as_view()),
    path('backup/list', BackupListView.as_view(), name='backup-list'),
    path('backup/list/', BackupListView.as_view()),
    path('backup/download/<str:filename>', BackupDownloadView.as_view(), name='backup-download'),
    path('backup/<str:filename>', BackupDeleteView.as_view(), name='backup-delete'),
    
    # Guest invoice check
    path('guest/invoice-generate', GuestInvoiceGenerateView.as_view(), name='guest-invoice-generate'),
    path('guest/invoice-generate/', GuestInvoiceGenerateView.as_view()),
    
    # Terminals & Staff
    path('terminal/<str:shop_slug>/<str:worker_slug>/pin-verify', TerminalPinVerifyView.as_view(), name='terminal-pin-verify'),
    path('staff', StaffListView.as_view(), name='staff-list'),
    path('staff/', StaffListView.as_view()),
    path('staff/log', StaffLogView.as_view(), name='staff-log'),
    path('staff/log/', StaffLogView.as_view()),
    
    # WhatsApp Webhook
    path('auth/whatsapp-webhook', WhatsAppWebhookView.as_view(), name='auth-whatsapp-webhook'),
    path('auth/whatsapp-webhook/', WhatsAppWebhookView.as_view()),
    
    # Payments
    path('payment/initialize', ProcessPaymentView.as_view(), name='payment-initialize'),
    path('payment/initialize/', ProcessPaymentView.as_view()),
    path('payment/verify', VerifyPaymentView.as_view(), name='payment-verify'),
    path('payment/verify/', VerifyPaymentView.as_view()),
]
