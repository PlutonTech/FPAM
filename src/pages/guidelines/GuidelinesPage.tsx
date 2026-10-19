import content from './content.html?raw';
import './guidelines.css';

// Static, trusted content copied from the legacy guidelines page (no user
// data), so rendering it as HTML is safe. PDFs are served from /docs.
export default function GuidelinesPage() {
  return (
    <div className="page guidelines">
      <header className="page-header">
        <div>
          <h1 className="page-title">Guidelines & resources</h1>
          <div className="page-sub">FPAM compliance policy and operational guidelines for public assets maintenance</div>
        </div>
      </header>
      <div dangerouslySetInnerHTML={{ __html: content.split('href="/docs/').join(`href="${import.meta.env.BASE_URL}docs/`) }} />
    </div>
  );
}
