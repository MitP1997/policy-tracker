/**
 * Skeleton: send OTP via WhatsApp.
 * Real implementation will call WhatsApp Business API / Facebook APIs here.
 * For now we only log the OTP so E2E flow can be tested.
 */
export async function sendOtpViaWhatsApp(
  toNumber: string,
  code: string
): Promise<void> {
  // TODO: integrate WhatsApp Business API when ready
  console.log("[OTP]", toNumber, code);
}
