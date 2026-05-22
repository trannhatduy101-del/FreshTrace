import { PinataSDK } from "pinata-web3";

// Pinata JWT loaded from env, exposes upload capability to the browser.
// Security note: this JWT is visible to users. In production, use a scoped
// upload-only key with a short TTL, or proxy uploads through a tiny serverless
// function so the secret never leaves the server.
const jwt = (import.meta.env.VITE_PINATA_JWT as string) || "";

// Primary gateway from env. Strip any trailing slash so we can append paths
// consistently.
export const PINATA_GATEWAY =
  ((import.meta.env.VITE_PINATA_GATEWAY as string) || "https://gateway.pinata.cloud").replace(
    /\/$/,
    ""
  );

// Public IPFS gateways used as read-time fallbacks. If Pinata's gateway is
// rate-limited or down, the browser tries the next one in order. Pinning
// still happens to Pinata only, but as long as another node on the network
// has the CID cached or pinned, the user sees the image.
const FALLBACK_GATEWAYS = [
  "https://ipfs.io",
  "https://dweb.link",
  "https://cloudflare-ipfs.com",
];

// SDK instance configured with auth and gateway for upload + resolve operations
export const pinata = new PinataSDK({
  pinataJwt: jwt,
  pinataGateway: PINATA_GATEWAY,
});

// Convert a bare CID into the preferred HTTPS URL. The ResilientImage
// component will fall back to the others if this one fails.
export const ipfsUrl = (cid: string): string => `${PINATA_GATEWAY}/ipfs/${cid}`;

// Return every gateway URL we will try for a given CID, in preference order.
// Used by the ResilientImage component to cycle through on error.
export const ipfsUrlsAll = (cid: string): string[] => [
  ipfsUrl(cid),
  ...FALLBACK_GATEWAYS.map((g) => `${g}/ipfs/${cid}`),
];
