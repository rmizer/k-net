from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from notifications import slack


class Command(BaseCommand):
    help = "Checks the Slack connection, and optionally sends test messages."

    def add_arguments(self, parser):
        parser.add_argument(
            "--post", action="store_true", help="Post a test message to the announcements and alerts channels."
        )
        parser.add_argument("--email", help="Look up this person's Slack account and send them a test message.")

    def handle(self, *args, **options):
        if not slack.is_enabled():
            raise CommandError("SLACK_BOT_TOKEN isn't set, so Slack notifications are off.")
        try:
            info = slack.call("auth.test", {})
            self.stdout.write(f"Connected to {info['team']} as @{info['user']}.")

            channels = {settings.SLACK_ANNOUNCEMENTS_CHANNEL, settings.SLACK_ALERTS_CHANNEL} - {""}
            if not channels:
                self.stdout.write(self.style.WARNING("No channels set; only direct messages will be sent."))
            if options["post"]:
                for channel in sorted(channels):
                    slack.post_message(channel, ":wave: K-Net is connected to this channel.")
                    self.stdout.write(f"Posted a test message to {channel}.")

            if options["email"]:
                user_id = slack.lookup_user_id(options["email"])
                if not user_id:
                    raise CommandError(f"Nobody in the Slack workspace uses {options['email']}.")
                slack.post_message(user_id, ":wave: K-Net can send you direct messages.")
                self.stdout.write(f"Sent a test direct message to {options['email']} ({user_id}).")
        except slack.SlackError as err:
            raise CommandError(f"Slack said: {err}") from err
        self.stdout.write(self.style.SUCCESS("Slack is set up."))
