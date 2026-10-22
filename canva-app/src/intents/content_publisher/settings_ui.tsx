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
      setError(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        if (await oauth.getAccessToken({ scope })) await load();
      } catch {
        setError("Please connect your account");
      }
    })();
  }, [load]);
  async function connect() {
    setBusy(true);
    setError("");
    setSelected("");
    setOptIn(false);
    setConnected(false);
    try {
      const result = await oauth.requestAuthorization({ scope });
      if (result.status === "completed") await load();
      else setError("Connection canceled. You can try again.");
    } catch {
      setError("Connection unavailable. Try again from Canva.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ padding: 16 }}>
      <Rows spacing="2u">
        <Title size="small">
          Design in Canva. Gather with Place &amp; Plenty.
        </Title>
        <Text>
          Less scrambling. More gathering. Coordinate guests, menus, shopping,
          and who’s bringing what.
        </Text>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void connect()}
        >
          {connected ? "Reconnect account" : "Connect or create an account"}
        </Button>
        {error && <Text>{error}</Text>}
        {connected && (
          <>
            <FormField
              label="Choose a gathering"
              control={(props) => (
                <Select
                  {...props}
                  value={selected}
                  options={gatherings.map((g) => ({
                    value: g.id,
                    label: g.name,
                  }))}
                  placeholder="Select a gathering"
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
              Refresh gatherings
            </Button>
          </>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            void requestOpenExternalUrl({ url: `${backend}/host/create` })
          }
        >
          Create or manage a gathering
        </Button>
        <Text>
          Single-day and multi-day planning use your existing Place &amp; Plenty
          account and plan. After creating a gathering, return here and refresh.
        </Text>
        <Checkbox
          label="Yes, use this design as my digital invitation"
          checked={optIn}
          disabled={!current}
          onChange={(_, checked) => setOptIn(checked)}
        />
        <Text>
          Review the preview, then choose Publish to save the artwork. Your
          existing invitation will be replaced.
        </Text>
        <Button
          variant="tertiary"
          onClick={() => {
            setOptIn(false);
            void requestOpenExternalUrl({ url: `${backend}/host` });
          }}
        >
          Not now — continue planning
        </Button>
      </Rows>
    </div>
  );
}
