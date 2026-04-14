import { UserIcon } from "lucide-react";
import type { AuthState } from "../hooks/useAuth";

interface Props {
  auth: AuthState;
  labelColor: string;
  onClick: () => void;
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

export default function SyncIcon({ auth, labelColor, onClick }: Props) {
  const color = auth.isLoggedIn ? labelColor : "rgba(255,255,255,0.2)";
  return (
    <button style={{ ...btnStyle, color }} onClick={onClick} title={auth.isLoggedIn ? auth.user?.email : "Sign in"}>
      <UserIcon size={16} />
    </button>
  );
}
