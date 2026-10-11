from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Tokens for the link in the sign-up email, valid for PASSWORD_RESET_TIMEOUT
    (three days). Including the verified flag makes each link single-use."""

    key_salt = "accounts.tokens.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{super()._make_hash_value(user, timestamp)}{user.email_verified}"


email_verification_token = EmailVerificationTokenGenerator()


class EmailChangeTokenGenerator(PasswordResetTokenGenerator):
    """Tokens for the link sent to a new email address. Including both addresses
    makes each link single-use and cancels it if a different address is requested."""

    key_salt = "accounts.tokens.EmailChangeTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{super()._make_hash_value(user, timestamp)}{user.email}{user.pending_email}"


email_change_token = EmailChangeTokenGenerator()
