import { createFileRoute } from "@tanstack/react-router";

import { WorkspacePlaceholder } from "@/components/workspace-placeholder";

export const Route = createFileRoute("/customer")({
  head: () => ({
    meta: [
      { title: "Customer Portal — RecoverAI" },
      {
        name: "description",
        content: "Your RecoverAI customer portal for reviewing and completing outstanding payments.",
      },
      { property: "og:title", content: "Customer Portal — RecoverAI" },
      {
        property: "og:description",
        content: "Review and complete your outstanding payments in the RecoverAI portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <WorkspacePlaceholder
      role="Customer"
      description="Your payment portal lands here next — open balances, receipts and one-tap retries."
    />
  ),
});
