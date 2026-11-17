import type { Metadata } from "next";
import Link from "next/link";
import { BulletList, LegalPage, Section, SupportLink } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Plotless" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This explains what Plotless collects, why, who can see it, and what you can do about it. Plotless is run by Qing. If
        you have any questions, email <SupportLink />.
      </p>

      <Section title="What we collect">
        <p>What you give us:</p>
        <BulletList
          items={[
            "Account details: your email address, a password (stored scrambled, or hashed, so we can’t read it) and a pen name.",
            "Optional profile details: a picture, a bio, genres, interests, and a real name (kept private, see below).",
            "What you write and do: your stories (titles, descriptions, covers, goals), chapters and their text, ideas, collaboration requests and the messages in them, and which stories you can open.",
          ]}
        />
        <p>What we collect automatically:</p>
        <BulletList
          items={[
            "Writing activity: daily word counts, used for your streaks and stats.",
            "A sign-in cookie that keeps you signed in for 30 days, and settings such as theme and text size, which are saved on your own device.",
            "Standard server logs (IP address, device and browser type, pages requested, and times), kept by our hosting provider for security and reliability.",
          ]}
        />
        <p>
          We don&rsquo;t use advertising, analytics or tracking tools. We don&rsquo;t collect your location, contacts, camera,
          microphone or payment details.
        </p>
      </Section>

      <Section title="How we use it">
        <BulletList
          items={[
            "To run Plotless: sign you in, save and sync your writing, let you collaborate, and let you export.",
            "To keep it safe: prevent abuse, fix bugs and enforce our Terms of Use.",
            "To reply when you contact us.",
          ]}
        />
        <p>We don&rsquo;t sell your personal information, and we don&rsquo;t use it for advertising.</p>
      </Section>

      <Section title="Who can see what">
        <BulletList
          items={[
            "Other writers on Plotless can find you by pen name, bio, genres or interests, and can see your pen name, picture, bio, genres and interests. Your email address is never shown to other writers.",
            "Stories: the people you give access to can see a story according to their role. For a public story, other signed-in writers can see its title, description, genres and the preview you write, and can ask to join.",
            "Anonymous stories: other writers see a generic name instead of your pen name. If you gave a real name, only the story’s owner can see it, and only when they tap your anonymous name in that story.",
            "Your ideas, writing activity and settings are private to you.",
          ]}
        />
      </Section>

      <Section title="Who we share it with">
        <p>A few services help us run Plotless and handle data on our behalf:</p>
        <BulletList
          items={[
            "Vercel hosts the app and website.",
            "Liveblocks provides real-time editing: the text of your chapters is stored and synced there.",
            "A managed PostgreSQL database service stores account and story details.",
          ]}
        />
        <p>
          We may also share information when the law requires it, or to protect someone&rsquo;s safety, for example to report
          child exploitation to the authorities. Our providers may process data in the United States and in other countries
          where they operate.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your information while your account is open. When you delete your account, we delete it as described below.
        </p>
      </Section>

      <Section id="delete-account" title="Delete your account and data">
        <p>
          To delete your account, email <SupportLink /> from the address on your account with the subject &ldquo;Delete my
          account&rdquo;. We&rsquo;ll confirm by email and delete it within 30 days.
        </p>
        <BulletList
          items={[
            "Deleted: your profile, ideas, writing activity, collaboration requests, and the stories you own. A story you own is deleted for everyone who had access, so please export it first.",
            "Kept: text you wrote in someone else’s story stays in that story. We may also keep limited records where the law requires it, or to deal with abuse.",
          ]}
        />
      </Section>

      <Section title="Your choices">
        <p>
          You can edit your profile in Settings, and export your stories at any time (open a story, then Export). You can also
          email us to ask for a copy of your information, to correct it, or to delete it. If you live somewhere with privacy
          laws, such as the EU or UK, you may have more rights; contact us and we&rsquo;ll help.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We use encrypted connections (HTTPS), hashed passwords and access controls. No service is perfectly secure, so keep
          your password private.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Plotless is for people 13 and older. We don&rsquo;t knowingly collect information from children under 13, and if we
          learn we have, we&rsquo;ll delete it. If you think a child under 13 has an account, email <SupportLink />.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update this policy. The date at the top will change, and for significant changes we&rsquo;ll tell you in the
          app or by email. Our{" "}
          <Link href="/terms" className="text-text underline underline-offset-2">
            Terms of Use
          </Link>{" "}
          explain the rules for using Plotless.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Email <SupportLink />.
        </p>
      </Section>
    </LegalPage>
  );
}
