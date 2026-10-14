import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <>
      <title>找不到这一页 · 霜</title>
      <article className="sheet sheet-narrow">
        <p className="page-date">404</p>
        <h1 className="hand-h hand-h-lg">这一页是空白的</h1>
        <p>地址可能写错了，或者这一页还没写。</p>
        <Link to="/" className="more">
          回到首页 <span aria-hidden="true">→</span>
        </Link>
      </article>
    </>
  );
}
