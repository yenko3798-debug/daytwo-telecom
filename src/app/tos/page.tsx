"use client";

import React from "react";
import Link from "next/link";
import { Container } from "@/components/Container";

const Section = ({title, children}) => (
  <section className="rounded-2xl bg-white/70 p-5 ring-1 ring-zinc-900/10 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10">
    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
    <div className="prose prose-zinc mt-2 max-w-none text-sm dark:prose-invert">
      {children}
    </div>
  </section>
);

export default function TermsPage(){
  return (
    <div className="relative min-h-[100dvh] bg-[radial-gradient(1400px_600px_at_0%_-10%,rgba(16,185,129,0.16),transparent),radial-gradient(900px_500px_at_100%_110%,rgba(124,58,237,0.14),transparent)]">
      {/* soft grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:60px_60px]"></div>

      <Container>
        <div className="mx-auto w-full max-w-5xl py-12">
          {/* header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Terms of Service</h1>
              <p className="text-xs text-zinc-500">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
            <Link href="/auth" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90">Accept & Continue</Link>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Section title="1. Acceptance of Terms">
              <p>By accessing or using the Daytwo Telecom platform (the “Service”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree, do not use the Service.</p>
            </Section>

            <Section title="2. Description of Service">
              <p>The Service provides tools to run outbound voice campaigns, IVR call flows (Play/TTS → Gather DTMF → Play/TTS → End), number management, analytics, and related features. Pricing currently includes <strong>$275 per 1,000 calls</strong> for outbound calling unless otherwise stated in your plan.</p>
            </Section>

            <Section title="3. Eligibility; Accounts">
              <ul>
                <li>You must be legally capable of entering into these Terms and comply with all applicable laws and regulations in your jurisdiction.</li>
                <li>You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.</li>
              </ul>
            </Section>

            <Section title="4. Acceptable Use & Compliance (Your Responsibilities)">
              <ul>
                <li><strong>Compliance:</strong> You are solely responsible for compliance with all call, messaging, telemarketing, consumer protection, and privacy laws (including, without limitation, the U.S. <em>Telephone Consumer Protection Act (TCPA)</em>, <em>Telemarketing Sales Rule (TSR)</em>, state Do‑Not‑Call lists, consent requirements, and any analogous international rules).</li>
                <li><strong>Prohibited Uses:</strong> You may not use the Service for illegal activities, fraud, scams, harassment, threats, hate speech, intellectual‑property infringement, spam/robocalls without valid consent, emergency services, or any harmful/abusive purpose.</li>
                <li><strong>Consent & DNC:</strong> You must obtain, document, and honor valid consent where required; scrub against applicable DNC lists; and promptly respect opt‑outs.</li>
                <li><strong>Content:</strong> You warrant that your audio, TTS prompts, lead lists, recordings, and call routing configurations are lawful and do not violate third‑party rights.</li>
              </ul>
            </Section>

            <Section title="5. No Emergency Services">
              <p>The Service is <strong>not</strong> intended for 911/112 or other emergency calling. Do not rely on the Service for emergency communications.</p>
            </Section>

            <Section title="6. Payments; Taxes">
              <ul>
                <li>Fees are due per your plan or order. Usage‑based charges (e.g., per‑call) are calculated by our systems and may vary by route and destination.</li>
                <li>All fees are exclusive of taxes, duties, and carrier surcharges unless specified; you are responsible for applicable taxes.</li>
                <li>Top‑ups and balances are non‑refundable except where required by law.</li>
              </ul>
            </Section>

            <Section title="7. Data; Recordings; Privacy">
              <ul>
                <li>You represent that you have all necessary rights and permissions to upload leads and place calls to those numbers.</li>
                <li>If you record or transcribe calls, you are solely responsible for obtaining any required one‑party or two‑party consent under applicable law.</li>
                <li>Your use of the Service is also governed by our Privacy Policy.</li>
              </ul>
            </Section>

            <Section title="8. Service Changes; Availability">
              <p>We may modify, suspend, or discontinue the Service (or any part) at any time with or without notice. We do not guarantee continuous or error‑free operation.</p>
            </Section>

            <Section title="9. Disclaimers">
              <p>THE SERVICE IS PROVIDED ON AN <strong>“AS IS” AND “AS AVAILABLE”</strong> BASIS. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, WITHOUT LIMITATION, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON‑INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR‑FREE, OR THAT CALL DELIVERY OR TRANSCRIPTION ACCURACY WILL MEET YOUR REQUIREMENTS.</p>
            </Section>

            <Section title="10. Limitation of Liability">
              <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL DAYTWO TELECOM, ITS AFFILIATES, OR THEIR OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR SUPPLIERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
              <p>OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF <strong>THE AMOUNT PAID BY YOU TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY OR ONE HUNDRED U.S. DOLLARS (US$100)</strong>. SOME JURISDICTIONS DO NOT ALLOW LIMITATIONS; IN SUCH CASES, THE ABOVE LIMITS APPLY TO THE FULLEST EXTENT PERMITTED.</p>
            </Section>

            <Section title="11. Indemnification (You Hold Us Harmless)">
              <p>You will defend, indemnify, and hold harmless Daytwo Telecom and its affiliates, officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, and expenses (including reasonable attorneys’ fees) arising from or related to: (a) your use of the Service; (b) your content, leads, or recordings; (c) your violation of these Terms or applicable law (including telemarketing and privacy laws); or (d) any dispute between you and any third party.</p>
            </Section>

            <Section title="12. Termination">
              <p>We may suspend or terminate your access at any time for any reason, including suspected misuse, non‑payment, or legal/compliance concerns. Upon termination, your right to use the Service ceases immediately; Sections intended to survive will do so.</p>
            </Section>

            <Section title="13. Governing Law; Dispute Resolution; Class Action Waiver">
              <ul>
                <li>These Terms are governed by the laws of the State of New York, without regard to conflict‑of‑laws rules.</li>
                <li><strong>Binding Arbitration:</strong> Any dispute arising under these Terms will be resolved exclusively by final and binding arbitration administered by JAMS in New York County, NY, in English, before a single arbitrator. Judgment on the award may be entered in any court of competent jurisdiction.</li>
                <li><strong>Class Action Waiver:</strong> YOU AND DAYTWO TELECOM AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS <em>INDIVIDUAL</em> CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.</li>
              </ul>
            </Section>

            <Section title="14. Changes to Terms">
              <p>We may update these Terms from time to time. Material changes will be indicated by updating the “Last updated” date above. Your continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
            </Section>

            <Section title="15. Contact">
              <p>Questions about these Terms? Contact us at <a className="underline" href="mailto:support@daytwo.app">support@daytwo.app</a>.</p>
            </Section>

            <Section title="Important Notice (Not Legal Advice)">
              <p>These Terms are provided for convenience and general informational purposes only and do not constitute legal advice. Laws change frequently and vary by jurisdiction. You should consult with your own attorney to tailor these Terms to your specific business needs and to ensure ongoing compliance.</p>
            </Section>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Link href="/auth" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90">I Agree</Link>
              <Link href="/" className="rounded-xl px-4 py-2 text-sm text-zinc-700 ring-1 ring-zinc-900/10 transition hover:bg-zinc-900/5 dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-white/10">Back to Home</Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
