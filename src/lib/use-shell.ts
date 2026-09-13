import { useOutletContext } from "react-router-dom";
export function useShell() {
  return useOutletContext<{ openKeyDialog: () => void; hasKey: boolean; dark: boolean; setDark: (value: boolean) => void }>();
}
