import { useState, ImgHTMLAttributes } from "react";
import { ipfsUrlsAll } from "../config/pinata";

interface ResilientImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  /** IPFS CID (without the ipfs:// prefix or /ipfs/ path). */
  cid: string;
}

// Image element that tries every gateway in turn. When the current gateway
// returns an error (4xx, 5xx, network failure), we advance to the next URL.
// Stops when the list is exhausted.
//
// The whole point is read resilience: if the primary Pinata gateway is
// rate-limited or temporarily down, the user still sees the image because
// the same CID resolves on multiple public gateways.
export default function ResilientImage({ cid, alt = "", ...rest }: ResilientImageProps) {
  const urls = ipfsUrlsAll(cid);
  const [index, setIndex] = useState(0);

  if (!cid) return null;

  const onError = () => {
    if (index < urls.length - 1) {
      setIndex((i) => i + 1);
    }
  };

  return <img src={urls[index]} alt={alt} onError={onError} {...rest} />;
}
