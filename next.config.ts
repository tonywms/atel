// ATEL_V140_ALLOWED_LAN: detecta exclusivamente IPs IPv4 privados presentes neste computador.
import { networkInterfaces } from "node:os";
const atelLanIps = Object.values(networkInterfaces())
  .flatMap((interfaces) => interfaces ?? [])
  .filter((net) => net.family === "IPv4" && !net.internal)
  .map((net) => net.address)
  .filter((ip) => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip));
import type { NextConfig } from "next"; const c:NextConfig={ allowedDevOrigins: atelLanIps, }; export default c;