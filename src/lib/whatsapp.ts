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

/**
 * Placeholder: send reminder via WhatsApp to the assignee.
 * Will be implemented later with WhatsApp Business API.
 */
export async function sendReminderViaWhatsApp(
  reminderId: string,
  toNumber: string,
  messageContext: { policyNumber?: string; endDate: string; daysBefore: number }
): Promise<void> {
  // TODO: integrate WhatsApp Business API for reminders
  console.log("[Reminder]", reminderId, toNumber, messageContext);
}
