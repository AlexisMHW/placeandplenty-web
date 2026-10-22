# Canva Content Publisher implementation notes

Source: https://www.canva.dev/docs/apps/intents/content-publisher/implementation-guide/

Canva's Content Publisher intent requires:
- `prepareContentPublisher` registration once when the app loads
- `getPublishConfiguration` defining output types
- `renderSettingsUi` with Canva App UI Kit
- `renderPreviewUi` with Canva App UI Kit
- `publishContent` sending actual exported media to the authorized Place & Plenty backend
- Design Read permission and platform authentication

The user can choose single-day or multi-day gathering coordination. A selected gathering must be validated against the signed-in host's permissions and entitlements.

**No-design path:** 'Not now' is a planning handoff, not a publish action. Never call Canva's publishing API or return a fabricated 'completed' publishing result for this choice.

**Design path:** A design is published only after explicit opt-in, host authentication, authorized gathering selection, and preview confirmation. Transfer must reuse Place & Plenty's existing private invitation-artwork storage and metadata contract.

**Implementation blocker:** Current web repository is predominantly the marketing and guest web experience. Confirm a supported authenticated host web endpoint before writing the publish API. Do not invent an endpoint or create an unauthenticated media upload.

**Canva app setup:** Public draft app AAHOGO4RP4c, Content Publisher intent, Design Read permission. Development URL localhost:8080 is a placeholder until the Canva CLI serves a JavaScript bundle.

**Build:** Canva recommends `canva apps create --template content_publisher`, `canva apps start`, and `canva apps build`. Use current SDK template and keep its dependency versions consistent. No native rebuild or production deployment required for development.
