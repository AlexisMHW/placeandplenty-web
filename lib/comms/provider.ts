// Provider seam for transactional email (web). Same shape as the native worker's TransactionalEmailProvider so one
// contract is tested on both sides. NO real provider lives here: this module can never reach the network.
//   * createDisabledProvider(): the default. Refuses every send.
//   * createFakeProvider():     test double with scripted outcomes and idempotency. Records what would have been sent.
export interface SendEmailParams { to: string; subject: string; body: string; idempotencyKey: string }
export interface SendEmailResult { providerMessageId: string | null; status: "sent" | "failed"; failureReason?: string }
export interface EmailProvider { send(params: SendEmailParams): Promise<SendEmailResult> }

export function createDisabledProvider(): EmailProvider {
  return { send: async () => ({ providerMessageId: null, status: "failed", failureReason: "comms_sending_disabled" }) };
}

export type FakeOutcome = { status: "sent"; providerMessageId?: string } | { status: "failed"; failureReason: string } | "throw";
export interface FakeProvider extends EmailProvider { sent: SendEmailParams[]; calls: number }

/** Scripted test provider. `script` outcomes are consumed in order; default is success. Same idempotencyKey never sends twice. */
export function createFakeProvider(script: FakeOutcome[] = []): FakeProvider {
  const byKey = new Map<string, SendEmailResult>();
  const p: FakeProvider = {
    sent: [], calls: 0,
    async send(params) {
      p.calls += 1;
      const prior = byKey.get(params.idempotencyKey);
      if (prior) return prior;                       // retried worker run: no second delivery
      const next = script.shift();
      if (next === "throw") throw new Error("fake_provider_network_error");
      let result: SendEmailResult;
      if (next && next.status === "failed") result = { providerMessageId: null, status: "failed", failureReason: next.failureReason };
      else {
        result = { providerMessageId: (next && next.status === "sent" && next.providerMessageId) || `fake_${byKey.size + 1}`, status: "sent" };
        p.sent.push(params);
      }
      byKey.set(params.idempotencyKey, result);
      return result;
    },
  };
  return p;
}
