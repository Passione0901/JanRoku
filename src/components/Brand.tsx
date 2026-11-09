// Share the same wordmark between links and newspaper headings.
export function BrandContents() {
  return <>
    <span className="janroku-brand__seal" aria-hidden="true">雀</span>
    <span className="janroku-brand__name">雀聞録</span>
  </>;
}
export function Brand({ className = "", href = "https://www.jangbunroku.com/" }: { className?: string; href?: string }) {
  return <a className={`janroku-brand ${className}`.trim()} href={href} aria-label="雀聞録 トップページ">
    <BrandContents />
  </a>;
}
