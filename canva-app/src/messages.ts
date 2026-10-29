import { defineMessages } from "react-intl";
export const messages = defineMessages({
  previewFailed: {
    id: "publisher.previewFailed",
    defaultMessage: "Preview unavailable. Return to your design and try again.",
    description: "Preview error when Canva cannot prepare the selected image.",
  },
  disconnect: {
    id: "publisher.disconnect",
    defaultMessage: "Disconnect account",
    description:
      "Button revoking the current Place & Plenty connection in Canva.",
  },
  disconnectFailed: {
    id: "publisher.disconnectFailed",
    defaultMessage: "Disconnect was not confirmed. Please try again.",
    description:
      "The disconnect request failed; publishing selection has been cleared.",
  },
  headline: {
    id: "publisher.headline",
    defaultMessage: "Design in Canva. Gather with Place & Plenty.",
    description:
      "Heading introducing the invitation publisher. Place & Plenty is the product name.",
  },
  intro: {
    id: "publisher.intro",
    defaultMessage:
      "Less scrambling. More gathering. Coordinate guests, menus, shopping, and who’s bringing what.",
    description:
      "Description of the home-hosting platform in publisher settings.",
  },
  connect: {
    id: "publisher.connect",
    defaultMessage: "Connect account",
    description:
      "Button to start connecting a Place & Plenty account; signup is offered on the website.",
  },
  reconnect: {
    id: "publisher.reconnect",
    defaultMessage: "Reconnect account",
    description: "Button to authorize a Place & Plenty account again.",
  },
  chooseGathering: {
    id: "publisher.chooseGathering",
    defaultMessage: "Choose a gathering",
    description: "Label for the authorized gathering selection field.",
  },
  selectGathering: {
    id: "publisher.selectGathering",
    defaultMessage: "Select a gathering",
    description: "Placeholder before the host selects an authorized gathering.",
  },
  refreshGatherings: {
    id: "publisher.refreshGatherings",
    defaultMessage: "Refresh gatherings",
    description:
      "Button to reload gatherings after creating or editing one in the external platform.",
  },
  manageGathering: {
    id: "publisher.manageGathering",
    defaultMessage: "Create a gathering",
    description:
      "Button that opens the external Place & Plenty gathering workflow.",
  },
  planNotice: {
    id: "publisher.planNotice",
    defaultMessage:
      "Single-day and multi-day planning use your existing Place & Plenty account and plan. After creating a gathering, return here and refresh.",
    description:
      "Settings explanation; importing artwork does not change subscription access.",
  },
  optIn: {
    id: "publisher.optIn",
    defaultMessage: "Yes, use this design as my digital invitation",
    description:
      "Unchecked consent checkbox that enables invitation artwork publishing.",
  },
  replaceNotice: {
    id: "publisher.replaceNotice",
    defaultMessage:
      "Review the preview, then choose Publish to save the artwork. Your existing invitation will be replaced.",
    description: "Warning before replacing the gathering invitation artwork.",
  },
  notNow: {
    id: "publisher.notNow",
    defaultMessage: "Not now",
    description:
      "Button to open external planning without publishing invitation artwork.",
  },
  connectRequired: {
    id: "publisher.connectRequired",
    defaultMessage: "Connect your Place & Plenty account",
    description: "Error when the publisher has no account token.",
  },
  reconnectRequired: {
    id: "publisher.reconnectRequired",
    defaultMessage: "Reconnect your Place & Plenty account",
    description:
      "Error when the backend rejects an expired or invalid account token.",
  },
  connectionUnavailable: {
    id: "publisher.connectionUnavailable",
    defaultMessage: "Connection unavailable. Try again from Canva.",
    description: "Error when account authorization cannot be completed.",
  },
  connectionCanceled: {
    id: "publisher.connectionCanceled",
    defaultMessage: "Connection canceled. You can try again.",
    description: "Notice after the host cancels OAuth authorization.",
  },
  requestFailed: {
    id: "publisher.requestFailed",
    defaultMessage:
      "The request could not be completed. Check your gathering and try again.",
    description: "Error after a rejected gathering list or artwork request.",
  },
  connectionInterrupted: {
    id: "publisher.connectionInterrupted",
    defaultMessage:
      "Connection interrupted. Check your gathering before retrying.",
    description:
      "Network error; the server may have saved artwork before the response was lost. No automatic retry occurs.",
  },
  previewTitle: {
    id: "publisher.previewTitle",
    defaultMessage: "Digital invitation preview",
    description: "Heading above the exported Canva invitation preview.",
  },
  previewReplace: {
    id: "publisher.previewReplace",
    defaultMessage:
      "Publishing replaces the selected gathering’s invitation artwork.",
    description: "Preview warning about replacing the current artwork.",
  },
  previewSelect: {
    id: "publisher.previewSelect",
    defaultMessage: "Select a gathering and choose to use your design.",
    description:
      "Preview prompt shown until a gathering and invitation consent are selected.",
  },
  previewAlt: {
    id: "publisher.previewAlt",
    defaultMessage: "Your invitation artwork",
    description:
      "Accessible alternative text for the Canva invitation preview image.",
  },
  previewPreparing: {
    id: "publisher.previewPreparing",
    defaultMessage: "Preparing invitation preview…",
    description: "Status while Canva prepares the preview image.",
  },
  invitation: {
    id: "publisher.output.invitation",
    defaultMessage: "Digital invitation",
    description: "Publishing output format label.",
  },
  artwork: {
    id: "publisher.slot.artwork",
    defaultMessage: "Invitation artwork",
    description: "Publishing media slot label; a single PNG image.",
  },
  invalidSettings: {
    id: "publisher.invalidSettings",
    defaultMessage: "Select a gathering and opt in to invitation artwork",
    description: "Publishing error when required settings are missing.",
  },
  onePng: {
    id: "publisher.onePng",
    defaultMessage: "Choose one PNG invitation",
    description:
      "Publishing error when multiple images or the wrong file type are supplied.",
  },
  invalidExport: {
    id: "publisher.invalidExport",
    defaultMessage: "Invalid export URL",
    description: "Publishing error when the Canva export URL is not HTTPS.",
  },
  exportFailed: {
    id: "publisher.exportFailed",
    defaultMessage: "Could not read Canva export",
    description:
      "Publishing error when the exported design cannot be downloaded.",
  },
  emptyExport: {
    id: "publisher.emptyExport",
    defaultMessage: "Empty export",
    description:
      "Publishing error when the exported design has no readable body.",
  },
  exportTooLarge: {
    id: "publisher.exportTooLarge",
    defaultMessage: "Invitation exceeds 10 MB",
    description:
      "Publishing error when exported artwork exceeds the upload limit.",
  },
  saveUnconfirmed: {
    id: "publisher.saveUnconfirmed",
    defaultMessage: "Artwork was not confirmed",
    description:
      "Publishing error when the backend did not confirm the expected gathering save.",
  },
  rateLimited: {
    id: "publisher.rateLimited",
    defaultMessage:
      "Too many attempts. Please wait a few minutes before trying again.",
    description: "The account exceeded its temporary request rate limit.",
  },
  publishPending: {
    id: "publisher.publishPending",
    defaultMessage:
      "Check your gathering before trying again. If you changed the artwork, select the gathering and confirm the invitation again.",
    description:
      "A duplicate publish is in progress, or the request ID belongs to different artwork.",
  },
  publishFailed: {
    id: "publisher.publishFailed",
    defaultMessage: "Invitation could not be published",
    description: "Fallback publishing error for unexpected failures.",
  },
});
