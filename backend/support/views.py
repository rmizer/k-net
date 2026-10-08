import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .emails import send_support_email
from .serializers import SupportRequestSerializer

logger = logging.getLogger(__name__)


class SupportRequestView(APIView):
    """The Contact page: bug reports, feature requests, tech support questions
    and feedback from any signed-in user, emailed to the support address."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "support"

    def post(self, request):
        serializer = SupportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        support_request = serializer.save(
            user=request.user, user_agent=request.headers.get("User-Agent", "")[:500]
        )
        try:
            send_support_email(support_request)
        except Exception:
            # It's saved, so a Site Manager can still find it in the admin.
            logger.exception("Couldn't email support request #%s", support_request.pk)
        else:
            support_request.emailed = True
            support_request.save(update_fields=["emailed"])
        return Response(SupportRequestSerializer(support_request).data, status=status.HTTP_201_CREATED)
