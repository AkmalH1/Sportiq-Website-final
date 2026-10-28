import "server-only";
import { randomInt } from "node:crypto";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newRef = () => "SIQ-" + Array.from({ length: 8 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("");
