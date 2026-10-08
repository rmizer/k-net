from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone


def send_support_email(request_obj):
    """Emails a Contact page message to the support address. Replying to the
    email goes straight to the person who sent it."""
    user = request_obj.user
    sender = f"{user.get_full_name()} <{user.email}>" if user else "Unknown user"
    lines = [
        f"{request_obj.get_kind_display()} #{request_obj.pk}",
        "",
        f"From: {sender}",
    ]
    if user:
        lines.append(f"Role: {user.get_role_display()}" + (f" · {user.department.name}" if user.department else ""))
        if user.phone:
            lines.append(f"Phone: {user.phone}")
    lines.append(f"Sent: {timezone.localtime(request_obj.created_at):%a %b %d, %Y %I:%M %p %Z}")
    lines += ["", f"Subject: {request_obj.subject}", "", request_obj.message.strip()]
    if request_obj.page:
        lines += ["", f"Where it happened: {request_obj.page}"]
    if request_obj.expected.strip():
        lines += ["", "What they expected:", request_obj.expected.strip()]
    if request_obj.user_agent:
        lines += ["", f"Browser: {request_obj.user_agent}"]

    EmailMessage(
        subject=f"[K-Net {request_obj.get_kind_display()}] {request_obj.subject}",
        body="\n".join(lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.SUPPORT_EMAIL],
        reply_to=[user.email] if user else None,
    ).send()
