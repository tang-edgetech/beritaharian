import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice" };

/** Plain-language summary under Malaysia's Personal Data Protection Act 2010. To be reviewed before launch. */
export default function PrivacyPage() {
  return (
    <div className="privacy-page site-container flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="page-heading">Privacy notice</h1>
      <p className="page-lead">How Cendol Satay uses the details you give us, in plain words. Draft: this will be reviewed before the site launches.</p>
      <div className="article-body">
        <h2>What we collect</h2>
        <p>Your name, email, and phone if you give it, so you can sign in and we can confirm your account. If you send a report or a review later, we keep what you send, including photos and the place.</p>
        <h2>Why</h2>
        <ul>
          <li>To run your account and keep it secure.</li>
          <li>To check reports and reviews before they are shown.</li>
          <li>To pass a report to the police or authorities only when it is needed and lawful.</li>
        </ul>
        <h2>Your name on reports</h2>
        <p>You can choose to hide your name from the public on a report. Our verifiers still see it, so they can follow up with you.</p>
        <h2>Your choices</h2>
        <p>You can ask to see, correct or delete your details at any time. We never sell your details.</p>
      </div>
    </div>
  );
}
