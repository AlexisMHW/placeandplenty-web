import { notFound } from "next/navigation";
import GuestPageClient from "@/app/(guest)/invite/[token]/GuestPageClient";
import GuestLivingPanel from "@/components/guest/GuestLivingPanel";
import type { GuestPageData } from "@/lib/guest-api";
import type { GuestLivingData } from "@/lib/guest-living-api";

export const metadata = { title: "Guest Multi-Day QA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const guestData: GuestPageData = {
  partyName: "The Williams Family",
  plusOneAllowed: true,
  plusOneLimit: 1,
  contactEmail: { has: true, masked: "a•••••@example.com" },
  rsvpDeadline: "2026-11-10",
  invitationMode: "p_and_p",
  invitationStyle: "botanical_sage",
  invitationArtwork: null,
  displayName: "A Cozy Friendsgiving Weekend",
  hostDisplayName: "Maya",
  displayDate: "2026-11-27",
  displayEndDate: "2026-11-29",
  displayTime: "17:30:00",
  displayLocation: "Maya’s House · Nashville, Tennessee",
  displayDescription:
    "Come hungry, come comfortable, and plan to stay awhile. We’re making a whole weekend of good food, old stories, and the people we never get enough time with.",
  showGiftsRegistry: true,
  registryLinks: [
    { id: "r1", label: "Housewarming favorites", url: "https://example.com", note: "Only if you feel like it — your company is enough." },
  ],
  showPotluck: true,
  showSongRequest: true,
  showPhotoContributions: true,
  showSchedule: true,
  schedule: [
    {
      id: "d1",
      date: "2026-11-27",
      title: "Settle In",
      notes: "No rush. Get here when you can, put your bag down, and make yourself at home.",
      activities: [
        {
          id: "a1",
          title: "Welcome Drinks & Porch Snacks",
          description: "We’ll start easy with warm cider, something bubbly, and snacks on the back porch if the weather cooperates.",
          startTime: "17:30:00",
          endTime: "19:00:00",
          locationName: "Back Porch",
          locationAddress: "Maya’s House",
          attireNotes: "Cozy layers. The porch may be cool after sunset.",
          transportationNotes: "Street parking is easiest on the east side of the block.",
          reservationNotes: null,
          vendorName: null,
          vendorContact: null,
          capacity: null,
          seatsRemaining: null,
          isSelectable: false,
          selectionGroup: null,
          responses: [
            { gatheringGuestId: "g1", rsvpStatus: "yes", selected: false, notes: null, respondedAt: "2026-10-01T10:00:00Z" },
            { gatheringGuestId: "g2", rsvpStatus: "maybe", selected: false, notes: null, respondedAt: "2026-10-02T10:00:00Z" },
          ],
        },
      ],
    },
    {
      id: "d2",
      date: "2026-11-28",
      title: "The Big Day",
      notes: "Breakfast is casual. Dinner is the main event.",
      activities: [
        {
          id: "a2",
          title: "Morning Coffee Run",
          description: "Pick one of the two morning options. Both get us back in time to start cooking.",
          startTime: "09:30:00",
          endTime: "10:30:00",
          locationName: "Meet in the foyer",
          locationAddress: null,
          attireNotes: "Whatever you woke up in is fine.",
          transportationNotes: "We’ll carpool.",
          reservationNotes: null,
          vendorName: null,
          vendorContact: null,
          capacity: 4,
          seatsRemaining: 2,
          isSelectable: true,
          selectionGroup: "Saturday morning",
          responses: [
            { gatheringGuestId: "g1", rsvpStatus: "yes", selected: true, notes: null, respondedAt: "2026-10-05T10:00:00Z" },
            { gatheringGuestId: "g2", rsvpStatus: "no_response", selected: false, notes: null, respondedAt: null },
          ],
        },
        {
          id: "a3",
          title: "Slow Morning at Home",
          description: "Stay in, keep the coffee flowing, and help with prep if you feel like it.",
          startTime: "09:30:00",
          endTime: "11:00:00",
          locationName: "Kitchen & Living Room",
          locationAddress: null,
          attireNotes: null,
          transportationNotes: null,
          reservationNotes: null,
          vendorName: null,
          vendorContact: null,
          capacity: 6,
          seatsRemaining: 6,
          isSelectable: true,
          selectionGroup: "Saturday morning",
          responses: [
            { gatheringGuestId: "g1", rsvpStatus: "no_response", selected: false, notes: null, respondedAt: null },
            { gatheringGuestId: "g2", rsvpStatus: "no_response", selected: false, notes: null, respondedAt: null },
          ],
        },
        {
          id: "a4",
          title: "Friendsgiving Dinner",
          description: "The table is set for 6:00, but we all know somebody will still be finishing a dish at 6:15.",
          startTime: "18:00:00",
          endTime: "21:00:00",
          locationName: "Dining Room",
          locationAddress: "Maya’s House",
          attireNotes: "Dinner nice, but still comfortable.",
          transportationNotes: null,
          reservationNotes: "Please be in the house by 5:45 so we can sit down together.",
          vendorName: "Nashville Linen Co.",
          vendorContact: "Rental pickup handled by host",
          capacity: 12,
          seatsRemaining: 3,
          isSelectable: false,
          selectionGroup: null,
          responses: [
            { gatheringGuestId: "g1", rsvpStatus: "yes", selected: false, notes: null, respondedAt: "2026-10-05T10:00:00Z" },
            { gatheringGuestId: "g2", rsvpStatus: "yes", selected: false, notes: null, respondedAt: "2026-10-05T10:00:00Z" },
          ],
        },
      ],
    },
    {
      id: "d3",
      date: "2026-11-29",
      title: "One More Cup",
      notes: "Sleep in. We’ll wrap up slowly and send everybody home with leftovers.",
      activities: [
        {
          id: "a5",
          title: "Leftovers Brunch",
          description: "The official clean-out-the-fridge brunch.",
          startTime: "10:30:00",
          endTime: "12:30:00",
          locationName: "Kitchen",
          locationAddress: null,
          attireNotes: "Pajamas encouraged.",
          transportationNotes: null,
          reservationNotes: null,
          vendorName: null,
          vendorContact: null,
          capacity: 6,
          seatsRemaining: 0,
          isSelectable: false,
          selectionGroup: null,
          responses: [
            { gatheringGuestId: "g1", rsvpStatus: "yes", selected: false, notes: null, respondedAt: "2026-10-05T10:00:00Z" },
            { gatheringGuestId: "g2", rsvpStatus: "no", selected: false, notes: null, respondedAt: "2026-10-05T10:00:00Z" },
          ],
        },
      ],
    },
  ],
  contributions: [
    { id: "c1", itemName: "Sparkling water", category: "drinks", quantity: 2, unit: "cases", status: "needed", claimedByThisParty: false, notes: null },
    { id: "c2", itemName: "Dinner rolls", category: "food", quantity: 2, unit: "dozen", status: "claimed", claimedByThisParty: true, notes: null },
  ],
  assignedContributions: [
    {
      id: "ac1",
      itemName: "Chess pie",
      category: "dessert",
      quantity: 1,
      unit: null,
      status: "asked",
      assignedToName: "Alexis",
      assignedToGuestId: "g1",
      hostNote: "The one you made last year if you’re up for it.",
      fromMenu: true,
      fromShoppingList: false,
      messages: [],
    },
  ],
  gatheringStatus: "active",
  isArchived: false,
  archivedMessage: null,
  cancellationMessage: null,
  partyMembers: [
    { gatheringGuestId: "g1", guestId: "p1", firstName: "Alexis", lastName: "Williams", rsvpStatus: "yes", dietaryNotes: null, allergyNotes: "Pecans", accessibilityNotes: null },
    { gatheringGuestId: "g2", guestId: "p2", firstName: "Robert", lastName: "Williams", rsvpStatus: "maybe", dietaryNotes: null, allergyNotes: null, accessibilityNotes: null },
  ],
};

const livingData: GuestLivingData = {
  isArchived: false,
  attire: "Dinner is a little dressed up, but the rest of the weekend is cozy.",
  arrivalParking: "Use the driveway if there’s room, then the east side of the street. Please leave the mailbox clear.",
  transportation: "We’ll carpool for Saturday morning plans.",
  whatToBring: "Your overnight things, a warm layer, and room for leftovers.",
  importantDetails: "Quiet hours after 11 PM because the baby will be asleep upstairs.",
  updates: [
    {
      id: "u1",
      category: "parking_arrival",
      title: "Small parking change",
      body: "The neighbor’s driveway will be blocked for construction, so please use the east side of the street instead.",
      importance: "important",
      requireAcknowledgement: true,
      acknowledgedAt: null,
      seenAt: null,
      publishedAt: "2026-11-25T18:00:00Z",
    },
  ],
};

export default function GuestMultiDayQaPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <>
      <GuestPageClient token="preview-visual-qa" initialData={guestData} />
      <GuestLivingPanel
        token="preview-visual-qa"
        gatheringName={guestData.displayName}
        initialData={livingData}
      />
    </>
  );
}
