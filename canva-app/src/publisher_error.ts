// Only these localized errors are safe to display to the host.
export class PublisherError extends Error {}

// Signals that previously selected account data must no longer authorize publishing.
export class PublisherAuthenticationError extends PublisherError {}
