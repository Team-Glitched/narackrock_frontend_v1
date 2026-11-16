import { Link } from "react-router";
import { privacyPolicy } from "./privacy-policy";

export function PrivacyPolicyScreen() {
  return (
    <main className="scrollbar-none h-full overflow-x-hidden overflow-y-auto px-5 pt-6 pb-8 text-app-fg">
      <article className="text-label leading-7 break-words [&_a]:text-app-accent [&_a]:underline [&_li]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">
        <header className="mb-8">
          <Link to="/" aria-label="Narackrock 홈으로 이동">Narackrock</Link>
          <p className="mt-6 text-caption text-app-muted">{privacyPolicy.eyebrow}</p>
          <h1 className="my-3 text-title leading-8 font-bold">{privacyPolicy.title}</h1>
          <p>{privacyPolicy.intro}</p>
          <p className="mt-3 text-caption text-app-muted">{privacyPolicy.effective}</p>
        </header>
        <div className="space-y-7">
          {privacyPolicy.sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-label font-semibold">{section.title}</h2>
              {section.blocks.map((block, index) =>
                "ul" in block ? (
                  <ul key={index}>
                    {block.ul.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={index}>
                    {block.p}
                    {block.email && <a href={`mailto:${block.email}`}>{block.email}</a>}
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
        <footer className="mt-8 border-t border-app-surface pt-5">
          <p>{privacyPolicy.closing}</p>
          <Link className="mt-4 inline-block" to="/">Narackrock으로 돌아가기</Link>
        </footer>
      </article>
    </main>
  );
}
