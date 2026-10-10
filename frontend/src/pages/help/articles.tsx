import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../../auth/roles'

export interface HelpArticle {
  slug: string
  title: string
  summary: string
  body: (user: User) => ReactNode
}

export const ARTICLES: HelpArticle[] = [
  {
    slug: 'join-slack',
    title: 'Join the K-Net Slack',
    summary: 'Get into the crew’s Slack workspace with the right email, so your task messages reach you.',
    body: (user) => (
      <>
        <p>
          Slack is where the crew talks day to day: quick questions, last-minute changes and updates. K-Net also posts
          announcements and alerts there, and the K-Net bot sends you a direct message when you’re assigned a task.
        </p>

        <div className="help-article__important" role="note">
          <h2>Use the email you signed up to K-Net with</h2>
          <p>
            Your K-Net email is <strong>{user.email}</strong>. Join Slack with exactly this email. K-Net finds you in
            Slack by your email, so if they don’t match, your task messages won’t reach you.
          </p>
        </div>

        <h2>Steps</h2>
        <ol className="help-article__steps">
          <li>
            {user.slack_invite_url ? (
              <>
                Open the{' '}
                <a href={user.slack_invite_url} target="_blank" rel="noreferrer">
                  K-Net Slack invite link
                </a>
                .
              </>
            ) : (
              'Ask a Director or Site Manager for the K-Net Slack invite link, then open it.'
            )}
          </li>
          <li>
            When Slack asks how you want to join, choose to continue with email and enter <strong>{user.email}</strong>.
            Only use “Continue with Google” or “Continue with Apple” if that account uses this same email.
          </li>
          <li>Slack emails you a code. Enter it to confirm your email.</li>
          <li>Add your name and a profile photo so the crew knows who you are.</li>
          <li>
            Get the Slack app on your phone from the App Store or Google Play, and sign in to the K-Net workspace with
            the same email. Turn on notifications when it asks.
          </li>
          <li>
            Back in K-Net, tap <strong>I’ve joined</strong> on the <Link to="/">Staff Hub</Link>, or mark your “Join the
            K-Net Slack” task done in <Link to="/schedule/tasks">My Tasks</Link>.
          </li>
        </ol>

        <h2>Make sure task messages reach your phone</h2>
        <p>K-Net sends your tasks to Slack as a direct message. To be sure your phone shows them:</p>
        <ul>
          <li>
            <strong>Allow notifications.</strong> If you tapped “Don’t Allow” when Slack first asked, turn them on in
            your phone’s <strong>Settings</strong> → <strong>Slack</strong> → <strong>Notifications</strong> (on
            Android: <strong>Settings</strong> → <strong>Apps</strong> → <strong>Slack</strong> →{' '}
            <strong>Notifications</strong>).
          </li>
          <li>
            <strong>Check Slack’s own settings.</strong> In the Slack app, tap <strong>You</strong> →{' '}
            <strong>Notifications</strong>. Make sure notifications aren’t set to “Nothing”, and that a notification
            schedule or <strong>Pause notifications</strong> isn’t silencing them during your shifts.
          </li>
          <li>
            <strong>Using Slack on a computer too?</strong> Slack shows messages there first and only sends them to
            your phone once you’re away from the computer. That’s normal.
          </li>
          <li>
            <strong>Keep task messages on</strong> in K-Net: the “Message me on Slack when I’m assigned a task” box on
            your <Link to="/account">Account page</Link>.
          </li>
        </ul>
        <p>
          Tasks given to your whole department come to you as a message too, and show up in your{' '}
          <Link to="/schedule/tasks">My Tasks</Link>.
        </p>

        <h2>Already have Slack with a different email?</h2>
        <p>
          That’s fine. Slack lets you use a different email for each workspace. Open the invite link and join with{' '}
          <strong>{user.email}</strong>; the app keeps your other workspaces as they are.
        </p>
        <p>
          If you’ve already joined the K-Net workspace with another email, either change your email in that workspace
          (in Slack: your profile picture → <strong>Profile</strong> → <strong>⋮</strong> →{' '}
          <strong>Account settings</strong>), or ask a Site Manager to link your Slack account to K-Net for you.
        </p>

        <h2>After you’ve joined</h2>
        <ul>
          <li>
            Announcements and alerts from K-Net appear in <strong>#announcements</strong>.
          </li>
          <li>
            Task messages come from the <strong>K-Net</strong> app, under <strong>Apps</strong> in Slack’s sidebar.
          </li>
        </ul>

        <p>
          Stuck? Send us a message from the <Link to="/contact">Contact page</Link>.
        </p>
      </>
    ),
  },
  {
    slug: 'submit-receipt',
    title: 'Submit a receipt from your phone',
    summary: 'Photograph or scan a receipt and send it in for reimbursement, then follow it until it’s paid.',
    body: () => (
      <>
        <p>
          Bought something for the production with your own money? Send the receipt in through K-Net and a Director or
          Assistant will review it and add it to your pay. You can do the whole thing from your phone.
        </p>

        <h2>1. Get a clear picture of the receipt</h2>
        <p>You can take a photo or make a scan. A scan is easiest to read, but a good photo works too.</p>
        <ul>
          <li>Lay the receipt flat on a dark, plain surface, in good light, with no shadow from your phone.</li>
          <li>Fit the whole receipt in the frame, top to bottom. Long receipts can be folded in half or scanned in two.</li>
          <li>Make sure the store name, date and total are sharp and readable before you send it.</li>
        </ul>
        <p>
          <strong>Scanning on iPhone:</strong> open the <strong>Notes</strong> app, start a new note, tap the camera
          icon and choose <strong>Scan Documents</strong>. Hold the phone over the receipt; it snaps the scan
          automatically. Tap <strong>Save</strong>, then share it as a PDF or save it to Files.
        </p>
        <p>
          <strong>Scanning on Android:</strong> open <strong>Google Drive</strong>, tap <strong>+</strong> and choose{' '}
          <strong>Scan</strong>. Line up the receipt, take the picture, crop if needed and save it as a PDF.
        </p>
        <p>Or skip this step and take the photo straight from K-Net in step 2.</p>

        <h2>2. Upload it to K-Net</h2>
        <ol className="help-article__steps">
          <li>
            Go to <Link to="/documents">Operations → Documents</Link> and tap <strong>+ Submit receipt</strong>.
          </li>
          <li>
            Tap the <strong>File</strong> box. Your phone offers to <strong>Take Photo</strong> (or{' '}
            <strong>Camera</strong>), pick from your <strong>Photo Library</strong>, or choose a file, such as the scan
            you just saved.
          </li>
          <li>
            Give it a <strong>Name</strong> that says what it was for, like “Gaff tape for Stage B”.
          </li>
          <li>
            Enter the <strong>Amount</strong>: the receipt’s total, including tax. Add the date of purchase and the store
            if you can.
          </li>
          <li>
            Use <strong>Notes</strong> for anything that helps, like who asked you to buy it or which scene it was for.
          </li>
          <li>
            Tap <strong>Submit receipt</strong>.
          </li>
        </ol>
        <p>
          Send one receipt per upload. Photos, scans and PDFs up to 20 MB are accepted, including iPhone (HEIC) photos.
        </p>

        <h2>3. Follow it until it’s paid</h2>
        <p>
          Your receipts are listed under <strong>My Receipts</strong> on the <Link to="/documents">Documents</Link>{' '}
          page, each with its progress:
        </p>
        <ul>
          <li>
            <strong>Submitted</strong>: sent, waiting to be looked at.
          </li>
          <li>
            <strong>Viewed</strong>: a Director or Assistant has opened it.
          </li>
          <li>
            <strong>In process</strong>: approved and being added to your pay.
          </li>
          <li>
            <strong>Processed</strong>: done, and attached to a paycheck.
          </li>
        </ul>
        <p>
          Made a mistake? You can edit or withdraw a receipt from My Receipts until it’s been viewed. After that, ask
          your Director or Assistant to fix it. Keep the paper receipt until it shows Processed, in case anyone needs
          to see the original.
        </p>

        <p>
          Questions about a reimbursement? Ask your Director or Assistant, or send us a message from the{' '}
          <Link to="/contact">Contact page</Link>.
        </p>
      </>
    ),
  },
]
