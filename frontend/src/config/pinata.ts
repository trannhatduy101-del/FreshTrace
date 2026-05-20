import { PinataSDK } from "pinata-web3";

// Pinata JWT loaded from env — exposes upload capability to the browser.
// SECURITY NOTE: this JWT is visible to users. In production, use a scoped
// upload-only key with short TTL or proxy uploads through a tiny serverless fn.
const jwt = (import.meta.env.VITE_PINATA_JWT as string) || "";

// Gateway URL (without trailing slash) for resolving IPFS CIDs into HTTP URLs
export const PINATA_GATEWAY =
  ((import.meta.env.VITE_PINATA_GATEWAY as string) || "https://gateway.pinata.cloud").replace(
    /\/$/,
    ""
  );

// SDK instance configured with auth and gateway for upload + resolve operations
export const pinata = new PinataSDK({
  pinataJwt: jwt,
  pinataGateway: PINATA_GATEWAY,
});

// Convert a bare CID into a public HTTPS URL via the configured gateway
export const ipfsUrl = (cid: string): string => `${PINATA_GATEWAY}/ipfs/${cid}`;
