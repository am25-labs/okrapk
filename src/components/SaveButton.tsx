import { SaveIcon, CloudOffIcon, LoaderIcon } from "lucide-react";
import type { SyncStatus } from "../hooks/useSync";

interface Props {
  syncStatus: SyncStatus;
  labelColor: string;
  onSave: () => void;
}

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 4,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function SaveButton({ syncStatus, labelColor, onSave }: Props) {
  if (syncStatus === "syncing") {
    return (
      <button style={{ ...btnStyle, color: labelColor }} disabled>
        <LoaderIcon size={16} style={{ animation: "spin 1s linear infinite" }} />
      </button>
    );
  }

  if (syncStatus === "saved") {
    return (
      <button style={{ ...btnStyle, color: labelColor }} disabled>
        <SaveIcon size={16} />
      </button>
    );
  }

  if (syncStatus === "error") {
    return (
      <button style={{ ...btnStyle, color: "rgba(251,191,36,0.6)" }} onClick={onSave} title="Queued — click to retry">
        <CloudOffIcon size={16} />
      </button>
    );
  }

  return (
    <button style={{ ...btnStyle, color: labelColor }} onClick={onSave} title="Save color">
      <SaveIcon size={16} />
    </button>
  );
}
