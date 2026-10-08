from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .tokens import email_verification_token


def verification_link(user):
    query = urlencode(
        {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": email_verification_token.make_token(user),
        }
    )
    return f"{settings.SITE_URL.rstrip('/')}/verify-email?{query}"


def send_verification_email(user):
    link = verification_link(user)
    send_mail(
        subject="Verify your email for K-Net",
        message=(
            f"Hi {user.first_name},\n\n"
            "Thanks for signing up for K-Net. Open this link to verify your email and finish "
            f"setting up your account:\n\n{link}\n\n"
            "The link works for 3 days. If you didn't sign up for K-Net, you can ignore this email.\n\n"
            f"K-Net Support\n{settings.SUPPORT_EMAIL}"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
