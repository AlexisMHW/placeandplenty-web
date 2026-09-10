/** Editorial comparisons, reviewed against the linked first-party pages on 2026-09-10. */
export const COMPARISONS = [
  {
    slug: "evite", name: "Evite", title: "Place & Plenty vs. Evite: Invitations & Hosting",
    description: "Compare Place & Plenty and Evite for invitations, RSVPs, shared dishes and getting ready to host. Find the right fit for your next gathering.",
    intro: "Looking for an Evite alternative because the invitation is only one part of your to-do list? Start with the work you want help carrying: inviting everyone, or preparing the whole gathering.",
    strength: "Evite offers invitation designs, RSVP tracking, guest messaging and reminders. Its SignUp Sheets also help organize contributions and volunteer tasks.",
    fit: "Consider Evite when your priority is sending an invitation, tracking responses and coordinating what guests bring.",
    scenario: "For a game-day potluck, a contribution list helps you see who is bringing the dip. P&P gives you a place to plan the rest of the menu, organize your shopping and prepare your home around that same gathering.",
    source: "https://www.evite.com/", sourceLabel: "Evite’s invitations and hosting tools",
    rows: [
      { topic: "Invitation & RSVP", other: "Digital invitations, RSVP tracking and guest messages.", pp: "Invitations and RSVPs alongside the gathering’s menu, shopping list and timeline." },
      { topic: "Shared dishes", other: "SignUp Sheets for food contributions and other tasks.", pp: "Who’s Bringing What keeps contributions within your gathering plan; paid access applies." },
      { topic: "Where to begin", other: "Choose an invitation or create a shareable event page.", pp: "Start with your gathering, then work through your people, food and preparation." },
    ],
    faqs: [
      { q: "Does Evite help with potlucks?", a: "Yes. Evite describes SignUp Sheets for organizing what guests bring. P&P’s contribution tools sit within a broader home-hosting plan." },
      { q: "Is Place & Plenty an Evite alternative?", a: "Yes, if you want invitations and RSVPs as part of a connected home-hosting workflow. Compare the invitation experience you want with the menu, shopping and preparation help you need." },
    ],
  },
  {
    slug: "paperless-post", name: "Paperless Post", title: "Place & Plenty vs. Paperless Post: Hosting & Invites",
    description: "Compare Place & Plenty and Paperless Post for invitation design, guest management and home-hosting preparation. Choose the right fit for your gathering.",
    intro: "Considering a Paperless Post alternative? A beautiful invitation sets the tone. Your choice also depends on how you want to manage the food, shopping and getting-ready work behind it.",
    strength: "Paperless Post offers customizable Cards and Flyer event pages, RSVP tracking and guest messaging. Its guest questions, co-host tools and event-detail Blocks support invitation and guest management.",
    fit: "Consider Paperless Post when invitation design and guest communication are the center of your planning needs.",
    scenario: "For a birthday dinner, the invitation can introduce the evening beautifully. In P&P, you can also plan your dishes in My Table, organize the shopping and keep a preparation timeline for the home welcoming those guests.",
    source: "https://www.paperlesspost.com/", sourceLabel: "Paperless Post’s invitation and event features",
    rows: [
      { topic: "Invitation & RSVP", other: "Customizable Cards and Flyer event pages with RSVP tracking.", pp: "Invitations and RSVPs inside the same gathering as your menu, shopping and preparation." },
      { topic: "Guest details", other: "Guest questions, messaging and event-detail Blocks.", pp: "My People holds the gathering’s guest list; My Guest Book keeps reusable contacts." },
      { topic: "Planning together", other: "Co-host tools for managing guests and communication.", pp: "My Co-Hosts supports collaboration within the gathering; access follows the gathering’s permissions." },
    ],
    faqs: [
      { q: "Does Paperless Post offer more than invitation design?", a: "Yes. Its published features include guest questions, RSVP tracking, messaging, co-hosts and event-detail Blocks." },
      { q: "Why consider Place & Plenty as a Paperless Post alternative?", a: "Consider P&P when your priority includes the host’s preparation: menu, shopping, what you already own and the work leading up to guests arriving, alongside invitations and RSVPs." },
    ],
  },
] as const;
