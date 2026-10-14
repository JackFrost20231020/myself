import { Link } from "react-router";
import type { About } from "../../content/schema.ts";

// 用胶带贴在右页上的小卡片
export function AboutCard({ about }: { about: About }) {
  return (
    <section className="taped-card" aria-labelledby="about-card-name">
      <h2 id="about-card-name" className="taped-card-name">
        {about.name}
      </h2>
      <dl className="facts">
        {about.facts.map((f) => (
          <div key={f.label} className="fact">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <Link to="/about" className="more">
        关于我 <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
