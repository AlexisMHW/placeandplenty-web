import { PublisherError } from "../../publisher_error";
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
export function SettingsUi({ updatePublishSettings }: RenderSettingsUiRequest) {
  const intl = useIntl();
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = gatherings.find((g) => g.id === selected);
  useEffect(() => {
    updatePublishSettings({
      publishRef:
        current && optIn
          ? serializeInvitationPublishRef({
              gatheringId: current.id,
              duration: current.duration,
              invitationOptIn: true,
            })
          : "",
      validityState: !connected
        ? "invalid_authentication_required"
        : current && optIn
          ? "valid"
          : "invalid_missing_required_fields",
    });
  }, [current, optIn, connected, updatePublishSettings]);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    setSelected("");
    setOptIn(false);
    try {
      const result = await api("gatherings");
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
          onChange={(_, checked) => setOptIn(checked)}
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
