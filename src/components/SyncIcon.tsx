import { UserRoundIcon, LogOutIcon } from "lucide-react";
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
  return (
    <button style={{ ...btnStyle, color: labelColor }} onClick={onClick} title={auth.isLoggedIn ? auth.user?.email : "Sign in"}>
      {auth.isLoggedIn ? <LogOutIcon size={16} /> : <UserRoundIcon size={16} />}
    </button>
  );
}
