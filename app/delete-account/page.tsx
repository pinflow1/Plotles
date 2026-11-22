import type { Metadata } from "next";
import Link from "next/link";
import { BulletList, LegalPage, Section, SupportLink } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Delete your account · Plotless" };

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your account">
      <p>
        You can delete your Plotless account, and the data that goes with it, yourself, at any time. It takes a minute and
        it&rsquo;s permanent.
      </p>

      <Section title="In the app">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Sign in to Plotless.</li>
          <li>Open the menu and go to Settings.</li>
          <li>Scroll to the bottom, tap &ldquo;Delete my account&hellip;&rdquo;, check what will be deleted, and enter your password.</li>
        </ol>
      </Section>

      <Section title="What happens">
        <BulletList
          items={[
            "Deleted: your profile, ideas, writing activity, collaboration requests, and every story you own, including its text. A story you own is deleted for everyone who had access, so export it first if you want to keep it.",
            "Kept: text you wrote in someone else’s story stays in that story. We may also keep limited records where the law requires it, or to deal with abuse.",
          ]}
        />
      </Section>

      <Section title="Can’t sign in?">
        <p>
          Email <SupportLink /> from the address on your account with the subject &ldquo;Delete my account&rdquo;. We&rsquo;ll
          confirm by email and delete your account within 30 days.
        </p>
      </Section>

      <Section title="More">
        <p>
          How we handle your information is in our{" "}
          <Link href="/privacy" className="text-text underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
