/** Automated replies originate only from verified incoming WhatsApp messages. */
export async function POST() {
  return Response.json({ error: "Message our WhatsApp business number to start. Public automatic sending is disabled." }, { status: 410 });
}
