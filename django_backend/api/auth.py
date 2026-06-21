from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import MerchantSession

class MerchantSessionAuthentication(BaseAuthentication):
    """
    Custom authentication class that validates standard 'x-session-id' header or
    'Bearer <session_id>' inside authorization headers of API requests.
    Enables Django Rest Framework's IsAuthenticated permission class to function
    seamlessly with our UUID/custom-session-based client state.
    """
    def authenticate(self, request):
        session_id = request.headers.get('x-session-id')
        if not session_id:
            session_id = request.META.get('HTTP_X_SESSION_ID')
        if not session_id:
            auth_header = request.headers.get('authorization') or request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION')
            if auth_header and auth_header.lower().startswith('bearer '):
                parts = auth_header.split()
                if len(parts) > 1:
                    session_id = parts[1]

        if not session_id:
            return None

        try:
            session = MerchantSession.objects.get(session_id=session_id)
            if session.is_suspicious_locked:
                raise AuthenticationFailed("Suspicious activity detected. Session locked. Re-authenticate via OTP.")
            return (session.user, None)
        except MerchantSession.DoesNotExist:
            return None
