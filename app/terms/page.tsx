import type { Metadata } from "next";
import Link from "next/link";
import { BulletList, LegalPage, Section, SupportLink } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use · Plotless" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These are the rules for using Plotless, the writing app and website run by Qing (&ldquo;Plotless&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By creating an account or using Plotless you agree to them. If you don&rsquo;t agree, please
        don&rsquo;t use it. Our{" "}
        <Link href="/privacy" className="text-text underline underline-offset-2">
          Privacy Policy
        </Link>{" "}
        explains how we handle your information.
      </p>

      <Section title="Who can use Plotless">
        <BulletList
          items={[
            "You must be at least 13 years old.",
            "Give us accurate information, and keep your password private. You’re responsible for what happens under your account.",
            <>If you think someone else has got into your account, email <SupportLink /> straight away.</>,
          ]}
        />
      </Section>

      <Section title="Your writing is yours">
        <p>
          Everything you write in Plotless belongs to you. We don&rsquo;t claim ownership of it. You give us permission to store
          it, back it up, show it to the people you choose to share it with, and process it as needed to run Plotless, and
          nothing more.
        </p>
        <p>We don&rsquo;t sell your writing, and we don&rsquo;t use it to train AI models.</p>
        <p>You&rsquo;re responsible for what you write. Only share work you have the right to share.</p>
      </Section>

      <Section title="Writing with others">
        <BulletList
          items={[
            "People you add to a story can see it, and can change it if you give them edit access, according to the role you choose.",
            "If you set a story to public, other signed-in writers can see its title, description, genres and the preview you write, and can ask to join.",
            "Text you write in someone else’s story stays part of that story, even if you later leave or delete your account. The story’s owner decides what happens to it.",
            "If you own a story and delete it, it’s deleted for everyone who had access.",
            "On anonymous stories, writers appear under a generic name. Don’t try to work out who someone is. If you do see a real name (an owner can, when a writer chose to give one), keep it to yourself.",
          ]}
        />
      </Section>

      <Section title="What isn’t allowed">
        <p>Please don&rsquo;t use Plotless to:</p>
        <BulletList
          items={[
            "do anything illegal, or help someone else do it;",
            "sexually exploit or endanger a child in any way (see Child safety below);",
            "post sexually explicit material. Fiction with mature themes is welcome; pornography is not;",
            "threaten, harass, bully, stalk or discriminate against anyone, or post hate speech;",
            "pretend to be someone you aren’t;",
            "send spam, scams or unwanted promotions;",
            "post work you don’t have the right to share, such as someone else’s writing;",
            "collect other people’s information, scrape Plotless, or try to break, probe or overload it.",
          ]}
        />
      </Section>

      <Section id="child-safety" title="Child safety">
        <p>
          Plotless has zero tolerance for child sexual abuse and exploitation. Any content or account involved is removed and,
          where the law requires or allows, reported to the authorities. If you see anything that puts a child at risk, email{" "}
          <SupportLink /> and we&rsquo;ll look at it as quickly as we can.
        </p>
      </Section>

      <Section title="Reporting a problem">
        <p>
          To report a writer, a story or a message that breaks these rules, email <SupportLink /> with the writer&rsquo;s pen
          name or the story&rsquo;s title and what happened. We review every report. We may remove content, limit features, or
          suspend or close accounts, without warning when something is serious. If you think we got it wrong, tell us.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You can stop using Plotless at any time, and you can delete your account yourself in Settings (&ldquo;Delete my
          account&rdquo;). The steps, and what is and isn&rsquo;t deleted, are on the{" "}
          <Link href="/delete-account" className="text-text underline underline-offset-2">
            Delete your account
          </Link>{" "}
          page. We may suspend or close accounts that break these terms or put other people at risk.
        </p>
      </Section>

      <Section title="Keeping your work safe">
        <p>
          We work to keep Plotless running and your writing safe, but we can&rsquo;t promise it will always be available or free
          of errors, or that nothing will ever be lost. Please export your stories now and then (open a story, then Export) so
          you always have your own copy.
        </p>
      </Section>

      <Section title="Our responsibility">
        <p>
          Plotless is provided &ldquo;as is&rdquo;, without promises about how it will work. As far as the law allows, we
          aren&rsquo;t responsible for indirect or consequential losses, or for lost data or profits, that come from using
          Plotless. Nothing here takes away rights you have by law that can&rsquo;t be waived.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms. The date at the top will change, and for significant changes we&rsquo;ll tell you in the
          app or by email. Carrying on using Plotless after a change means you accept it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms? Email <SupportLink />.
        </p>
      </Section>
    </LegalPage>
  );
}
