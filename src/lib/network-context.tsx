"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_CHAIN_ID, getNetwork, isNetworkConfigured, isSupportedChainId, type SupportedChainId } from "./network";

const STORAGE_KEY = "xlayer-estate:network";

type NetworkContextValue = {
  selectedChainId: SupportedChainId;
  network: ReturnType<typeof getNetwork>;
  selectNetwork: (chainId: SupportedChainId) => void;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [selectedChainId, setSelectedChainId] = useState<SupportedChainId>(DEFAULT_CHAIN_ID);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (isSupportedChainId(stored) && isNetworkConfigured(stored)) setSelectedChainId(stored);
  }, []);

  const selectNetwork = useCallback((chainId: SupportedChainId) => {
    setSelectedChainId(chainId);
    window.localStorage.setItem(STORAGE_KEY, String(chainId));
  }, []);

  const value = useMemo(() => ({ selectedChainId, network: getNetwork(selectedChainId), selectNetwork }), [selectedChainId, selectNetwork]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useProtocolNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useProtocolNetwork must be used inside NetworkProvider");
  return context;
}
