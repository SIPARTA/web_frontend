import { ThirdwebProvider } from "thirdweb/react";
import { AuthProvider } from "../context/AuthContext";

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThirdwebProvider>
  );
}
