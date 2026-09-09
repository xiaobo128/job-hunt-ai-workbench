import { initMonitoring } from "@/lib/monitoring";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    initMonitoring();
  }
}
