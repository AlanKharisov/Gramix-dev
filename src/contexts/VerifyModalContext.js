import { createContext, useContext } from "react";

export const VerifyModalContext = createContext({ show: () => {}, hide: () => {} });
export const useVerifyModal = () => useContext(VerifyModalContext);
