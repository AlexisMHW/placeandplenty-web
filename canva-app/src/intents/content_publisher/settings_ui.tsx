import {
  PublisherError,
  PublisherAuthenticationError,
} from "../../publisher_error";
import { useIntl } from "react-intl";
import { messages } from "../../messages";
import {
  Button,
  Checkbox,
  FormField,
  Rows,
  Select,
  Text,
  Title,
} from "@canva/app-ui-kit";
import type { RenderSettingsUiRequest } from "@canva/intents/content";
import { requestOpenExternalUrl } from "@canva/platform";
import { useCallback, useEffect, useState } from "react";
import { api, backend, oauth, scope } from "../../api";
import { serializeInvitationPublishRef } from "./publish_settings";
type Gathering = {
  id: string;
  name: string;
  duration: "single_day" | "multi_day";
};
export function SettingsUi({
  updatePublishSettings,
  registerOnContextChange,
}: RenderSettingsUiRequest) {
  const intl = useIntl();
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionExpiresAt, setConnectionExpiresAt] = useState(0);
  const [selected, setSelected] = useState("");
  const [requestId, setRequestId] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = gatherings.find((g) => g.id === selected);
  const clearSelection = useCallback(() => {
    setSelected("");
    setOptIn(false);
    setRequestId("");
  }, []);
  const expireConnection = useCallback(() => {
    clearSelection();
    setGatherings([]);
    setConnected(false);
    setConnectionExpiresAt(0);
    setError(intl.formatMessage(messages.reconnectRequired));
  }, [clearSelection, intl]);
  useEffect(() => {
    if (!connected || !connectionExpiresAt) return;
    const timeout = setTimeout(
      expireConnection,
      Math.max(0, connectionExpiresAt - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [connected, connectionExpiresAt, expireConnection]);

  useEffect(
    () =>
      registerOnContextChange?.({
        onContextChange: (context) => {
          if (context.reason === "publish_error_cleared") setError("");
          if (context.reason !== "publish_error") return;
          try {
            const payload = JSON.parse(context.error.appDefinedPayload || "{}");
            if (payload.authenticationRequired === true) expireConnection();
            setError(
              typeof payload.message === "string" &&
                payload.message.length <= 500 &&
                Object.values(messages).some(
                  (descriptor) =>
                    intl.formatMessage(descriptor) === payload.message,
                )
                ? payload.message
                : intl.formatMessage(messages.publishFailed),
            );
          } catch {
            setError(intl.formatMessage(messages.publishFailed));
          }
        },
      }),
    [registerOnContextChange, intl, expireConnection],
  );

  useEffect(() => {
    updatePublishSettings({
      publishRef:
        current && optIn && requestId
          ? serializeInvitationPublishRef({
              gatheringId: current.id,
              requestId,
              duration: current.duration,
              invitationOptIn: true,
            })
          : "",
      validityState: !connected
        ? "invalid_authentication_required"
        : current && optIn && requestId
          ? "valid"
          : "invalid_missing_required_fields",
    });
  }, [current, optIn, requestId, connected, updatePublishSettings]);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    setSelected("");
    setOptIn(false);
    try {
      const result = await api("gatherings");
      const expiresAt = Number(result.connectionExpiresAt);
      if (
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now() ||
        expiresAt > Date.now() + 605000
      )
        throw new PublisherError(
          intl.formatMessage(messages.reconnectRequired),
        );
      setConnectionExpiresAt(expiresAt);
      setGatherings(result.gatherings);
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setGatherings([]);
      setError(
        e instanceof PublisherError
          ? e.message
          : intl.formatMessage(messages.connectionUnavailable),
      );
    } finally {
      setBusy(false);
    }
  }, [intl]);
  useEffect(() => {
    void (async () => {
      try {
        if (await oauth.getAccessToken({ scope })) await load();
      } catch {
        setError(intl.formatMessage(messages.connectRequired));
      }
    })();
  }, [load, intl]);
  async function disconnect() {
    setBusy(true);
    setError("");
    clearSelection();
    setGatherings([]);
    setConnectionExpiresAt(0);
    try {
      try {
        const result = await api("disconnect", { method: "POST" });
        if (result.status !== "disconnected")
          throw new PublisherError(
            intl.formatMessage(messages.disconnectFailed),
          );
      } catch (failure) {
        // An expired or already-revoked grant has no remaining backend access.
        if (!(failure instanceof PublisherAuthenticationError)) throw failure;
      }
      await oauth.deauthorize();
      setConnected(false);
    } catch {
      // Keep Disconnect available for retry, but never retain a publishRef.
      setError(intl.formatMessage(messages.disconnectFailed));
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    setBusy(true);
    setError("");
    setSelected("");
    setOptIn(false);
    setConnected(false);
    try {
      const result = await oauth.requestAuthorization({ scope });
      if (result.status === "completed") await load();
      else setError(intl.formatMessage(messages.connectionCanceled));
    } catch {
      setError(intl.formatMessage(messages.connectionUnavailable));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ padding: 16 }} aria-busy={busy}>
      <Rows spacing="2u">
        <Title size="small">{intl.formatMessage(messages.headline)}</Title>
        <Text>{intl.formatMessage(messages.intro)}</Text>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void connect()}
        >
          {intl.formatMessage(
            connected ? messages.reconnect : messages.connect,
          )}
        </Button>
        {error && (
          <div role="alert">
            <Text>{error}</Text>
          </div>
        )}
        {connected && (
          <>
            <Button
              variant="tertiary"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {intl.formatMessage(messages.disconnect)}
            </Button>
            <FormField
              label={intl.formatMessage(messages.chooseGathering)}
              control={(props) => (
                <Select
                  {...props}
                  value={selected}
                  options={gatherings.map((g) => ({
                    value: g.id,
                    label: g.name,
                  }))}
                  placeholder={intl.formatMessage(messages.selectGathering)}
                  onChange={(value) => {
                    setSelected(value);
                    setOptIn(false);
                  }}
                />
              )}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              {intl.formatMessage(messages.refreshGatherings)}
            </Button>
          </>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            void requestOpenExternalUrl({ url: `${backend}/host/create` })
          }
        >
          {intl.formatMessage(messages.manageGathering)}
        </Button>
        <Text>{intl.formatMessage(messages.planNotice)}</Text>
        <Checkbox
          label={intl.formatMessage(messages.optIn)}
          checked={optIn}
          disabled={!current}
          onChange={(_, checked) => {
            setRequestId(checked ? crypto.randomUUID() : "");
            setOptIn(checked);
          }}
        />
        <Text>{intl.formatMessage(messages.replaceNotice)}</Text>
        <Button
          variant="tertiary"
          onClick={() => {
            setOptIn(false);
            void requestOpenExternalUrl({ url: `${backend}/host` });
          }}
        >
          {intl.formatMessage(messages.notNow)}
        </Button>
      </Rows>
    </div>
  );
}
