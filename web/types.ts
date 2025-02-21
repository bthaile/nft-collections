export interface NFTMetadata {
  title: string;
  type: string;
  properties: {
    name: { type: string; value: string; };
    description: { type: string; value: string; };
    image: { type: string; value: string; };
  };
}

export function createMetadata(
  name: string,
  description: string,
  image: string
): string {
  const metadata: NFTMetadata = {
    title: "Asset Metadata",
    type: "object",
    properties: {
      name: { type: "string", value: name },
      description: { type: "string", value: description },
      image: { type: "string", value: image }
    }
  };
  
  const json = JSON.stringify(metadata);
  const base64 = Buffer.from(json).toString('base64');
  return `data:application/json;base64,${base64}`;
} 