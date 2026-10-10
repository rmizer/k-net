/** A slim strip under the date inviting people into the K-Net Slack workspace. */
export function SlackLink({ url }: { url: string }) {
  return (
    <div className="dash-slack">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path
          strokeLinejoin="round"
          d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"
        />
        <path strokeLinecap="round" d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
      </svg>
      <p>
        <strong>Join the K-Net Slack.</strong> Talk with the crew, ask questions and get updates.
      </p>
      <a href={url} target="_blank" rel="noreferrer" className="button button--secondary dash-slack__button">
        Join Slack
      </a>
    </div>
  )
}
