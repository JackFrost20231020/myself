import type { About } from "../../content/schema.ts";

export function AboutPage({ about }: { about: About }) {
  return (
    <>
      <title>关于我 · 霜</title>
      <article className="sheet">
        <h1 className="hand-h hand-h-lg">关于我</h1>
        <p className="sheet-name">{about.name}</p>
        <dl className="facts facts-wide">
          {about.facts.map((f) => (
            <div key={f.label} className="fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="prose" dangerouslySetInnerHTML={{ __html: about.bodyHtml }} />
      </article>
    </>
  );
}
